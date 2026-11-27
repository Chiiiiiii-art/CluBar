import { NextResponse } from 'next/server';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  clubMemberships,
  clubs,
  togetherItems,
  togetherReplies,
  universities,
} from '@/db/schema';
import { requireClubMember, requireVerifiedStudent } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const replySchema = z.object({
  club_id: z.string().uuid().optional(),
  content_md: z.string().trim().min(2, '回覆內容至少 2 個字').max(2000),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const rows = await db
      .select({
        id: togetherReplies.id,
        contentMd: togetherReplies.contentMd,
        createdAt: togetherReplies.createdAt,
        clubName: clubs.name,
        clubSlug: clubs.slug,
        uniShort: universities.shortName,
      })
      .from(togetherReplies)
      .innerJoin(clubs, eq(togetherReplies.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(and(eq(togetherReplies.itemId, id), eq(togetherReplies.status, 'published')))
      .orderBy(asc(togetherReplies.createdAt))
      .limit(80);

    return NextResponse.json({
      replies: rows.map((r) => ({
        id: r.id,
        content_md: r.contentMd,
        created_at: r.createdAt.toISOString(),
        club: {
          slug: r.clubSlug,
          name: r.clubName,
          university_short_name: r.uniShort,
        },
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = replySchema.parse(body);

    const [item] = await db
      .select()
      .from(togetherItems)
      .where(and(eq(togetherItems.id, id), eq(togetherItems.status, 'published')))
      .limit(1);

    if (!item) {
      throw new AppError(404, 'TOGETHER_ITEM_NOT_FOUND', '找不到指定交流主題。');
    }

    let resolvedUserId: string;
    let resolvedClubId: string;

    if (parsed.club_id) {
      const ctx = await requireClubMember(parsed.club_id);
      resolvedUserId = ctx.user.id;
      resolvedClubId = ctx.club.id;
    } else {
      const user = await requireVerifiedStudent();
      const [firstMem] = await db
        .select({ clubId: clubMemberships.clubId })
        .from(clubMemberships)
        .where(and(eq(clubMemberships.userId, user.id), isNull(clubMemberships.endedAt)))
        .limit(1);
      if (!firstMem) {
        throw new AppError(
          403,
          'CLUB_MEMBERSHIP_REQUIRED',
          '請先透過「我的社團」加入至少一個認證社團後再於跨校舞台回覆。'
        );
      }
      resolvedUserId = user.id;
      resolvedClubId = firstMem.clubId;
    }

    const created = await db.transaction(async (tx) => {
      const [reply] = await tx
        .insert(togetherReplies)
        .values({
          itemId: item.id,
          clubId: resolvedClubId,
          authorUserId: resolvedUserId,
          contentMd: parsed.content_md,
        })
        .returning();

      await tx
        .update(togetherItems)
        .set({
          replyCount: sql`${togetherItems.replyCount} + 1`,
          lastActivityAt: new Date(),
        })
        .where(eq(togetherItems.id, item.id));

      return reply;
    });

    return NextResponse.json(
      {
        reply: {
          id: created.id,
          content_md: created.contentMd,
          created_at: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
