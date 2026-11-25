import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { reports, users } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

const querySchema = z.object({
  status: z
    .enum(['open', 'resolved_takedown', 'resolved_keep', 'resolved_suspend_club'])
    .default('open'),
});

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      status: url.searchParams.get('status') || undefined,
    });

    const rows = await db
      .select({
        report: reports,
        reporterName: users.displayName,
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterUserId, users.id))
      .where(eq(reports.status, parsed.status))
      .orderBy(asc(reports.createdAt));

    return NextResponse.json({
      reports: rows.map((r) => ({
        id: r.report.id,
        target_type: r.report.targetType,
        target_id: r.report.targetId,
        reason: r.report.reason,
        detail: r.report.detail,
        status: r.report.status,
        reporter_name: r.reporterName,
        resolution_note: r.report.resolutionNote,
        resolved_at: r.report.resolvedAt ? r.report.resolvedAt.toISOString() : null,
        created_at: r.report.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
