import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  clubEvents,
  clubMemberships,
  clubQuestions,
  clubs,
  eventAlbumPhotos,
  userFollows,
  userOnboardingProfiles,
} from '@/db/schema';

/** One-line role hint shown above the home tabs. Never carries counts. */
export interface RoleStrip {
  text: string;
  href: string;
}

export interface HomeContext {
  /** The user already told us something (quiz, membership or follow): skip the "第一次來？" prompt. */
  known: boolean;
  /** First interest from the saved quiz, applied as a removable default filter. */
  savedDomainId: string | null;
  strip: RoleStrip | null;
}

export interface OfficerClubSignal {
  slug: string;
  name: string;
  hasPendingQuestion: boolean;
  hasPendingPhoto: boolean;
  hasUpcomingEvent: boolean;
}

export interface FollowedEventSignal {
  clubName: string;
  shortCode: string;
}

/** Officer to-dos beat the student hint; at most one strip. */
export function pickRoleStrip(
  officerClubs: OfficerClubSignal[],
  followedEvent: FollowedEventSignal | null
): RoleStrip | null {
  const manage = (c: OfficerClubSignal) => `/clubs/${c.slug}/manage`;
  const asked = officerClubs.find((c) => c.hasPendingQuestion);
  if (asked) return { text: `${asked.name}有新提問待回覆 · 去回覆`, href: `${manage(asked)}?tab=questions` };
  const photo = officerClubs.find((c) => c.hasPendingPhoto);
  if (photo) return { text: `${photo.name}有新照片待審 · 去看看`, href: manage(photo) };
  const idle = officerClubs.find((c) => !c.hasUpcomingEvent);
  if (idle) return { text: `${idle.name}：發下一場活動`, href: `${manage(idle)}?new=event` };
  if (followedEvent) {
    return { text: `你追蹤的${followedEvent.clubName}本週有活動`, href: `/e/${followedEvent.shortCode}` };
  }
  return null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function getHomeContext(userId: string): Promise<HomeContext> {
  const [profileRows, memberRows, followRows] = await Promise.all([
    db
      .select({ domainIds: userOnboardingProfiles.domainIds })
      .from(userOnboardingProfiles)
      .where(eq(userOnboardingProfiles.userId, userId))
      .limit(1),
    db
      .select({ clubId: clubs.id, slug: clubs.slug, name: clubs.name, role: clubMemberships.role })
      .from(clubMemberships)
      .innerJoin(clubs, eq(clubs.id, clubMemberships.clubId))
      .where(and(eq(clubMemberships.userId, userId), isNull(clubMemberships.endedAt))),
    db.select({ clubId: userFollows.clubId }).from(userFollows).where(eq(userFollows.userId, userId)),
  ]);

  const profile = profileRows[0];
  const known = Boolean(profile) || memberRows.length > 0 || followRows.length > 0;
  const savedDomainId = profile?.domainIds[0] ?? null;

  const officers = memberRows.filter((m) => m.role === 'owner' || m.role === 'editor');
  const officerIds = officers.map((m) => m.clubId);
  const studentClubIds = [
    ...new Set([...followRows.map((f) => f.clubId), ...memberRows.filter((m) => m.role !== 'alumni').map((m) => m.clubId)]),
  ];
  const now = new Date();

  const [askedRows, photoRows, upcomingRows, followedRows] = await Promise.all([
    officerIds.length
      ? db
          .selectDistinct({ clubId: clubQuestions.clubId })
          .from(clubQuestions)
          .where(and(inArray(clubQuestions.clubId, officerIds), eq(clubQuestions.status, 'pending_reply')))
      : [],
    officerIds.length
      ? db
          .selectDistinct({ clubId: clubEvents.clubId })
          .from(eventAlbumPhotos)
          .innerJoin(clubEvents, eq(clubEvents.id, eventAlbumPhotos.eventId))
          .where(and(inArray(clubEvents.clubId, officerIds), eq(eventAlbumPhotos.status, 'pending_review')))
      : [],
    officerIds.length
      ? db
          .selectDistinct({ clubId: clubEvents.clubId })
          .from(clubEvents)
          .where(
            and(
              inArray(clubEvents.clubId, officerIds),
              eq(clubEvents.status, 'open'),
              // Undated (tbd / voting) open events count as "next event planned".
              or(isNull(clubEvents.startsAt), gte(clubEvents.startsAt, now))
            )
          )
      : [],
    studentClubIds.length
      ? db
          .select({ clubName: clubs.name, shortCode: clubEvents.shortCode })
          .from(clubEvents)
          .innerJoin(clubs, eq(clubs.id, clubEvents.clubId))
          .where(
            and(
              inArray(clubEvents.clubId, studentClubIds),
              eq(clubEvents.status, 'open'),
              gte(clubEvents.startsAt, now),
              lte(clubEvents.startsAt, new Date(now.getTime() + WEEK_MS))
            )
          )
          .orderBy(asc(clubEvents.startsAt), sql`${clubEvents.id}`)
          .limit(1)
      : [],
  ]);

  const has = (rows: { clubId: string }[], id: string) => rows.some((r) => r.clubId === id);
  const strip = pickRoleStrip(
    officers.map((m) => ({
      slug: m.slug,
      name: m.name,
      hasPendingQuestion: has(askedRows, m.clubId),
      hasPendingPhoto: has(photoRows, m.clubId),
      hasUpcomingEvent: has(upcomingRows, m.clubId),
    })),
    followedRows[0] ?? null
  );

  return { known, savedDomainId, strip };
}
