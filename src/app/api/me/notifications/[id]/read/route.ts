import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

const uuidSchema = z.string().uuid('無效的通知識別碼。');

export async function PATCH(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const validId = uuidSchema.parse(id);

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, validId), eq(notifications.userId, user.id)));

    return NextResponse.json({ read: true });
  } catch (err) {
    return handleApiError(err);
  }
}
