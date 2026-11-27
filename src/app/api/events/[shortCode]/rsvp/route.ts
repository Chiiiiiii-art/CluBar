import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { getEventRowByShortCode, upsertEventRsvp } from '@/lib/services/events';

const rsvpSchema = z.object({
  status: z.enum(['going', 'interested', 'cancelled']),
  privacy_mode: z
    .enum(['public_to_attendees', 'private_count_only'])
    .default('public_to_attendees'),
  display_alias: z.string().trim().max(40).optional().nullable(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const user = await requireAuth();
    const { shortCode } = await context.params;
    const { event, club } = await getEventRowByShortCode(shortCode);

    const body = await req.json();
    const parsed = rsvpSchema.parse(body);

    const saved = await upsertEventRsvp({
      event,
      clubUniversityId: club.universityId,
      user,
      status: parsed.status,
      privacyMode: parsed.privacy_mode,
      displayAlias: parsed.display_alias,
    });

    return NextResponse.json({
      rsvp: {
        status: saved.status,
        privacy_mode: saved.privacyMode,
        display_alias: saved.displayAlias,
        attended: saved.attended,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
