import { sendNotification, setVapidDetails } from 'web-push';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { eventRsvps, notifications, pushSubscriptions, users } from '@/db/schema';
import { sendEmail } from '@/lib/email';

let vapidConfigured = false;

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

function ensureVapidConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@clubar.tw';
  if (!publicKey || !privateKey) return false;
  if (!vapidConfigured) {
    setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
  return true;
}

export interface NotifyUsersResult {
  recipient_count: number;
  in_app_sent: number;
  push_sent: number;
  email_fallback_sent: number;
  stale_removed: number;
}

export async function notifyUsers(params: {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  linkUrl: string;
  emailSubject?: string;
  fallbackToEmail?: boolean;
}): Promise<NotifyUsersResult> {
  const uniqueIds = Array.from(new Set(params.userIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return {
      recipient_count: 0,
      in_app_sent: 0,
      push_sent: 0,
      email_fallback_sent: 0,
      stale_removed: 0,
    };
  }

  await db.insert(notifications).values(
    uniqueIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      body: params.body,
      linkUrl: params.linkUrl,
    }))
  );

  const pushEnabled = ensureVapidConfigured();
  const pushedUserIds = new Set<string>();
  let pushSent = 0;
  let staleRemoved = 0;

  if (pushEnabled) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, uniqueIds));

    for (const sub of subs) {
      try {
        await sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: params.title,
            body: params.body,
            url: params.linkUrl,
            tag: `${params.type}-${sub.id}`,
          })
        );
        pushedUserIds.add(sub.userId);
        pushSent += 1;
      } catch (err: unknown) {
        const statusCode =
          typeof err === 'object' && err !== null && 'statusCode' in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          staleRemoved += 1;
        }
      }
    }
  }

  let emailFallbackSent = 0;
  if (params.fallbackToEmail !== false) {
    const fallbackUserIds = uniqueIds.filter((id) => !pushedUserIds.has(id));
    if (fallbackUserIds.length > 0) {
      const rows = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.id, fallbackUserIds));

      for (const row of rows) {
        try {
          await sendEmail({
            to: row.email,
            subject: params.emailSubject ?? params.title,
            text: `${params.body}\n\n查看詳情：${params.linkUrl}`,
          });
          emailFallbackSent += 1;
        } catch {
          // Non-fatal fallback
        }
      }
    }
  }

  return {
    recipient_count: uniqueIds.length,
    in_app_sent: uniqueIds.length,
    push_sent: pushSent,
    email_fallback_sent: emailFallbackSent,
    stale_removed: staleRemoved,
  };
}

export async function sendEventBroadcast(params: {
  eventId: string;
  eventShortCode: string;
  eventTitle: string;
  message: string;
  baseUrl: string;
}): Promise<NotifyUsersResult> {
  const rows = await db
    .select({ userId: eventRsvps.userId })
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.eventId, params.eventId),
        inArray(eventRsvps.status, ['going', 'interested'])
      )
    );

  const linkUrl = `${params.baseUrl.replace(/\/+$/, '')}/e/${params.eventShortCode}`;
  return notifyUsers({
    userIds: rows.map((r) => r.userId),
    type: 'event_broadcast',
    title: `活動通知｜${params.eventTitle}`,
    body: params.message,
    linkUrl,
    emailSubject: `[CluBar 活動通知] ${params.eventTitle}`,
    fallbackToEmail: true,
  });
}
