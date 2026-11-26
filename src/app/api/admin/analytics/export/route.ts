import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { analyticsEvents, clubs, universities } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

const exportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['csv']).default('csv'),
});

function escapeCsvCell(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
    const url = new URL(req.url);
    const parsed = exportQuerySchema.parse({
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      format: url.searchParams.get('format') || undefined,
    });

    const conditions = [];
    if (parsed.from) {
      conditions.push(gte(analyticsEvents.createdAt, new Date(`${parsed.from}T00:00:00+08:00`)));
    }
    if (parsed.to) {
      conditions.push(lte(analyticsEvents.createdAt, new Date(`${parsed.to}T23:59:59+08:00`)));
    }

    const dayExpr = sql<string>`to_char(${analyticsEvents.createdAt} AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD')`;

    const rows = await db
      .select({
        date: dayExpr,
        universityName: universities.name,
        clubName: clubs.name,
        category: clubs.category,
        eventType: analyticsEvents.eventType,
        sourceSurface: analyticsEvents.sourceSurface,
        eventCount: count(),
      })
      .from(analyticsEvents)
      .leftJoin(universities, eq(analyticsEvents.universityId, universities.id))
      .leftJoin(clubs, eq(analyticsEvents.clubId, clubs.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(
        dayExpr,
        universities.name,
        clubs.name,
        clubs.category,
        analyticsEvents.eventType,
        analyticsEvents.sourceSurface
      )
      .orderBy(sql`${dayExpr} DESC`);

    const header = [
      'date',
      'university_name',
      'club_name',
      'category',
      'event_type',
      'source_surface',
      'event_count',
    ].join(',');

    const lines = rows.map((r) =>
      [
        escapeCsvCell(r.date),
        escapeCsvCell(r.universityName ?? ''),
        escapeCsvCell(r.clubName ?? ''),
        escapeCsvCell(r.category ?? ''),
        escapeCsvCell(r.eventType),
        escapeCsvCell(r.sourceSurface ?? ''),
        escapeCsvCell(Number(r.eventCount)),
      ].join(',')
    );

    const csv = `\uFEFF${[header, ...lines].join('\n')}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="clubar-analytics-powerbi.csv"',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
