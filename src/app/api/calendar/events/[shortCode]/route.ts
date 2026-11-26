import { NextResponse } from 'next/server';
import { AppError, handleApiError } from '@/lib/errors';
import { generateEventIcs } from '@/lib/calendar/ics';
import { getEventRowByShortCode } from '@/lib/services/events';

export async function GET(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await context.params;
    const cleanCode = shortCode.replace(/\.ics$/i, '');
    const { event, club } = await getEventRowByShortCode(cleanCode);

    if (!event.startsAt) {
      throw new AppError(
        400,
        'EVENT_NOT_SCHEDULED',
        '此活動尚未確定時間（TBD／投票中），定案後即可下載行事曆檔案。'
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
    const ics = generateEventIcs(
      {
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
        clubName: club.name,
      },
      baseUrl
    );

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${cleanCode}.ics"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
