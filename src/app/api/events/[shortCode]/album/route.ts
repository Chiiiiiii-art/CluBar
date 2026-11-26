import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { eventAlbumPhotos } from '@/db/schema';
import { requireEventAttendee } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { recordAnalyticsEvent } from '@/lib/services/analytics';
import { getEventRowByShortCode } from '@/lib/services/events';
import { mediaUrlSchema } from '@/lib/validators';

const albumUploadSchema = z.object({
  original_url: mediaUrlSchema,
  preview_url: mediaUrlSchema,
  width: z.number().int().positive().max(12000),
  height: z.number().int().positive().max(12000),
  mime_type: z.string().trim().min(3).max(80),
  size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
  caption: z.string().trim().max(120).optional().nullable(),
  consent_confirmed: z.literal(true, {
    errorMap: () => ({ message: '上傳前須勾選確認未侵犯他人肖像權並同意社團收錄。' }),
  }),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  try {
    const { shortCode } = await context.params;
    const { event, club } = await getEventRowByShortCode(shortCode);
    const { user } = await requireEventAttendee(event.id);

    const body = await req.json();
    const parsed = albumUploadSchema.parse(body);

    const [photo] = await db
      .insert(eventAlbumPhotos)
      .values({
        eventId: event.id,
        uploaderUserId: user.id,
        originalUrl: parsed.original_url,
        previewUrl: parsed.preview_url,
        width: parsed.width,
        height: parsed.height,
        mimeType: parsed.mime_type,
        sizeBytes: parsed.size_bytes,
        caption: parsed.caption ?? null,
        status: 'pending_review',
        consentConfirmed: true,
        includeInEvaluation: false,
      })
      .returning();

    await recordAnalyticsEvent({
      eventType: 'album_upload',
      clubId: club.id,
      targetId: photo.id,
      universityId: club.universityId,
      sourceSurface: 'event_album',
      userId: user.id,
    });

    return NextResponse.json(
      {
        photo: {
          id: photo.id,
          preview_url: photo.previewUrl,
          original_url: photo.originalUrl,
          width: photo.width,
          height: photo.height,
          caption: photo.caption,
          status: photo.status,
          created_at: photo.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
