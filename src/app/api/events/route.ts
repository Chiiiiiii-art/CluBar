import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { assertRateLimit, getClientIp } from '@/lib/rate-limit';
import { recordAnalyticsEvent } from '@/lib/services/analytics';

const eventSchema = z.object({
  event_type: z.enum([
    'onboarding_complete',
    'blend_create',
    'blend_join',
    'discover_stream_click',
    'discover_event_click',
    'discover_query_submit',
    'club_page_view',
    'event_rsvp_going',
    'event_promo_copy',
    'album_upload',
    'nrc_publish',
    'together_item_click',
    'official_link_click',
    'club_follow',
    'bookmark_add',
    'event_share',
    'event_publish_started',
    'event_publish_channel',
  ]),
  club_id: z.string().uuid().optional().nullable(),
  target_id: z.string().uuid().optional().nullable(),
  source_surface: z.string().trim().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    assertRateLimit(`events:analytics:${ip}`, 60, 60 * 1000);

    const rawText = await req.text();
    const body = rawText ? JSON.parse(rawText) : {};
    const parsed = eventSchema.parse(body);

    const user = await getCurrentUser().catch(() => null);

    await recordAnalyticsEvent({
      eventType: parsed.event_type,
      clubId: parsed.club_id ?? null,
      targetId: parsed.target_id ?? null,
      sourceSurface: parsed.source_surface ?? null,
      userId: user?.id ?? null,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
