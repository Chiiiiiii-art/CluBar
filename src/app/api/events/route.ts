import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { assertRateLimit, getClientIp } from '@/lib/rate-limit';
import { recordAnalyticsEvent } from '@/lib/services/analytics';
import { clubCategorySchema } from '@/lib/validators';

const eventSchema = z.object({
  event_type: z.enum([
    'discover_card_click',
    'club_page_view',
    'official_link_click',
    'opportunity_link_click',
    'club_follow',
    'post_bookmark',
    'discover_query_submit',
  ]),
  club_id: z.string().uuid().optional().nullable(),
  post_id: z.string().uuid().optional().nullable(),
  category: clubCategorySchema.optional().nullable(),
  source_surface: z.string().trim().max(40).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    assertRateLimit(`events:${ip}`, 60, 60 * 1000);

    const rawText = await req.text();
    const body = rawText ? JSON.parse(rawText) : {};
    const parsed = eventSchema.parse(body);

    await recordAnalyticsEvent({
      eventType: parsed.event_type,
      clubId: parsed.club_id ?? null,
      postId: parsed.post_id ?? null,
      category: parsed.category ?? null,
      sourceSurface: parsed.source_surface ?? null,
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
