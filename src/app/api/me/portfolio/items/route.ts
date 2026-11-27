import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubMemberships, eventRsvps } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

// U-14: hide or show a single club / event in the caller's own public footprint.
const patchItemSchema = z.object({
  kind: z.enum(['club', 'event']),
  id: z.string().uuid('無效的項目識別碼。'),
  hidden: z.boolean(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth();
    const { kind, id, hidden } = patchItemSchema.parse(await req.json());

    const updated =
      kind === 'club'
        ? await db
            .update(clubMemberships)
            .set({ hiddenFromPortfolio: hidden })
            .where(and(eq(clubMemberships.userId, user.id), eq(clubMemberships.clubId, id)))
            .returning({ id: clubMemberships.id })
        : await db
            .update(eventRsvps)
            .set({ hiddenFromPortfolio: hidden })
            .where(and(eq(eventRsvps.userId, user.id), eq(eventRsvps.eventId, id)))
            .returning({ id: eventRsvps.eventId });

    if (updated.length === 0) {
      throw new AppError(404, 'PORTFOLIO_ITEM_NOT_FOUND', '找不到這筆足跡，可能已被移除。');
    }
    return NextResponse.json({ ok: true, kind, id, hidden });
  } catch (err) {
    return handleApiError(err);
  }
}
