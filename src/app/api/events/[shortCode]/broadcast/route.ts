import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { sendEventBroadcast } from '@/lib/notifications/push';
import { assertRateLimit } from '@/lib/rate-limit';
import { getEventRowByShortCode } from '@/lib/services/events';

const broadcastSchema = z.object({
  message: z.string().trim().min(4, '通知內容至少 4 個字').max(300, '通知內容最多 300 字'),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await context.params;
    const { event } = await getEventRowByShortCode(shortCode);
    const { user } = await requireClubOfficer(event.clubId);

    assertRateLimit(
      `event-broadcast:${event.id}`,
      2,
      60 * 60 * 1000,
      '同一場活動每小時最多推播 2 次臨時異動或行前通知。'
    );

    const body = await req.json();
    const { message } = broadcastSchema.parse(body);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;

    const result = await sendEventBroadcast({
      eventId: event.id,
      eventShortCode: event.shortCode,
      eventTitle: event.title,
      message,
      baseUrl,
    });

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'event_broadcast',
      targetType: 'club_event',
      targetId: event.id,
      metadata: {
        short_code: event.shortCode,
        ...result,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
