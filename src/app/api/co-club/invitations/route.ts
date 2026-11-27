import { NextResponse } from 'next/server';
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  clubEvents,
  clubMemberships,
  clubs,
  coClubLinks,
  notifications,
  posts,
} from '@/db/schema';
import { requireClubOfficer, requireVerifiedStudent } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const inviteSchema = z.object({
  host_club_id: z.string().uuid(),
  partner_club_slug: z.string().trim().min(2).max(60),
  target_type: z.enum(['event', 'post']),
  target_id: z.string().uuid(),
});

export async function GET() {
  try {
    const user = await requireVerifiedStudent();
    const myOfficerClubs = await db
      .select({ clubId: clubMemberships.clubId })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.userId, user.id),
          isNull(clubMemberships.endedAt),
          inArray(clubMemberships.role, ['owner', 'editor'])
        )
      );

    if (myOfficerClubs.length === 0) {
      return NextResponse.json({ invitations: [] });
    }

    const clubIds = myOfficerClubs.map((c) => c.clubId);
    const links = await db
      .select()
      .from(coClubLinks)
      .where(
        or(
          inArray(coClubLinks.partnerClubId, clubIds),
          inArray(coClubLinks.hostClubId, clubIds)
        )
      )
      .orderBy(desc(coClubLinks.createdAt))
      .limit(50);

    if (links.length === 0) {
      return NextResponse.json({ invitations: [] });
    }

    const allClubIds = Array.from(
      new Set(links.flatMap((l) => [l.hostClubId, l.partnerClubId]))
    );
    const clubRows = await db
      .select({ id: clubs.id, slug: clubs.slug, name: clubs.name })
      .from(clubs)
      .where(inArray(clubs.id, allClubIds));
    const clubMap = new Map(clubRows.map((c) => [c.id, c]));

    const eventIds = links.filter((l) => l.targetType === 'event').map((l) => l.targetId);
    const postIds = links.filter((l) => l.targetType === 'post').map((l) => l.targetId);

    const [eventRows, postRows] = await Promise.all([
      eventIds.length > 0
        ? db
            .select({ id: clubEvents.id, title: clubEvents.title, shortCode: clubEvents.shortCode })
            .from(clubEvents)
            .where(inArray(clubEvents.id, eventIds))
        : Promise.resolve([]),
      postIds.length > 0
        ? db
            .select({ id: posts.id, headline: posts.headline })
            .from(posts)
            .where(inArray(posts.id, postIds))
        : Promise.resolve([]),
    ]);

    const eventMap = new Map(eventRows.map((e) => [e.id, e]));
    const postMap = new Map(postRows.map((p) => [p.id, p]));
    const mySet = new Set(clubIds);

    return NextResponse.json({
      invitations: links.map((l) => {
        const host = clubMap.get(l.hostClubId);
        const partner = clubMap.get(l.partnerClubId);
        const targetEv = l.targetType === 'event' ? eventMap.get(l.targetId) : undefined;
        const targetPost = l.targetType === 'post' ? postMap.get(l.targetId) : undefined;
        return {
          id: l.id,
          direction: mySet.has(l.partnerClubId) ? 'incoming' : 'outgoing',
          target_type: l.targetType,
          target_id: l.targetId,
          target_title: targetEv?.title ?? targetPost?.headline ?? '活動／內容',
          target_url: targetEv ? `/e/${targetEv.shortCode}` : `/posts/${l.targetId}`,
          host_club: host ?? { id: l.hostClubId, slug: '', name: '主辦社團' },
          partner_club: partner ?? { id: l.partnerClubId, slug: '', name: '受邀友社' },
          status: l.status,
          partner_include_eval: l.partnerIncludeEval,
          created_at: l.createdAt.toISOString(),
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = inviteSchema.parse(body);

    const { user, club: hostClub } = await requireClubOfficer(parsed.host_club_id);

    const [partnerClub] = await db
      .select()
      .from(clubs)
      .where(eq(clubs.slug, parsed.partner_club_slug))
      .limit(1);

    if (!partnerClub || partnerClub.verificationStatus !== 'verified') {
      throw new AppError(404, 'PARTNER_CLUB_NOT_FOUND', '找不到目標已認證友社。');
    }
    if (partnerClub.id === hostClub.id) {
      throw new AppError(400, 'SELF_COCLUB_INVALID', '無法向自己社團發送 Co-Club 共辦邀請。');
    }

    if (parsed.target_type === 'event') {
      const [ev] = await db
        .select({ id: clubEvents.id, clubId: clubEvents.clubId })
        .from(clubEvents)
        .where(and(eq(clubEvents.id, parsed.target_id), eq(clubEvents.clubId, hostClub.id)))
        .limit(1);
      if (!ev) throw new AppError(404, 'TARGET_EVENT_NOT_FOUND', '活動不屬於此主辦社團。');
    } else {
      const [p] = await db
        .select({ id: posts.id, clubId: posts.clubId })
        .from(posts)
        .where(and(eq(posts.id, parsed.target_id), eq(posts.clubId, hostClub.id)))
        .limit(1);
      if (!p) throw new AppError(404, 'TARGET_POST_NOT_FOUND', '貼文不屬於此主辦社團。');
    }

    const [created] = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: coClubLinks.id })
        .from(coClubLinks)
        .where(
          and(
            eq(coClubLinks.targetType, parsed.target_type),
            eq(coClubLinks.targetId, parsed.target_id),
            eq(coClubLinks.partnerClubId, partnerClub.id)
          )
        )
        .limit(1);

      if (existing) {
        throw new AppError(409, 'COCLUB_ALREADY_INVITED', '已發送過共辦邀請給該友社。');
      }

      const [link] = await tx
        .insert(coClubLinks)
        .values({
          targetType: parsed.target_type,
          targetId: parsed.target_id,
          hostClubId: hostClub.id,
          partnerClubId: partnerClub.id,
          invitedBy: user.id,
        })
        .returning();

      const partnerOfficers = await tx
        .select({ userId: clubMemberships.userId })
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, partnerClub.id),
            isNull(clubMemberships.endedAt),
            inArray(clubMemberships.role, ['owner', 'editor'])
          )
        );

      if (partnerOfficers.length > 0) {
        await tx.insert(notifications).values(
          partnerOfficers.map((po) => ({
            userId: po.userId,
            type: 'coclub_invite',
            title: `Co-Club 共辦邀請：${hostClub.name} × ${partnerClub.name}`,
            body: `「${hostClub.name}」邀請貴社掛名共辦活動／成果。同意後雙方評鑑報表皆可計入此場實績。`,
            linkUrl: '/me',
          }))
        );
      }

      return [link];
    });

    return NextResponse.json(
      {
        invitation: {
          id: created.id,
          status: created.status,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
