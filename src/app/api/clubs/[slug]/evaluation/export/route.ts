import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, clubs } from '@/db/schema';
import { requireClubArchiveAccess } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import {
  buildClubEvaluationPack,
  renderEvaluationMarkdown,
} from '@/lib/services/evaluation';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user } = await requireClubArchiveAccess(club.id);
    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const format = url.searchParams.get('format') === 'markdown' ? 'markdown' : 'json';

    const fromDate = fromParam && DATE_RE.test(fromParam) ? fromParam : undefined;
    const toDate = toParam && DATE_RE.test(toParam) ? toParam : undefined;

    const pack = await buildClubEvaluationPack({
      clubId: club.id,
      fromDate,
      toDate,
    });

    await db.insert(auditLogs).values({
      actorUserId: user.id,
      action: 'evaluation.export',
      targetType: 'club',
      targetId: club.id,
      metadata: {
        format,
        from_date: pack.period.from_date,
        to_date: pack.period.to_date,
      },
    });

    if (format === 'markdown') {
      const md = renderEvaluationMarkdown(pack);
      return new NextResponse(md, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${club.slug}-evaluation.md"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(pack, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
