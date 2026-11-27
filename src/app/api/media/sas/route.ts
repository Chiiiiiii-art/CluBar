import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  requireAuth,
  requireClubMember,
  requireClubOfficer,
  requireEventAttendee,
  requireVerifiedStudent,
} from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { createMediaUploadSas, ensurePrivateArchiveContainer } from '@/lib/media/azure-blob';

const sasRequestSchema = z.object({
  purpose: z.enum([
    'post_image',
    'club_avatar',
    'club_cover',
    'evidence',
    'album_original',
    'album_preview',
    'short_video',
    'archive_file',
  ]),
  content_type: z.string().trim().min(3).max(120),
  size_bytes: z.number().int().positive().max(25 * 1024 * 1024),
  club_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = sasRequestSchema.parse(body);

    let scopeId: string;

    if (parsed.purpose === 'album_original' || parsed.purpose === 'album_preview') {
      if (!parsed.event_id) {
        const user = await requireAuth();
        scopeId = user.id;
      } else {
        const ctx = await requireEventAttendee(parsed.event_id);
        scopeId = ctx.event.id;
      }
    } else if (parsed.purpose === 'archive_file') {
      if (!parsed.club_id) {
        await requireVerifiedStudent();
        throw new Error('club_id is required for archive_file');
      }
      const ctx = await requireClubOfficer(parsed.club_id);
      await ensurePrivateArchiveContainer();
      scopeId = ctx.club.id;
    } else if (parsed.purpose === 'short_video' || parsed.purpose === 'post_image') {
      if (parsed.club_id) {
        const ctx = await requireClubMember(parsed.club_id);
        scopeId = ctx.club.id;
      } else {
        const user = await requireVerifiedStudent();
        scopeId = user.id;
      }
    } else if (parsed.purpose === 'club_avatar' || parsed.purpose === 'club_cover') {
      if (parsed.club_id) {
        const ctx = await requireClubOfficer(parsed.club_id);
        scopeId = ctx.club.id;
      } else {
        const user = await requireVerifiedStudent();
        scopeId = user.id;
      }
    } else {
      const user = await requireVerifiedStudent();
      scopeId = parsed.club_id ?? user.id;
    }

    const result = createMediaUploadSas({
      purpose: parsed.purpose,
      scopeId,
      contentType: parsed.content_type,
      sizeBytes: parsed.size_bytes,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
