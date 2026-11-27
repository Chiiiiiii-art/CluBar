import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, clubArchiveFiles, clubs } from '@/db/schema';
import { requireClubArchiveAccess, requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const createArchiveSchema = z.object({
  archive_category: z.enum([
    'meeting_minutes',
    'finance_ledger',
    'equipment_inventory',
    'evaluation_evidence',
    'other',
  ]),
  title: z.string().trim().min(2, '檔案標題至少 2 個字').max(120),
  description: z.string().trim().max(500).optional().nullable(),
  blob_path: z
    .string()
    .trim()
    .min(5)
    .max(300)
    .refine(
      (p) => p.startsWith('archive/') && !p.includes('..'),
      '私密歸檔路徑必須位於私人儲存容器的 archive/ 目錄。'
    ),
  mime_type: z.string().trim().min(3).max(120),
  size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '發生日期須為 YYYY-MM-DD 格式'),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    await requireClubArchiveAccess(club.id);

    const files = await db
      .select({
        id: clubArchiveFiles.id,
        archiveCategory: clubArchiveFiles.archiveCategory,
        title: clubArchiveFiles.title,
        description: clubArchiveFiles.description,
        mimeType: clubArchiveFiles.mimeType,
        sizeBytes: clubArchiveFiles.sizeBytes,
        occurredOn: clubArchiveFiles.occurredOn,
        retentionUntil: clubArchiveFiles.retentionUntil,
        createdAt: clubArchiveFiles.createdAt,
      })
      .from(clubArchiveFiles)
      .where(eq(clubArchiveFiles.clubId, club.id))
      .orderBy(desc(clubArchiveFiles.occurredOn), desc(clubArchiveFiles.createdAt));

    return NextResponse.json({
      files: files.map((f) => ({
        id: f.id,
        archive_category: f.archiveCategory,
        title: f.title,
        description: f.description,
        mime_type: f.mimeType,
        size_bytes: f.sizeBytes,
        occurred_on: f.occurredOn,
        retention_until: f.retentionUntil.toISOString(),
        created_at: f.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user } = await requireClubOfficer(club.id);
    const body = await req.json();
    const parsed = createArchiveSchema.parse(body);

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(clubArchiveFiles)
        .values({
          clubId: club.id,
          uploadedBy: user.id,
          archiveCategory: parsed.archive_category,
          title: parsed.title,
          description: parsed.description ?? null,
          blobPath: parsed.blob_path,
          mimeType: parsed.mime_type,
          sizeBytes: parsed.size_bytes,
          occurredOn: parsed.occurred_on,
        })
        .returning();

      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        action: 'archive_file.uploaded',
        targetType: 'archive_file',
        targetId: row.id,
        metadata: {
          club_id: club.id,
          archive_category: row.archiveCategory,
          occurred_on: row.occurredOn,
        },
      });

      return row;
    });

    return NextResponse.json(
      {
        file: {
          id: created.id,
          archive_category: created.archiveCategory,
          title: created.title,
          occurred_on: created.occurredOn,
          created_at: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
