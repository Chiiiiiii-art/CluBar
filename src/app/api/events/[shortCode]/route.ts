import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser, requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import {
  getEventRowByShortCode,
  getPublicEventDetail,
  updateClubEvent,
} from '@/lib/services/events';
import { eventWriteSchema } from '@/lib/validators';

const patchEventSchema = eventWriteSchema
  .omit({ poll_options: true })
  .partial()
  .extend({
    status: z.enum(['draft', 'open', 'completed', 'cancelled']).optional(),
    lock_poll_option_id: z.string().uuid().optional(),
  });

export async function GET(
  _req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await context.params;
    const viewer = await getCurrentUser().catch(() => null);
    const view = await getPublicEventDetail(shortCode, viewer);
    if (!view) {
      throw new AppError(404, 'EVENT_NOT_FOUND', '找不到指定活動。');
    }
    return NextResponse.json(view);
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
    const parsed = patchEventSchema.parse(body);

    const updated = await updateClubEvent({
      eventId: event.id,
      input: parsed,
    });

    return NextResponse.json({
      event: {
        id: updated.id,
        short_code: updated.shortCode,
        title: updated.title,
        schedule_mode: updated.scheduleMode,
        starts_at: updated.startsAt?.toISOString() ?? null,
        ends_at: updated.endsAt?.toISOString() ?? null,
        location_text: updated.locationText,
        cover_media: updated.coverMedia,
        status: updated.status,
        ics_sequence: updated.icsSequence,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
