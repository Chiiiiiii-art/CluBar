import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubs, posts, universities } from '@/db/schema';
import { formatTaipeiDate } from '@/lib/academic-year';
import { requireClubSummaryAccess } from '@/lib/auth/guards';
import { CLUB_CATEGORIES, POST_TYPES } from '@/lib/constants';
import { AppError, handleApiError } from '@/lib/errors';

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string; year: string }> }
) {
  try {
    const { slug, year } = await context.params;
    const academicYear = z.coerce.number().int().min(100).max(150).parse(year);
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'md';
    if (format !== 'md') {
      throw new AppError(400, 'UNSUPPORTED_FORMAT', '僅支援 format=md 下載。');
    }

    const [clubRow] = await db
      .select({
        club: clubs,
        universityName: universities.name,
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.slug, slug))
      .limit(1);

    if (!clubRow) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    await requireClubSummaryAccess(clubRow.club.id);

    const rows = await db
      .select()
      .from(posts)
      .where(
        and(
          eq(posts.clubId, clubRow.club.id),
          eq(posts.academicYear, academicYear),
          eq(posts.status, 'published')
        )
      )
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt));

    const lines: string[] = [
      `# ${clubRow.universityName} ${clubRow.club.name}｜${academicYear} 學年度社團成果彙整`,
      '',
      `- 社團分類：${CLUB_CATEGORIES[clubRow.club.category].label}`,
      `- 公開主頁代碼：\`/clubs/${clubRow.club.slug}\``,
      `- 統計篇數：共 ${rows.length} 篇公開成果紀錄`,
      '',
    ];

    for (const [typeKey, typeMeta] of Object.entries(POST_TYPES)) {
      const group = rows.filter((r) => r.postType === typeKey);
      lines.push(`## ${typeMeta.label}（${group.length} 篇）`);
      lines.push('');
      if (group.length === 0) {
        lines.push('_本學年度尚無此類別紀錄_');
        lines.push('');
        continue;
      }
      for (const item of group) {
        lines.push(`### ${item.title}`);
        lines.push(
          `- 發布日期：${formatTaipeiDate(item.publishedAt ?? item.createdAt)}${
            item.tags.length > 0 ? `｜標籤：${item.tags.join('、')}` : ''
          }`
        );
        if (item.collaborators) {
          lines.push(`- 合作單位：${item.collaborators}`);
        }
        if (item.summary) {
          lines.push(`- 摘要：${item.summary}`);
        }
        if (item.externalLinks.length > 0) {
          lines.push(
            `- 外部連結：${item.externalLinks.map((l) => `[${l.label}](${l.url})`).join(' / ')}`
          );
        }
        lines.push('');
        lines.push(item.contentMd);
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    const md = lines.join('\n');
    return new NextResponse(md, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="clubar-${clubRow.club.slug}-${academicYear}.md"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
