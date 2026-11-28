import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  analyticsEvents,
  clubEvents,
  clubs,
  posts,
  type AnalyticsEventType,
} from '@/db/schema';
import { getCurrentAcademicYear } from '@/lib/academic-year';

function getLongtailSalt(): string {
  const configured = process.env.LONGTAIL_REACH_SALT?.trim();
  if (configured) return configured;
  const baseSecret = process.env.AUTH_SECRET?.trim() || 'clubar-dev-secret';
  return crypto.createHmac('sha256', baseSecret).update('longtail-reach').digest('hex');
}

export function computeStudentReachHash(
  userId: string,
  academicYear: number = getCurrentAcademicYear()
): string {
  return crypto
    .createHmac('sha256', getLongtailSalt())
    .update(`${userId}::${academicYear}`)
    .digest('hex');
}

export async function recordAnalyticsEvent(params: {
  eventType: AnalyticsEventType;
  clubId?: string | null;
  targetId?: string | null;
  universityId?: string | null;
  sourceSurface?: string | null;
  userId?: string | null;
  flowId?: string | null;
  flowElapsedMs?: number | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    let universityId = params.universityId ?? null;
    let clubId = params.clubId ?? null;

    if (params.targetId && (!clubId || !universityId)) {
      const [postRow] = await db
        .select({ clubId: posts.clubId, universityId: clubs.universityId })
        .from(posts)
        .innerJoin(clubs, eq(posts.clubId, clubs.id))
        .where(eq(posts.id, params.targetId))
        .limit(1);

      if (postRow) {
        clubId = clubId ?? postRow.clubId;
        universityId = universityId ?? postRow.universityId;
      } else {
        const [eventRow] = await db
          .select({ clubId: clubEvents.clubId, universityId: clubs.universityId })
          .from(clubEvents)
          .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
          .where(eq(clubEvents.id, params.targetId))
          .limit(1);

        if (eventRow) {
          clubId = clubId ?? eventRow.clubId;
          universityId = universityId ?? eventRow.universityId;
        }
      }
    } else if (clubId && !universityId) {
      const [clubRow] = await db
        .select({ universityId: clubs.universityId })
        .from(clubs)
        .where(eq(clubs.id, clubId))
        .limit(1);

      if (clubRow) {
        universityId = clubRow.universityId;
      }
    }

    await db.insert(analyticsEvents).values({
      eventType: params.eventType,
      universityId,
      clubId,
      targetId: params.targetId ?? null,
      sourceSurface: params.sourceSurface ?? null,
      studentReachHash: params.userId ? computeStudentReachHash(params.userId) : null,
      flowId: params.flowId ?? null,
      flowElapsedMs: params.flowElapsedMs ?? null,
    });
    if (params.flowId && Math.random() < 0.02) {
      // shortcut: opportunistic 90-day anonymisation; move to a scheduled job if traffic grows.
      await db.execute(
        sql`UPDATE analytics_events SET flow_id = NULL WHERE flow_id IS NOT NULL AND created_at < now() - interval '90 days'`
      );
    }
  } catch (err) {
    console.warn('[Analytics insert failed]', err instanceof Error ? err.message : err);
  }
}
