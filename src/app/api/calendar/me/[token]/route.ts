import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { clubEvents, clubs, eventRsvps, users } from '@/db/schema';
import { AppError, handleApiError } from '@/lib/errors';
import { generateUserFeedIcs, verifyCalendarToken } from '@/lib/calendar/ics';

export async function GET(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const cleanToken = token.replace(/\.ics$/i, '');
    const parsed = verifyCalendarToken(cleanToken);
    if (!parsed) {
      throw new AppError(401, 'INVALID_CALENDAR_TOKEN', '個人行事曆訂閱連結無效或已失效。');
    }

    const [user] = await db
      .select({ id: users.id, calendarTokenVersion: users.calendarTokenVersion })
      .from(users)
      .where(eq(users.id, parsed.userId))
      .limit(1);

    if (!user || user.calendarTokenVersion !== parsed.version) {
      throw new AppError(401, 'REVOKED_CALENDAR_TOKEN', '此行事曆訂閱連結已重設，請重新複製最新連結。');
    }

    const rows = await db
      .select({
        event: clubEvents,
        clubName: clubs.name,
      })
      .from(eventRsvps)
      .innerJoin(clubEvents, eq(eventRsvps.eventId, clubEvents.id))
      .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
      .where(
        and(
          eq(eventRsvps.userId, user.id),
          // Include "有興趣" too so pending plans show up in the personal feed (U-10).
          inArray(eventRsvps.status, ['going', 'interested']),
          isNotNull(clubEvents.startsAt)
        )
      )
      .orderBy(asc(clubEvents.startsAt));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
    const ics = generateUserFeedIcs(
      rows.map(({ event, clubName }) => ({
        id: event.id,
        shortCode: event.shortCode,
        title: event.title,
        summary: event.summary,
        locationText: event.locationText,
        preEventNotes: event.preEventNotes,
        scheduleMode: event.scheduleMode,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        icsSequence: event.icsSequence,
        clubName,
      })),
      baseUrl
    );

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="clubar-my-events.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
