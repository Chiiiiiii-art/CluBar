import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDiscoverFeed } from '@/lib/discovery/service';
import { handleApiError } from '@/lib/errors';
import { clubCategorySchema } from '@/lib/validators';

const feedQuerySchema = z.object({
  category: clubCategorySchema.optional(),
  tag: z.string().trim().min(1).max(32).optional(),
  university_id: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = feedQuerySchema.parse({
      category: url.searchParams.get('category') || undefined,
      tag: url.searchParams.get('tag') || undefined,
      university_id: url.searchParams.get('university_id') || undefined,
    });

    const data = await getDiscoverFeed({
      category: parsed.category,
      tag: parsed.tag,
      universityId: parsed.university_id,
    });

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
