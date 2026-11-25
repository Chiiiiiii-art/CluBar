import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, clubs, posts, universities } from '@/db/schema';
import { buildPostEmbeddingText, generateEmbedding } from '@/lib/ai/client';
import { requireClubRole } from '@/lib/auth/guards';
import { CLUB_CATEGORIES, POST_TYPES } from '@/lib/constants';
import { AppError, handleApiError } from '@/lib/errors';
import { serializePublicPost } from '@/lib/serializers';
import {
  externalLinkSchema,
  mediaItemSchema,
  stripMarkdownSummary,
} from '@/lib/validators';

const uuidSchema = z.string().uuid('無效的貼文識別碼。');

const patchPostSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  post_type: z.enum(['work', 'event', 'workshop', 'competition']).optional(),
  academic_year: z.number().int().min(100).max(150).optional(),
  summary: z.string().trim().max(200).optional(),
  content_md: z.string().trim().min(10).max(20000).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
  media_urls: z.array(mediaItemSchema).max(6).optional(),
  external_links: z.array(externalLinkSchema).max(5).optional(),
  collaborators: z.string().trim().max(200).nullable().optional(),
  originality_confirmed: z.boolean().optional(),
  status: z.enum(['draft', 'published']).optional(),
});

const deletePostSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: '刪除貼文須經二次確認（confirm: true）。' }),
  }),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId } = await context.params;
    const validPostId = uuidSchema.parse(postId);

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
    const { club } = await requireClubRole(clubRow.club.id, ['owner', 'editor']);

    const [existing] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, validPostId), eq(posts.clubId, club.id)))
      .limit(1);

    if (!existing) throw new AppError(404, 'POST_NOT_FOUND', '找不到指定貼文。');
    if (existing.status === 'removed_by_admin') {
      throw new AppError(403, 'POST_REMOVED_BY_ADMIN', '此貼文已遭管理員下架，無法直接編輯發布。');
    }

    const rawBody = await req.json();
    const parsed = patchPostSchema.parse(rawBody);

    const nextStatus = parsed.status ?? (existing.status === 'hidden_by_owner' ? 'draft' : existing.status);
    const nextOriginality = parsed.originality_confirmed ?? existing.originalityConfirmed;

    if (nextStatus === 'published' && !nextOriginality) {
      throw new AppError(
        400,
        'ORIGINALITY_REQUIRED',
        '發布前必須勾選原創與素材授權確認聲明。'
      );
    }

    const nextTitle = parsed.title ?? existing.title;
    const nextPostType = parsed.post_type ?? existing.postType;
    const nextContentMd = parsed.content_md ?? existing.contentMd;
    const nextTags = parsed.tags ?? existing.tags;
    const nextSummary =
      parsed.summary !== undefined
        ? parsed.summary.trim() || stripMarkdownSummary(nextContentMd, 140)
        : existing.summary || stripMarkdownSummary(nextContentMd, 140);

    const contentChanged =
      parsed.title !== undefined ||
      parsed.content_md !== undefined ||
      parsed.summary !== undefined ||
      parsed.tags !== undefined ||
      (nextStatus === 'published' && existing.status !== 'published');

    let nextEmbedding = existing.embedding;
    let nextEmbeddingUpdatedAt = existing.embeddingUpdatedAt;

    if (nextStatus === 'published' && contentChanged) {
      const vec = await generateEmbedding(
        buildPostEmbeddingText({
          universityShortName: clubRow.universityShortName,
          clubName: club.name,
          categoryLabel: CLUB_CATEGORIES[club.category].label,
          postTypeLabel: POST_TYPES[nextPostType].label,
          title: nextTitle,
          summary: nextSummary,
          tags: nextTags,
          contentMd: nextContentMd,
        })
      );
      if (vec) {
        nextEmbedding = vec;
        nextEmbeddingUpdatedAt = new Date();
      }
    }

    const now = new Date();
    const [updated] = await db
      .update(posts)
      .set({
        title: nextTitle,
        postType: nextPostType,
        academicYear: parsed.academic_year ?? existing.academicYear,
        summary: nextSummary,
        contentMd: nextContentMd,
        tags: nextTags,
        mediaUrls: parsed.media_urls ?? existing.mediaUrls,
        externalLinks: parsed.external_links ?? existing.externalLinks,
        collaborators:
          parsed.collaborators !== undefined ? parsed.collaborators : existing.collaborators,
        originalityConfirmed: nextOriginality,
        status: nextStatus,
        publishedAt:
          nextStatus === 'published' ? existing.publishedAt ?? now : existing.publishedAt,
        embedding: nextEmbedding,
        embeddingUpdatedAt: nextEmbeddingUpdatedAt,
        updatedAt: now,
      })
      .where(eq(posts.id, existing.id))
      .returning();

    return NextResponse.json({
      post: serializePublicPost({
        ...updated,
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
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId } = await context.params;
    const validPostId = uuidSchema.parse(postId);

    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user, membership } = await requireClubRole(club.id, ['owner', 'editor']);
    const [existing] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, validPostId), eq(posts.clubId, club.id)))
      .limit(1);

    if (!existing) throw new AppError(404, 'POST_NOT_FOUND', '找不到指定貼文。');

    const isOwner = membership.role === 'owner';
    const isOwnDraft = existing.status === 'draft' && existing.authorUserId === user.id;
    if (!isOwner && !isOwnDraft) {
      throw new AppError(403, 'CLUB_OWNER_REQUIRED', '僅現任社長可下架已發布之社團成果貼文。');
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsed = deletePostSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError(400, 'CONFIRMATION_REQUIRED', '刪除貼文須帶入確認欄位 confirm: true。');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(posts)
        .set({ status: 'hidden_by_owner', updatedAt: new Date() })
        .where(eq(posts.id, existing.id));

      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        action: 'post.hidden_by_owner',
        targetType: 'post',
        targetId: existing.id,
        metadata: { club_id: club.id, previous_status: existing.status },
      });
    });

    return NextResponse.json({ hidden: true, status: 'hidden_by_owner' });
  } catch (err) {
    return handleApiError(err);
  }
}
