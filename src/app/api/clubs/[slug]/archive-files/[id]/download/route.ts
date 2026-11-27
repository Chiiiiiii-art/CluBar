import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, clubArchiveFiles, clubs } from '@/db/schema';
import { requireClubArchiveAccess } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { createPrivateArchiveReadSas } from '@/lib/media/azure-blob';

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user } = await requireClubArchiveAccess(club.id);

    const [file] = await db
      .select()
      .from(clubArchiveFiles)
      .where(and(eq(clubArchiveFiles.id, id), eq(clubArchiveFiles.clubId, club.id)))
      .limit(1);

    if (!file) {
      throw new AppError(404, 'ARCHIVE_FILE_NOT_FOUND', '找不到指定評鑑檔案。');
    }

    const sas = createPrivateArchiveReadSas({
      blobPath: file.blobPath,
      downloadFilename: file.title,
    });

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'archive_file.download',
      targetType: 'archive_file',
      targetId: file.id,
      metadata: {
        club_id: club.id,
        title: file.title,
        expires_at: sas.expires_at,
      },
    });

    return NextResponse.json(sas, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
