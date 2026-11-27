import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, clubMemberships, clubs, notifications, posts } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const uuidSchema = z.string().uuid('無效的貼文識別碼。');

const restoreSchema = z.object({
  action: z.literal('restore'),
  note: z.string().trim().max(400).default(''),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await context.params;
    const postId = uuidSchema.parse(id);

    const body = await req.json();
    const parsed = restoreSchema.parse(body);

    await db.transaction(async (tx) => {
      const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).limit(1);
      if (!post) throw new AppError(404, 'POST_NOT_FOUND', '找不到指定貼文。');

      const [club] = await tx.select().from(clubs).where(eq(clubs.id, post.clubId)).limit(1);

      await tx
        .update(posts)
        .set({
          status: 'published',
          originalityConfirmed: true,
          publishedAt: post.publishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId));

      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: 'post.restored_by_admin',
        targetType: 'post',
        targetId: postId,
        metadata: { previous_status: post.status, note: parsed.note },
      });

      if (club) {
        const owners = await tx
          .select({ userId: clubMemberships.userId })
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.clubId, club.id),
              eq(clubMemberships.role, 'owner'),
              isNull(clubMemberships.endedAt)
            )
          );

        for (const owner of owners) {
          await tx.insert(notifications).values({
            userId: owner.userId,
            type: 'moderation_notice',
            title: `貼文已復原公開：${post.headline}`,
            body: parsed.note
              ? `管理員已協助復原貼文（備註：${parsed.note}）。`
              : '管理員已協助將該篇貼文復原為公開狀態。',
            linkUrl: `/posts/${post.id}`,
          });
        }
      }
    });

    return NextResponse.json({ status: 'published' });
  } catch (err) {
    return handleApiError(err);
  }
}
