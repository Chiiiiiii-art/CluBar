import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { eventComments } from '@/db/schema';
import { requireEventAttendee } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { assertRateLimit } from '@/lib/rate-limit';
import { getEventRowByShortCode } from '@/lib/services/events';

const commentCreateSchema = z.object({
  content: z.string().trim().min(1, '留言不可空白').max(600, '留言最多 600 字'),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await context.params;
    const { event } = await getEventRowByShortCode(shortCode);
    const { user } = await requireEventAttendee(event.id);

    assertRateLimit(`event-comment:${user.id}:${event.id}`, 20, 60 * 60 * 1000);

    const body = await req.json();
    const { content } = commentCreateSchema.parse(body);

    const [created] = await db
      .insert(eventComments)
      .values({
        eventId: event.id,
        authorUserId: user.id,
        content,
      })
      .returning();

    return NextResponse.json(
      {
        comment: {
          id: created.id,
          display_author: user.displayName,
          avatar_url: user.avatarUrl,
          content: created.content,
          created_at: created.createdAt.toISOString(),
          is_mine: true,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
