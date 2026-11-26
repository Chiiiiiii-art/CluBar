import { NextResponse } from 'next/server';
import { z } from 'zod';
import { queryDiscoverEventsSemantic, runDiscoverQuery } from '@/lib/discovery/service';
import { handleApiError } from '@/lib/errors';
import { assertRateLimit, getClientIp } from '@/lib/rate-limit';
import { recordAnalyticsEvent } from '@/lib/services/analytics';

const discoverQuerySchema = z.object({
  query: z.string().trim().min(2, '請輸入至少 2 個字的需求描述。').max(300, '需求描述請勿超過 300 字。'),
  university_id: z.string().uuid().optional().nullable(),
  tab: z.enum(['stream', 'events']).default('stream'),
  exclude_ids: z.array(z.string().uuid()).max(240).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    assertRateLimit(`discover:query:${ip}`, 15, 60 * 1000, '探索次數過於頻繁，請稍候再試。');

    const body = await req.json();
    const parsed = discoverQuerySchema.parse(body);

    const result =
      parsed.tab === 'events'
        ? await queryDiscoverEventsSemantic({
            query: parsed.query,
            universityId: parsed.university_id ?? undefined,
            excludeIds: parsed.exclude_ids,
          })
        : await runDiscoverQuery({
            query: parsed.query,
            universityId: parsed.university_id ?? undefined,
            excludeIds: parsed.exclude_ids,
          });

    await recordAnalyticsEvent({
      eventType: 'discover_query_submit',
      universityId: parsed.university_id ?? null,
      sourceSurface: `discover_${parsed.tab}`,
    });

    return NextResponse.json({ ...result, tab: parsed.tab });
  } catch (err) {
    return handleApiError(err);
  }
}
