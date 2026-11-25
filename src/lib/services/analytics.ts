import { eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  analyticsEvents,
  clubs,
  posts,
  type AnalyticsEventType,
  type ClubCategory,
} from '@/db/schema';

export async function recordAnalyticsEvent(params: {
  eventType: AnalyticsEventType;
  clubId?: string | null;
  postId?: string | null;
  universityId?: string | null;
  category?: ClubCategory | null;
  sourceSurface?: string | null;
}): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    let universityId = params.universityId ?? null;
    let clubId = params.clubId ?? null;
    let category = params.category ?? null;

    if (params.postId && (!clubId || !universityId || !category)) {
      const [postRow] = await db
        .select({
          clubId: posts.clubId,
          universityId: clubs.universityId,
          category: clubs.category,
        })
        .from(posts)
        .innerJoin(clubs, eq(posts.clubId, clubs.id))
        .where(eq(posts.id, params.postId))
        .limit(1);

      if (postRow) {
        clubId = clubId ?? postRow.clubId;
        universityId = universityId ?? postRow.universityId;
        category = category ?? postRow.category;
      }
    } else if (clubId && (!universityId || !category)) {
      const [clubRow] = await db
        .select({
          universityId: clubs.universityId,
          category: clubs.category,
        })
        .from(clubs)
        .where(eq(clubs.id, clubId))
        .limit(1);

      if (clubRow) {
        universityId = universityId ?? clubRow.universityId;
        category = category ?? clubRow.category;
      }
    }

    await db.insert(analyticsEvents).values({
      eventType: params.eventType,
      universityId,
      clubId,
      postId: params.postId ?? null,
      category,
      sourceSurface: params.sourceSurface ?? null,
    });
  } catch (err) {
    console.warn('[Analytics insert failed]', err instanceof Error ? err.message : err);
  }
}
