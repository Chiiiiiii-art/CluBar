import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireClubOfficer } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { curateAlbumPhoto, getEventRowByShortCode } from '@/lib/services/events';

const curateSchema = z.object({
  action: z.enum(['approve', 'feature', 'reject']),
  include_in_evaluation: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ shortCode: string; photoId: string }> }
) {
  try {
    const { shortCode, photoId } = await context.params;
    const { event } = await getEventRowByShortCode(shortCode);
    const { user } = await requireClubOfficer(event.clubId);

    const body = await req.json();
    const parsed = curateSchema.parse(body);

    const updated = await curateAlbumPhoto({
      event,
      photoId,
      officerUserId: user.id,
      action: parsed.action,
      includeInEvaluation: parsed.include_in_evaluation,
    });

    return NextResponse.json({
      photo: {
        id: updated.id,
        status: updated.status,
        include_in_evaluation: updated.includeInEvaluation,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
