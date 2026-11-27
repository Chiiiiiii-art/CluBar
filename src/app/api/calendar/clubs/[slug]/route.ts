import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, isNotNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import { clubEvents, clubs } from '@/db/schema';
import { AppError, handleApiError } from '@/lib/errors';
import { generateUserFeedIcs } from '@/lib/calendar/ics';

/**
 * Public subscribe feed of one club's scheduled events (U-10, docs/design/04-patterns.md §2).
 * Only claimed, non-suspended clubs; drafts are never included.
 */
export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const cleanSlug = slug.replace(/\.ics$/i, '');

    const [club] = await db
      .select({ id: clubs.id, name: clubs.name })
      .from(clubs)
      .where(
        and(
          eq(clubs.slug, cleanSlug),
          ne(clubs.verificationStatus, 'suspended'),
          ne(clubs.verificationStatus, 'unclaimed_directory')
        )
      )
      .limit(1);

    if (!club) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到這個社團的行事曆。');
    }

    const rows = await db
      .select()
      .from(clubEvents)
      .where(
        and(
          eq(clubEvents.clubId, club.id),
          inArray(clubEvents.status, ['open', 'completed', 'cancelled']),
          isNotNull(clubEvents.startsAt)
        )
      )
      .orderBy(asc(clubEvents.startsAt));

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
    const ics = generateUserFeedIcs(
      rows.map((event) => ({
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
      })),
      baseUrl,
      new Date(),
      `${club.name}｜CluBar 社團活動`
    );

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="clubar-${cleanSlug}.ics"`,
        'Cache-Control': 'public, max-age=900',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
