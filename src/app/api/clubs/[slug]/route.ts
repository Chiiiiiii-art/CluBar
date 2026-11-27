import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubEvents, clubQuestions, clubs, posts, universities } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { computeClubPulse } from '@/lib/discovery/fairness';
import { AppError, handleApiError } from '@/lib/errors';
import {
  serializePublicClub,
  serializePublicQuestion,
  serializePublicStreamPost,
} from '@/lib/serializers';
import { clubCategorySchema, externalLinkSchema, mediaUrlSchema } from '@/lib/validators';

const patchClubSchema = z.object({
  tagline: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  category: clubCategorySchema.optional(),
  domain_ids: z.array(z.string().uuid()).max(5).optional(),
  avatar_url: mediaUrlSchema.nullable().optional(),
  cover_url: mediaUrlSchema.nullable().optional(),
  external_links: z.array(externalLinkSchema).max(8).optional(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [clubRow] = await db
      .select({
        club: clubs,
        university: {
          id: universities.id,
          code: universities.code,
          name: universities.name,
          shortName: universities.shortName,
        },
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!clubRow || clubRow.club.verificationStatus === 'pending_review') {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    const now = new Date();
    const [events, postRows, questionRows] = await Promise.all([
      db
        .select()
        .from(clubEvents)
        .where(
          and(
            eq(clubEvents.clubId, clubRow.club.id),
            eq(clubEvents.status, 'open'),
            or(isNull(clubEvents.endsAt), gt(clubEvents.endsAt, now))
          )
        )
        .orderBy(desc(clubEvents.createdAt)),
      db
        .select()
        .from(posts)
        .where(and(eq(posts.clubId, clubRow.club.id), eq(posts.status, 'published')))
        .orderBy(desc(posts.publishedAt), desc(posts.createdAt)),
      db
        .select()
        .from(clubQuestions)
        .where(and(eq(clubQuestions.clubId, clubRow.club.id), eq(clubQuestions.status, 'published')))
        .orderBy(desc(clubQuestions.isPinnedFaq), desc(clubQuestions.answeredAt)),
    ]);

    return NextResponse.json({
      club: serializePublicClub({
        ...clubRow.club,
        pulseLabel: computeClubPulse({ lastActivityAt: clubRow.club.lastActivityAt }),
        university: clubRow.university,
      }),
      upcoming_events: events.map((e) => ({
        id: e.id,
        short_code: e.shortCode,
        title: e.title,
        schedule_mode: e.scheduleMode,
        starts_at: e.startsAt ? e.startsAt.toISOString() : null,
        location_text: e.locationText,
        beginner_friendly: e.beginnerFriendly,
        non_members_welcome: e.nonMembersWelcome,
        fee_ntd: e.feeNtd,
      })),
      posts: postRows.map((p) =>
        serializePublicStreamPost({
          ...p,
          club: {
            id: clubRow.club.id,
            slug: clubRow.club.slug,
            name: clubRow.club.name,
            avatarUrl: clubRow.club.avatarUrl,
            verificationStatus: clubRow.club.verificationStatus,
            isDemo: clubRow.club.isDemo,
            universityShortName: clubRow.university.shortName,
          },
        })
      ),
      questions: questionRows.map(serializePublicQuestion),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [clubRow] = await db
      .select({
        club: clubs,
        university: {
          id: universities.id,
          code: universities.code,
          name: universities.name,
          shortName: universities.shortName,
        },
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!clubRow) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    await requireClubOfficer(clubRow.club.id);

    const body = await req.json();
    const parsed = patchClubSchema.parse(body);

    const [updated] = await db
      .update(clubs)
      .set({
        ...(parsed.tagline !== undefined ? { tagline: parsed.tagline } : {}),
        ...(parsed.description !== undefined ? { description: parsed.description } : {}),
        ...(parsed.category !== undefined ? { category: parsed.category } : {}),
        ...(parsed.domain_ids !== undefined ? { domainIds: parsed.domain_ids } : {}),
        ...(parsed.avatar_url !== undefined ? { avatarUrl: parsed.avatar_url } : {}),
        ...(parsed.cover_url !== undefined ? { coverUrl: parsed.cover_url } : {}),
        ...(parsed.external_links !== undefined ? { externalLinks: parsed.external_links } : {}),
        updatedAt: new Date(),
      })
      .where(eq(clubs.id, clubRow.club.id))
      .returning();

    return NextResponse.json({
      club: serializePublicClub({
        ...updated,
        pulseLabel: computeClubPulse({ lastActivityAt: updated.lastActivityAt }),
        university: clubRow.university,
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
