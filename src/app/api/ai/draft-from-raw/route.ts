import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubs, universities } from '@/db/schema';
import { generateVisionOrRawDraft } from '@/lib/ai/draft';
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

    assertRateLimit(
      `ai:draft:${user.id}`,
      10,
      60 * 60 * 1000,
      'AI 整理請求每小時上限為 10 次，請稍後再試或直接手動填寫。'
    );

    const result = await generateVisionOrRawDraft({
      rawText: typeof rawText === 'string' ? rawText : null,
      file: fileEntry instanceof File ? fileEntry : null,
      clubName: club.name,
      universityShortName: clubRow.universityShortName,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
