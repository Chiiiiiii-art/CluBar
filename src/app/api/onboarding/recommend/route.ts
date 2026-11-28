import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors';
import { recommendOnboarding } from '@/lib/services/onboarding-blend';

const recommendSchema = z.object({
  university_id: z.string().uuid('請選擇有效的學校。'),
  goals: z.array(z.string().trim().max(40)).max(4).default([]),
  domain_ids: z.array(z.string().uuid()).max(12).default([]),
  vibe: z.string().trim().max(32).optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = recommendSchema.parse(await req.json());
    const result = await recommendOnboarding({
      universityId: parsed.university_id,
      goals: parsed.goals,
      domainIds: parsed.domain_ids,
      vibe: parsed.vibe,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
