import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubs, userFollows } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { recordAnalyticsEvent } from '@/lib/services/analytics';

const uuidSchema = z.string().uuid('無效的社團識別碼。');

export async function POST(
  _req: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const user = await requireAuth();
    const { clubId } = await context.params;
    const validId = uuidSchema.parse(clubId);

    const [club] = await db
      .select({ id: clubs.id })
      .from(clubs)
      .where(eq(clubs.id, validId))
      .limit(1);
    if (!club) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    const inserted = await db
      .insert(userFollows)
      .values({ userId: user.id, clubId: validId })
      .onConflictDoNothing()
      .returning({ clubId: userFollows.clubId });

    if (inserted.length > 0) {
      await recordAnalyticsEvent({
        eventType: 'club_follow',
        clubId: validId,
        sourceSurface: 'club_page',
      });
    }

    return NextResponse.json({ followed: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const user = await requireAuth();
    const { clubId } = await context.params;
    const validId = uuidSchema.parse(clubId);

    await db
      .delete(userFollows)
      .where(and(eq(userFollows.userId, user.id), eq(userFollows.clubId, validId)));

    return NextResponse.json({ followed: false });
  } catch (err) {
    return handleApiError(err);
  }
}
