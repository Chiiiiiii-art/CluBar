import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { clubArchiveFiles, clubEvents, clubs, universities } from '@/db/schema';
import { requireSchoolAdmin } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestedUniId = url.searchParams.get('university_id') ?? undefined;
    const admin = await requireSchoolAdmin(requestedUniId);

    const targetUniId = requestedUniId ?? admin.managedUniversityId;
    if (!targetUniId) {
      throw new AppError(400, 'UNIVERSITY_ID_REQUIRED', '請指定欲查詢的大專校院識別碼。');
    }

    const [uni] = await db
      .select({ id: universities.id, code: universities.code, name: universities.name })
      .from(universities)
      .where(eq(universities.id, targetUniId))
      .limit(1);

    if (!uni) {
      throw new AppError(404, 'UNIVERSITY_NOT_FOUND', '找不到指定學校。');
    }

    const [clubStats, eventStats, archiveStats] = await Promise.all([
      db
        .select({
          verificationStatus: clubs.verificationStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(clubs)
        .where(eq(clubs.universityId, uni.id))
        .groupBy(clubs.verificationStatus),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(clubEvents)
        .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
        .where(eq(clubs.universityId, uni.id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(clubArchiveFiles)
        .innerJoin(clubs, eq(clubArchiveFiles.clubId, clubs.id))
        .where(eq(clubs.universityId, uni.id)),
    ]);

    return NextResponse.json({
      contract_version: 'p1-v1',
      university: uni,
      clubs_by_status: Object.fromEntries(clubStats.map((r) => [r.verificationStatus, r.count])),
      total_events: eventStats[0]?.count ?? 0,
      total_archive_files: archiveStats[0]?.count ?? 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
