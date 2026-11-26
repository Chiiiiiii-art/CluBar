import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { recordAnalyticsEvent } from '@/lib/services/analytics';
import { joinBlendSessionForUser } from '@/lib/services/onboarding-blend';

const codeSchema = z.string().trim().min(4).max(16);

export async function POST(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const user = await requireAuth();
    const { code } = await context.params;
    const validCode = codeSchema.parse(code);

    const updated = await joinBlendSessionForUser({
      shortCode: validCode,
      partnerUserId: user.id,
    });

    await recordAnalyticsEvent({
      eventType: 'blend_join',
      universityId: updated.universityId,
      targetId: updated.id,
      sourceSurface: 'blend_page',
      userId: user.id,
    });

    return NextResponse.json({
      blend: {
        short_code: updated.shortCode,
        match_score: updated.matchScore,
        shared_domain_ids: updated.sharedDomainIds,
        recommended_club_ids: updated.recommendedClubIds,
        recommended_event_ids: updated.recommendedEventIds,
        joined_at: updated.joinedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
