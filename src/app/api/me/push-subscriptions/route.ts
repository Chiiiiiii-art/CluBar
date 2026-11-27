import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { getVapidPublicKey } from '@/lib/notifications/push';

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(10).max(500),
    auth: z.string().min(8).max(500),
  }),
});

const deleteSchema = z.object({
  endpoint: z.string().url().max(1000).optional(),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));

    return NextResponse.json({
      vapid_public_key: getVapidPublicKey(),
      subscribed_count: count,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = subscribeSchema.parse(body);

    const [saved] = await db
      .insert(pushSubscriptions)
      .values({
        userId: user.id,
        endpoint: parsed.endpoint,
        p256dh: parsed.keys.p256dh,
        auth: parsed.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: user.id,
          p256dh: parsed.keys.p256dh,
          auth: parsed.keys.auth,
        },
      })
      .returning();

    return NextResponse.json({ id: saved.id, subscribed: true }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth();
    const raw = await req.text();
    const parsed = raw ? deleteSchema.parse(JSON.parse(raw)) : {};

    if (parsed.endpoint) {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, user.id),
            eq(pushSubscriptions.endpoint, parsed.endpoint)
          )
        );
    } else {
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
    }

    return NextResponse.json({ subscribed: false });
  } catch (err) {
    return handleApiError(err);
  }
}
