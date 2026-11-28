import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDiscoverStream } from '@/lib/discovery/service';
import { handleApiError } from '@/lib/errors';

const querySchema = z.object({
  university_id: z.string().uuid().optional(),
  // Comma-separated: posts/events matching any listed domain.
  domain_id: z.string().max(300).optional(),
  exclude_ids: z.string().max(9000).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      university_id: url.searchParams.get('university_id') || undefined,
      domain_id: url.searchParams.get('domain_id') || undefined,
      exclude_ids: url.searchParams.get('exclude_ids') || undefined,
    });

    const excludeIds = (parsed.exclude_ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => z.string().uuid().safeParse(s).success);

    const data = await getDiscoverStream({
      universityId: parsed.university_id,
      domainIds: (parsed.domain_id ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => z.string().uuid().safeParse(s).success)
        .slice(0, 6),
      excludeIds,
    });

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
