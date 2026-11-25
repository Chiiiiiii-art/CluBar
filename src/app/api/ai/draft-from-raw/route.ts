import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubs, universities } from '@/db/schema';
import { extractRawMaterialText, generatePostDraftFromRaw } from '@/lib/ai/draft';
import { requireClubRole } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { assertRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const clubId = z.string().uuid('請提供有效的社團識別碼。').parse(formData.get('club_id'));
    const rawText = formData.get('raw_text');
    const fileEntry = formData.get('file');

    const [clubRow] = await db
      .select({
        club: clubs,
        universityShortName: universities.shortName,
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.id, clubId))
      .limit(1);

    if (!clubRow) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    const { user, club } = await requireClubRole(clubRow.club.id, ['owner', 'editor']);

    assertRateLimit(`ai:draft:${user.id}`, 10, 60 * 1000, 'AI 整理請求過於頻繁，請稍後再試。');

    const { text, warnings } = await extractRawMaterialText({
      rawText: typeof rawText === 'string' ? rawText : null,
      file: fileEntry instanceof File ? fileEntry : null,
    });

    const draft = await generatePostDraftFromRaw({
      text,
      clubName: club.name,
      universityShortName: clubRow.universityShortName,
    });

    return NextResponse.json({
      draft,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
