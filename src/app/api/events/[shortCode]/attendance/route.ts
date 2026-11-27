import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { eventRsvps, users } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { getEventRowByShortCode } from '@/lib/services/events';

const attendancePatchSchema = z.object({
  user_id: z.string().uuid(),
  attended: z.boolean(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await context.params;
    const { event } = await getEventRowByShortCode(shortCode);
    await requireClubOfficer(event.clubId);

    const rows = await db
      .select({
        userId: eventRsvps.userId,
        displayName: users.displayName,
        displayAlias: eventRsvps.displayAlias,
        status: eventRsvps.status,
        privacyMode: eventRsvps.privacyMode,
        attended: eventRsvps.attended,
        attendedAt: eventRsvps.attendedAt,
      })
      .from(eventRsvps)
      .innerJoin(users, eq(eventRsvps.userId, users.id))
      .where(and(eq(eventRsvps.eventId, event.id), eq(eventRsvps.status, 'going')))
      .orderBy(asc(eventRsvps.createdAt));

    return NextResponse.json({
      attendees: rows.map((r) => ({
        user_id: r.userId,
        display_name: r.displayAlias?.trim() || r.displayName,
        status: r.status,
        privacy_mode: r.privacyMode,
        attended: r.attended,
        attended_at: r.attendedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await context.params;
    const { event } = await getEventRowByShortCode(shortCode);
    await requireClubOfficer(event.clubId);

    const body = await req.json();
    const { user_id, attended } = attendancePatchSchema.parse(body);

    const [updated] = await db
      .update(eventRsvps)
      .set({
        attended,
        attendedAt: attended ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(eventRsvps.eventId, event.id), eq(eventRsvps.userId, user_id)))
      .returning();

    if (!updated) {
      throw new AppError(404, 'RSVP_NOT_FOUND', '找不到該參加者的報名紀錄。');
    }

    return NextResponse.json({
      user_id: updated.userId,
      attended: updated.attended,
      attended_at: updated.attendedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
