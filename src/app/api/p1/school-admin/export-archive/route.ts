import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, clubs } from '@/db/schema';
import { requireSchoolAdmin } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { buildClubEvaluationPack } from '@/lib/services/evaluation';

const exportReqSchema = z.object({
  club_slug: z.string().trim().min(2).max(60),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = exportReqSchema.parse(body);

    const [club] = await db
      .select()
      .from(clubs)
      .where(eq(clubs.slug, parsed.club_slug))
      .limit(1);

    if (!club) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    const admin = await requireSchoolAdmin(club.universityId);
    const pack = await buildClubEvaluationPack({
      clubId: club.id,
      fromDate: parsed.from,
      toDate: parsed.to,
    });

    await db.insert(auditLogs).values({
      actorUserId: admin.id,
      action: 'p1.school_admin.export_archive',
      targetType: 'club',
      targetId: club.id,
      metadata: {
        university_id: club.universityId,
        from_date: pack.period.from_date,
        to_date: pack.period.to_date,
      },
    });

    return NextResponse.json({
      contract_version: 'p1-v1',
      pack,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
