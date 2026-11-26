import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDiscoverEvents } from '@/lib/discovery/service';
import { handleApiError } from '@/lib/errors';

const eventsQuerySchema = z.object({
  university_id: z.string().uuid().optional(),
  domain_id: z.string().uuid().optional(),
  date_range: z.enum(['this_week', 'this_month', 'all']).optional(),
  hours_type: z.enum(['none', 'art', 'life', 'service']).optional(),
  free_only: z.enum(['true', 'false']).optional(),
  beginner_only: z.enum(['true', 'false']).optional(),
  non_member_only: z.enum(['true', 'false']).optional(),
  voting_only: z.enum(['true', 'false']).optional(),
  exclude_ids: z.string().max(9000).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = eventsQuerySchema.parse({
      university_id: url.searchParams.get('university_id') || undefined,
      domain_id: url.searchParams.get('domain_id') || undefined,
      date_range: url.searchParams.get('date_range') || undefined,
      hours_type: url.searchParams.get('hours_type') || undefined,
      free_only: url.searchParams.get('free_only') || undefined,
      beginner_only: url.searchParams.get('beginner_only') || undefined,
      non_member_only: url.searchParams.get('non_member_only') || undefined,
      voting_only: url.searchParams.get('voting_only') || undefined,
      exclude_ids: url.searchParams.get('exclude_ids') || undefined,
    });

    const excludeIds = (parsed.exclude_ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => z.string().uuid().safeParse(s).success);

    const data = await getDiscoverEvents({
      universityId: parsed.university_id,
      domainId: parsed.domain_id,
      dateRange: parsed.date_range,
      hoursType: parsed.hours_type,
      freeOnly: parsed.free_only === 'true',
      beginnerOnly: parsed.beginner_only === 'true',
      nonMemberOnly: parsed.non_member_only === 'true',
      votingOnly: parsed.voting_only === 'true',
      excludeIds,
    });

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
