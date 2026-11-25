import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clubs, posts, universities } from '@/db/schema';
import { getCurrentAcademicYear } from '@/lib/academic-year';
import { buildPostEmbeddingText, generateEmbedding } from '@/lib/ai/client';
import { requireClubRole } from '@/lib/auth/guards';
import { CLUB_CATEGORIES, POST_TYPES } from '@/lib/constants';
import { AppError, handleApiError } from '@/lib/errors';
import { serializePublicPost } from '@/lib/serializers';
import { postWriteSchema, stripMarkdownSummary } from '@/lib/validators';

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
    const { user, club } = await requireClubRole(clubRow.club.id, ['owner', 'editor']);

    const rawBody = await req.json();
    if (rawBody?.status === 'published' && rawBody?.originality_confirmed !== true) {
      throw new AppError(
        400,
        'ORIGINALITY_REQUIRED',
        '發布前必須勾選原創與素材授權確認聲明。'
      );
    }

    const parsed = postWriteSchema.parse(rawBody);
    const summary = parsed.summary?.trim() || stripMarkdownSummary(parsed.content_md, 140);
    const academicYear = parsed.academic_year ?? getCurrentAcademicYear();
    const isPublished = parsed.status === 'published';

    let embedding: number[] | null = null;
    if (isPublished) {
      embedding = await generateEmbedding(
        buildPostEmbeddingText({
          universityShortName: clubRow.universityShortName,
          clubName: club.name,
          categoryLabel: CLUB_CATEGORIES[club.category].label,
          postTypeLabel: POST_TYPES[parsed.post_type].label,
          title: parsed.title,
          summary,
          tags: parsed.tags,
          contentMd: parsed.content_md,
        })
      );
    }

    const now = new Date();
    const [created] = await db
      .insert(posts)
      .values({
        clubId: club.id,
        authorUserId: user.id,
        academicYear,
        postType: parsed.post_type,
        title: parsed.title,
        summary,
        contentMd: parsed.content_md,
        tags: parsed.tags,
        mediaUrls: parsed.media_urls,
        externalLinks: parsed.external_links,
        collaborators: parsed.collaborators ?? null,
        originalityConfirmed: parsed.originality_confirmed,
        status: parsed.status,
        embedding,
        embeddingUpdatedAt: embedding ? now : null,
        publishedAt: isPublished ? now : null,
      })
      .returning();

    return NextResponse.json(
      {
        post: serializePublicPost({
          ...created,
          club: {
            id: club.id,
            slug: club.slug,
            name: club.name,
            category: club.category,
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
