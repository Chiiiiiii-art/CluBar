import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { eventComments } from '@/db/schema';
import { requireAuth, requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { getEventRowByShortCode } from '@/lib/services/events';

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ shortCode: string; id: string }> }
) {
  try {
    const user = await requireAuth();
    const { shortCode, id } = await context.params;
    const { event } = await getEventRowByShortCode(shortCode);

    const [comment] = await db
      .select()
      .from(eventComments)
      .where(and(eq(eventComments.id, id), eq(eventComments.eventId, event.id)))
      .limit(1);

    if (!comment || comment.isDeleted) {
      throw new AppError(404, 'COMMENT_NOT_FOUND', '找不到指定留言。');
    }

    if (comment.authorUserId !== user.id) {
      await requireClubOfficer(event.clubId);
    }

    await db
      .update(eventComments)
      .set({
        isDeleted: true,
        deletedBy: user.id,
      })
      .where(eq(eventComments.id, comment.id));

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
