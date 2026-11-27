import crypto from 'node:crypto';
import type { EventScheduleMode, EventStatus } from '@/db/schema';

export interface IcsEventInput {
  id: string;
  shortCode: string;
  title: string;
  summary: string;
  locationText: string;
  preEventNotes: string | null;
  scheduleMode: EventScheduleMode;
  startsAt: Date | null;
  endsAt: Date | null;
  status: EventStatus;
  icsSequence: number;
  clubName?: string;
}

function getCalendarSecret(): string {
  return (
    process.env.CALENDAR_TOKEN_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    'clubar-dev-calendar-secret'
  );
}

export function createCalendarToken(userId: string, version: number): string {
  const payload = Buffer.from(`${userId}:${version}`, 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getCalendarSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyCalendarToken(token: string): { userId: string; version: number } | null {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac('sha256', getCalendarSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const [userId, versionStr] = decoded.split(':');
    const version = Number(versionStr);
    if (!userId || !Number.isInteger(version) || version < 1) return null;
    return { userId, version };
  } catch {
    return null;
  }
}

export function formatIcsUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function escapeIcsText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * RFC 5545 §3.1: fold lines at max 75 octets without splitting UTF-8 characters.
 */
export function foldIcsLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out: string[] = [];
  let current = '';
  let maxOctets = 75;

  for (const ch of line) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (Buffer.byteLength(current, 'utf8') + chBytes > maxOctets) {
      out.push(current);
      current = ` ${ch}`;
      maxOctets = 75;
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out.join('\r\n');
}

function buildVeventLines(
  event: IcsEventInput,
  baseUrl: string,
  now: Date
): string[] {
  if (!event.startsAt) return [];
  const endsAt = event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const eventUrl = `${baseUrl.replace(/\/+$/, '')}/e/${event.shortCode}`;
  const descParts = [
    event.clubName ? `主辦：${event.clubName}` : null,
    event.summary || null,
    event.preEventNotes ? `行前提醒：${event.preEventNotes}` : null,
    `活動頁：${eventUrl}`,
  ].filter(Boolean);

  const rawLines = [
    'BEGIN:VEVENT',
    `UID:event-${event.id}@clubar.tw`,
    `DTSTAMP:${formatIcsUtc(now)}`,
    `DTSTART:${formatIcsUtc(event.startsAt)}`,
    `DTEND:${formatIcsUtc(endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(event.locationText)}`,
    `DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`,
    `URL:${eventUrl}`,
    `SEQUENCE:${Math.max(0, event.icsSequence)}`,
    `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
  ];

  return rawLines.map(foldIcsLine);
}

export function generateEventIcs(
  event: IcsEventInput,
  baseUrl: string,
  now = new Date()
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CluBar//Campus Club Events//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...buildVeventLines(event, baseUrl, now),
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

export function generateUserFeedIcs(
  events: IcsEventInput[],
  baseUrl: string,
  now = new Date(),
  calendarName = 'CluBar 我的社團活動'
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CluBar//My Club Calendar//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine(`X-WR-CALNAME:${escapeIcsText(calendarName)}`),
    'X-WR-TIMEZONE:Asia/Taipei',
  ];

  for (const ev of events) {
    lines.push(...buildVeventLines(ev, baseUrl, now));
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function buildGoogleCalendarUrl(event: IcsEventInput, baseUrl: string): string | null {
  if (!event.startsAt) return null;
  const endsAt = event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', event.title);
  url.searchParams.set('dates', `${formatIcsUtc(event.startsAt)}/${formatIcsUtc(endsAt)}`);
  url.searchParams.set('location', event.locationText);
  url.searchParams.set(
    'details',
    [event.summary, `${baseUrl.replace(/\/+$/, '')}/e/${event.shortCode}`]
      .filter(Boolean)
      .join('\n')
  );
  return url.toString();
}

export function buildOutlookCalendarUrl(event: IcsEventInput, baseUrl: string): string | null {
  if (!event.startsAt) return null;
  const endsAt = event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  url.searchParams.set('path', '/calendar/action/compose');
  url.searchParams.set('rru', 'addevent');
  url.searchParams.set('subject', event.title);
  url.searchParams.set('startdt', event.startsAt.toISOString());
  url.searchParams.set('enddt', endsAt.toISOString());
  url.searchParams.set('location', event.locationText);
  url.searchParams.set(
    'body',
    [event.summary, `${baseUrl.replace(/\/+$/, '')}/e/${event.shortCode}`]
      .filter(Boolean)
      .join('\n')
  );
  return url.toString();
}
