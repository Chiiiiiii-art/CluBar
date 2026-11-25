import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { posts, userBookmarks } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { recordAnalyticsEvent } from '@/lib/services/analytics';

const uuidSchema = z.string().uuid('無效的貼文識別碼。');

export async function POST(
  _req: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const user = await requireAuth();
    const { postId } = await context.params;
    const validId = uuidSchema.parse(postId);

    const [post] = await db
      .select({ id: posts.id, status: posts.status })
      .from(posts)
      .where(eq(posts.id, validId))
      .limit(1);
    if (!post || post.status !== 'published') {
      throw new AppError(404, 'POST_NOT_FOUND', '找不到此公開貼文。');
    }

    const inserted = await db
      .insert(userBookmarks)
      .values({ userId: user.id, postId: validId })
      .onConflictDoNothing()
      .returning({ postId: userBookmarks.postId });

    if (inserted.length > 0) {
      await recordAnalyticsEvent({
        eventType: 'post_bookmark',
        postId: validId,
        sourceSurface: 'post_detail',
      });
    }

    return NextResponse.json({ bookmarked: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const user = await requireAuth();
    const { postId } = await context.params;
    const validId = uuidSchema.parse(postId);

    await db
      .delete(userBookmarks)
      .where(and(eq(userBookmarks.userId, user.id), eq(userBookmarks.postId, validId)));

    return NextResponse.json({ bookmarked: false });
  } catch (err) {
    return handleApiError(err);
  }
}
