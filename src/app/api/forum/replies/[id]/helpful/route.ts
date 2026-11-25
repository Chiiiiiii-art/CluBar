import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { forumHelpfulMarks, forumReplies } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const uuidSchema = z.string().uuid('無效的回覆識別碼。');

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const replyId = uuidSchema.parse(id);

    const [reply] = await db
      .select({ id: forumReplies.id, status: forumReplies.status })
      .from(forumReplies)
      .where(eq(forumReplies.id, replyId))
      .limit(1);
    if (!reply || reply.status !== 'published') {
      throw new AppError(404, 'REPLY_NOT_FOUND', '找不到此回覆。');
    }

    await db
      .insert(forumHelpfulMarks)
      .values({ userId: user.id, replyId })
      .onConflictDoNothing();

    return NextResponse.json({ marked_helpful_by_me: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const replyId = uuidSchema.parse(id);

    await db
      .delete(forumHelpfulMarks)
      .where(and(eq(forumHelpfulMarks.userId, user.id), eq(forumHelpfulMarks.replyId, replyId)));

    return NextResponse.json({ marked_helpful_by_me: false });
  } catch (err) {
    return handleApiError(err);
  }
}
