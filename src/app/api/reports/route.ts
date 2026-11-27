import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { reports } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { assertRateLimit } from '@/lib/rate-limit';

const reportSchema = z.object({
  target_type: z.enum([
    'post',
    'event',
    'event_comment',
    'album_photo',
    'club_question',
    'together_item',
    'club',
  ]),
  target_id: z.string().uuid('無效的檢舉目標識別碼。'),
  reason: z.enum([
    'impersonation',
    'copyright',
    'privacy_leak',
    'portrait_violation',
    'inappropriate',
    'other',
  ]),
  detail: z.string().trim().max(1000).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    assertRateLimit(`reports:${user.id}`, 10, 10 * 60 * 1000, '檢舉次數過於頻繁，請稍候再試。');

    const body = await req.json();
    const parsed = reportSchema.parse(body);

    const [created] = await db
      .insert(reports)
      .values({
        reporterUserId: user.id,
        targetType: parsed.target_type,
        targetId: parsed.target_id,
        reason: parsed.reason,
        detail: parsed.detail?.trim() || null,
      })
      .returning();

    return NextResponse.json(
      {
        report: {
          id: created.id,
          status: created.status,
          created_at: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
