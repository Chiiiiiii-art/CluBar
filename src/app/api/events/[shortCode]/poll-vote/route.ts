import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { eventPollOptions, eventPollVotes } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { getEventRowByShortCode } from '@/lib/services/events';

const voteSchema = z.object({
  option_id: z.string().uuid(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const user = await requireAuth();
    const { shortCode } = await context.params;
    const { event, club } = await getEventRowByShortCode(shortCode);

    if (event.status === 'cancelled' || event.status === 'completed') {
      throw new AppError(400, 'EVENT_CLOSED', '此活動已結束或取消，投票已關閉。');
    }
    if (event.campusOnly && (!user.campusVerifiedAt || user.universityId !== club.universityId)) {
      throw new AppError(403, 'CAMPUS_ONLY_EVENT', '此活動投票僅限該校已驗證學生參與。');
    }

    const body = await req.json();
    const { option_id } = voteSchema.parse(body);

    const [option] = await db
      .select()
      .from(eventPollOptions)
      .where(and(eq(eventPollOptions.id, option_id), eq(eventPollOptions.eventId, event.id)))
      .limit(1);

    if (!option) {
      throw new AppError(404, 'POLL_OPTION_NOT_FOUND', '找不到指定的投票選項。');
    }

    const [existing] = await db
      .select()
      .from(eventPollVotes)
      .where(and(eq(eventPollVotes.optionId, option.id), eq(eventPollVotes.userId, user.id)))
      .limit(1);

    let voted = false;
    if (existing) {
      await db
        .delete(eventPollVotes)
        .where(and(eq(eventPollVotes.optionId, option.id), eq(eventPollVotes.userId, user.id)));
      voted = false;
    } else {
      await db.insert(eventPollVotes).values({
        optionId: option.id,
        userId: user.id,
      });
      voted = true;
    }

    return NextResponse.json({ option_id: option.id, voted });
  } catch (err) {
    return handleApiError(err);
  }
}
