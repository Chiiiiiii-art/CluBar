import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { userBookmarks } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { recordAnalyticsEvent } from '@/lib/services/analytics';

const bookmarkSchema = z.object({
  target_type: z.enum(['post', 'event']),
  target_id: z.string().uuid('無效的收藏目標識別碼。'),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const parsed = bookmarkSchema.parse(await req.json());

    const inserted = await db
      .insert(userBookmarks)
      .values({
        userId: user.id,
        targetType: parsed.target_type,
        targetId: parsed.target_id,
      })
      .onConflictDoNothing()
      .returning({ targetId: userBookmarks.targetId });

    if (inserted.length > 0) {
      await recordAnalyticsEvent({
        eventType: 'bookmark_add',
        targetId: parsed.target_id,
        sourceSurface: parsed.target_type,
        userId: user.id,
      });
    }

    return NextResponse.json({ bookmarked: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth();
    const parsed = bookmarkSchema.parse(await req.json());

    await db
      .delete(userBookmarks)
      .where(
        and(
          eq(userBookmarks.userId, user.id),
          eq(userBookmarks.targetType, parsed.target_type),
          eq(userBookmarks.targetId, parsed.target_id)
        )
      );

    return NextResponse.json({ bookmarked: false });
  } catch (err) {
    return handleApiError(err);
  }
}
