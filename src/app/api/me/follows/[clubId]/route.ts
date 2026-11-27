import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubs, userFollows } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { recordAnalyticsEvent } from '@/lib/services/analytics';

const uuidSchema = z.string().uuid('無效的社團識別碼。');
const followSchema = z.object({
  follow_mode: z.enum(['all', 'events_only']).default('all'),
});

async function upsertFollow(req: Request, clubId: string) {
  const user = await requireAuth();
  const validId = uuidSchema.parse(clubId);
  const raw = await req.json().catch(() => ({}));
  const parsed = followSchema.parse(raw);

  const [club] = await db
    .select({ id: clubs.id })
    .from(clubs)
    .where(eq(clubs.id, validId))
    .limit(1);
  if (!club) {
    throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
  }

  const [existing] = await db
    .select()
    .from(userFollows)
    .where(and(eq(userFollows.userId, user.id), eq(userFollows.clubId, validId)))
    .limit(1);

  if (existing) {
    await db
      .update(userFollows)
      .set({ followMode: parsed.follow_mode })
      .where(and(eq(userFollows.userId, user.id), eq(userFollows.clubId, validId)));
  } else {
    await db.insert(userFollows).values({
      userId: user.id,
      clubId: validId,
      followMode: parsed.follow_mode,
    });
    await recordAnalyticsEvent({
      eventType: 'club_follow',
      clubId: validId,
      sourceSurface: 'club_page',
      userId: user.id,
    });
  }

  return NextResponse.json({ followed: true, follow_mode: parsed.follow_mode });
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await context.params;
    return await upsertFollow(req, clubId);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await context.params;
    return await upsertFollow(req, clubId);
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
