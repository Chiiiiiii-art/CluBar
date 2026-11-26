import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { clubEvents, clubs } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { createClubEvent } from '@/lib/services/events';
import { eventWriteSchema } from '@/lib/validators';

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db
      .select({ id: clubs.id, slug: clubs.slug, name: clubs.name })
      .from(clubs)
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!club) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    const rows = await db
      .select()
      .from(clubEvents)
      .where(eq(clubEvents.clubId, club.id))
      .orderBy(desc(clubEvents.createdAt))
      .limit(50);

    return NextResponse.json({
      events: rows.map((e) => ({
        id: e.id,
        short_code: e.shortCode,
        title: e.title,
        summary: e.summary,
        theme_preset: e.themePreset,
        cover_media: e.coverMedia,
        schedule_mode: e.scheduleMode,
        starts_at: e.startsAt?.toISOString() ?? null,
        ends_at: e.endsAt?.toISOString() ?? null,
        location_text: e.locationText,
        beginner_friendly: e.beginnerFriendly,
        non_members_welcome: e.nonMembersWelcome,
        campus_only: e.campusOnly,
        fee_ntd: e.feeNtd,
        learning_hours_category: e.learningHoursCategory,
        learning_hours_count: Number(e.learningHoursCount || 0),
        status: e.status,
        ics_sequence: e.icsSequence,
        include_in_evaluation: e.includeInEvaluation,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db
      .select({ id: clubs.id, slug: clubs.slug, universityId: clubs.universityId })
      .from(clubs)
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!club) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    const { user } = await requireClubOfficer(club.id);
    const body = await req.json();
    const parsed = eventWriteSchema.parse(body);

    const created = await createClubEvent({
      clubId: club.id,
      clubSlug: club.slug,
      universityId: club.universityId,
      userId: user.id,
      input: parsed,
    });

    return NextResponse.json(
      {
        event: {
          id: created.id,
          short_code: created.shortCode,
          title: created.title,
          status: created.status,
          ics_sequence: created.icsSequence,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
