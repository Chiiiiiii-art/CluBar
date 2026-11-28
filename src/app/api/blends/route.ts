import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { universities } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { recordAnalyticsEvent } from '@/lib/services/analytics';
import { createBlendSessionForUser } from '@/lib/services/onboarding-blend';

const createBlendSchema = z.object({
  university_id: z.string().uuid().optional(),
  domain_ids: z.array(z.string().uuid()).max(12).optional(),
  goals: z.array(z.string().trim().max(40)).max(4).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const raw = await req.json().catch(() => ({}));
    const parsed = createBlendSchema.parse(raw);

    let universityId = parsed.university_id ?? user.universityId ?? null;
    if (!universityId) {
      const [firstUni] = await db.select({ id: universities.id }).from(universities).limit(1);
      universityId = firstUni?.id ?? null;
    }
    if (!universityId) {
      throw new AppError(400, 'UNIVERSITY_REQUIRED', '請先選擇大專校院再建立興趣合拍卡。');
    }

    const created = await createBlendSessionForUser({
      userId: user.id,
      universityId,
      domainIds: parsed.domain_ids,
      goals: parsed.goals,
    });

    await recordAnalyticsEvent({
      eventType: 'blend_create',
      universityId,
      targetId: created.id,
      sourceSurface: 'onboarding_blend',
      userId: user.id,
    });

    return NextResponse.json(
      {
        blend: {
          short_code: created.shortCode,
          url: `/blend/${created.shortCode}`,
          og_story_url: `/api/og/blend/${created.shortCode}?format=story`,
          expires_at: created.expiresAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
