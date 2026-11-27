import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clubs, posts, universities } from '@/db/schema';
import { generateEmbedding } from '@/lib/ai/client';
import { requireClubMember, requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { serializePublicStreamPost } from '@/lib/serializers';
import { postWriteSchema } from '@/lib/validators';

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [clubRow] = await db
      .select({
        club: clubs,
        universityShortName: universities.shortName,
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!clubRow) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const rawBody = await req.json();
    const parsed = postWriteSchema.parse(rawBody);

    const { user, club } =
      parsed.post_kind === 'nrc_moment'
        ? await requireClubMember(clubRow.club.id)
        : await requireClubOfficer(clubRow.club.id);

    const isPublished = parsed.status === 'published';
    const embedding = isPublished
      ? await generateEmbedding(
          `[${clubRow.universityShortName} ${club.name}] ${parsed.headline}\n${parsed.content_md.slice(0, 1000)}`
        )
      : null;

    const now = new Date();
    const [created] = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(posts)
        .values({
          clubId: club.id,
          authorUserId: user.id,
          postKind: parsed.post_kind,
          headline: parsed.headline,
          contentMd: parsed.content_md,
          mediaItems: parsed.media_items,
          relatedEventId: parsed.related_event_id ?? null,
          moodTag: parsed.mood_tag ?? null,
          domainIds: parsed.domain_ids.length > 0 ? parsed.domain_ids : club.domainIds,
          originalityConfirmed: parsed.originality_confirmed,
          includeInEvaluation: parsed.include_in_evaluation,
          status: parsed.status,
          embedding,
          publishedAt: isPublished ? now : null,
        })
        .returning();

      if (isPublished) {
        await tx.update(clubs).set({ lastActivityAt: now, updatedAt: now }).where(eq(clubs.id, club.id));
      }
      return rows;
    });

    return NextResponse.json(
      {
        post: serializePublicStreamPost({
          ...created,
          club: {
            id: club.id,
            slug: club.slug,
            name: club.name,
            avatarUrl: club.avatarUrl,
            verificationStatus: club.verificationStatus,
            isDemo: club.isDemo,
            universityShortName: clubRow.universityShortName,
          },
        }),
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
