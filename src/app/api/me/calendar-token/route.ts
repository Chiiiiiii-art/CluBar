import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { createCalendarToken } from '@/lib/calendar/ics';
import { handleApiError } from '@/lib/errors';

function buildCalendarUrls(baseUrl: string, userId: string, version: number) {
  const token = createCalendarToken(userId, version);
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const icsUrl = `${cleanBase}/api/calendar/me/${token}.ics`;
  const webcalUrl = icsUrl.replace(/^https?:\/\//i, 'webcal://');
  return { ics_url: icsUrl, webcal_url: webcalUrl, version };
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
    return NextResponse.json(buildCalendarUrls(baseUrl, user.id, user.calendarTokenVersion));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const [updated] = await db
      .update(users)
      .set({
        calendarTokenVersion: sql`${users.calendarTokenVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning({ calendarTokenVersion: users.calendarTokenVersion });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
    return NextResponse.json(
      buildCalendarUrls(baseUrl, user.id, updated?.calendarTokenVersion ?? user.calendarTokenVersion + 1)
    );
  } catch (err) {
    return handleApiError(err);
  }
}
