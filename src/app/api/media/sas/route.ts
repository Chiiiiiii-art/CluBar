import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireVerifiedStudent } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { createMediaUploadSas } from '@/lib/media/azure-blob';

const sasRequestSchema = z.object({
  purpose: z.enum(['post_image', 'club_avatar', 'club_cover', 'evidence']),
  content_type: z.enum(['image/webp', 'image/jpeg', 'image/png']),
  size_bytes: z.number().int().positive().max(5 * 1024 * 1024),
  club_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireVerifiedStudent();
    const body = await req.json();
    const parsed = sasRequestSchema.parse(body);

    const result = createMediaUploadSas({
      purpose: parsed.purpose,
      scopeId: parsed.club_id ?? user.id,
      contentType: parsed.content_type,
      sizeBytes: parsed.size_bytes,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
