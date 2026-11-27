import { and, count, eq, isNotNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, clubs, posts, universities } from '@/db/schema';
import { generateEmbedding } from '@/lib/ai/client';
import { requireClubMember } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { serializePublicStreamPost } from '@/lib/serializers';
import { mediaItemSchema } from '@/lib/validators';

const uuidSchema = z.string().uuid('無效的貼文識別碼。');

const patchPostSchema = z.object({
  headline: z.string().trim().min(2).max(120).optional(),
  content_md: z.string().trim().max(20000).optional(),
  media_items: z.array(mediaItemSchema).min(1).max(6).optional(),
  include_in_evaluation: z.boolean().optional(),
  originality_confirmed: z.boolean().optional(),
  status: z.enum(['draft', 'published']).optional(),
  // U-05: officers pin representative works (max MAX_PINNED per club).
  pinned: z.boolean().optional(),
});

const MAX_PINNED = 4;

const deletePostSchema = z.object({
  confirm: z.literal(true),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId } = await context.params;
    const validPostId = uuidSchema.parse(postId);

    const [clubRow] = await db
      .select({ club: clubs, universityShortName: universities.shortName })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!clubRow) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    const { user, club, membership } = await requireClubMember(clubRow.club.id);

    const [existing] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, validPostId), eq(posts.clubId, club.id)))
      .limit(1);

    if (!existing) throw new AppError(404, 'POST_NOT_FOUND', '找不到指定貼文。');
    if (existing.status === 'removed_by_admin') {
      throw new AppError(403, 'POST_REMOVED_BY_ADMIN', '此貼文已遭管理員下架，無法直接編輯發布。');
    }

    const isOfficer = membership.role === 'owner' || membership.role === 'editor';
    if (!isOfficer && existing.authorUserId !== user.id) {
      throw new AppError(403, 'CLUB_OFFICER_REQUIRED', '僅社團幹部或貼文作者本人可修改此內容。');
    }

    const parsed = patchPostSchema.parse(await req.json());
    if (parsed.pinned !== undefined) {
      if (!isOfficer) {
        throw new AppError(403, 'CLUB_OFFICER_REQUIRED', '只有社團幹部可以釘選代表作。');
      }
      if (parsed.pinned && (parsed.status ?? existing.status) !== 'published') {
        throw new AppError(400, 'PIN_REQUIRES_PUBLISHED', '只有已發布的內容可以釘選為代表作。');
      }
      if (parsed.pinned && !existing.pinnedAt) {
        const [{ total }] = await db
          .select({ total: count() })
          .from(posts)
          .where(and(eq(posts.clubId, club.id), isNotNull(posts.pinnedAt)));
        if (Number(total) >= MAX_PINNED) {
          throw new AppError(400, 'PIN_LIMIT_REACHED', `代表作最多釘選 ${MAX_PINNED} 件，請先取消其中一件。`);
        }
      }
    }
    const nextStatus = parsed.status ?? existing.status;
    const nextOriginality = parsed.originality_confirmed ?? existing.originalityConfirmed;
    if (nextStatus === 'published' && !nextOriginality) {
      throw new AppError(400, 'ORIGINALITY_REQUIRED', '發布前必須勾選原創與肖像授權聲明。');
    }

    const nextHeadline = parsed.headline ?? existing.headline;
    const nextContent = parsed.content_md ?? existing.contentMd;
    let nextEmbedding = existing.embedding;
    if (
      nextStatus === 'published' &&
      (parsed.headline !== undefined || parsed.content_md !== undefined)
    ) {
      const vec = await generateEmbedding(
        `[${clubRow.universityShortName} ${club.name}] ${nextHeadline}\n${nextContent.slice(0, 1000)}`
      );
      if (vec) nextEmbedding = vec;
    }

    const now = new Date();
    const [updated] = await db
      .update(posts)
      .set({
        headline: nextHeadline,
        contentMd: nextContent,
        mediaItems: parsed.media_items ?? existing.mediaItems,
        includeInEvaluation: parsed.include_in_evaluation ?? existing.includeInEvaluation,
        originalityConfirmed: nextOriginality,
        status: nextStatus,
        publishedAt: nextStatus === 'published' ? existing.publishedAt ?? now : existing.publishedAt,
        embedding: nextEmbedding,
        pinnedAt:
          parsed.pinned === undefined ? existing.pinnedAt : parsed.pinned ? existing.pinnedAt ?? now : null,
        updatedAt: now,
      })
      .where(eq(posts.id, existing.id))
      .returning();

    return NextResponse.json({
      post: serializePublicStreamPost({
        ...updated,
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

    const { user, membership } = await requireClubMember(club.id);
    const [existing] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, validPostId), eq(posts.clubId, club.id)))
      .limit(1);
    if (!existing) throw new AppError(404, 'POST_NOT_FOUND', '找不到指定貼文。');

    const isOwner = membership.role === 'owner';
    const isOwnNrc = existing.postKind === 'nrc_moment' && existing.authorUserId === user.id;
    const isOwnDraft = existing.status === 'draft' && existing.authorUserId === user.id;
    if (!isOwner && !isOwnNrc && !isOwnDraft) {
      throw new AppError(403, 'CLUB_OWNER_REQUIRED', '僅現任社長或這篇日常的作者本人可以下架。');
    }

    const rawBody = await req.json().catch(() => ({}));
    if (!deletePostSchema.safeParse(rawBody).success) {
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
