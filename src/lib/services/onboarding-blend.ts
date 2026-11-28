import crypto from 'node:crypto';
import { and, count, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  blendSessions,
  clubEvents,
  clubs,
  eventRsvps,
  interestDomains,
  posts,
  universities,
  userOnboardingProfiles,
} from '@/db/schema';
import { computeClubPulse } from '@/lib/discovery/fairness';
import { AppError } from '@/lib/errors';
import {
  serializeDiscoverEventCard,
  type DiscoverEventCardDTO,
} from '@/lib/serializers';

export interface OnboardingInput {
  universityId: string;
  goals: string[];
  domainIds: string[];
  vibe?: string;
}

export function computePersonaArchetype(params: {
  goals: string[];
  vibe?: string | null;
  domainNames?: string[];
}): string {
  const goal = params.goals[0];
  // No default vibe: the quiz no longer asks it, and a default would name everyone 實作實驗家.
  const vibe = params.vibe ?? null;
  const topDomain = params.domainNames?.[0] ?? '跨界好奇';

  if (goal === 'make_friends' && vibe === 'chill') return `暖心破冰派 · ${topDomain}`;
  if (goal === 'learn_skill' || vibe === 'hands_on') return `實作實驗家 · ${topDomain}`;
  if (goal === 'weekend_fun' || vibe === 'active') return `週末行動派 · ${topDomain}`;
  if (goal === 'earn_hours') return `生活時數收集控 · ${topDomain}`;
  return `校園探索旅人 · ${topDomain}`;
}

export function computeBlendScore(params: {
  domainsA: string[];
  goalsA: string[];
  domainsB: string[];
  goalsB: string[];
}): { matchScore: number; sharedDomainIds: string[] } {
  const setDA = new Set(params.domainsA);
  const setDB = new Set(params.domainsB);
  const sharedDomainIds = Array.from(setDA).filter((d) => setDB.has(d));
  const unionDomains = new Set([...setDA, ...setDB]).size;
  const domainOverlap = sharedDomainIds.length / Math.max(1, unionDomains);

  const setGA = new Set(params.goalsA);
  const setGB = new Set(params.goalsB);
  const sharedGoals = Array.from(setGA).filter((g) => setGB.has(g)).length;
  const unionGoals = new Set([...setGA, ...setGB]).size;
  const goalOverlap = sharedGoals / Math.max(1, unionGoals);

  const matchScore = Math.min(
    100,
    Math.max(45, Math.round(45 + 35 * domainOverlap + 20 * goalOverlap))
  );
  return { matchScore, sharedDomainIds };
}

export function generateShortCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i]! % chars.length];
  }
  return out;
}

export async function recommendOnboarding(input: OnboardingInput): Promise<{
  persona_archetype: string;
  clubs: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    university_short_name: string;
    pulse_label: string;
    is_demo: boolean;
  }[];
  events: DiscoverEventCardDTO[];
}> {
  if (!isDatabaseConfigured()) {
    return { persona_archetype: computePersonaArchetype(input), clubs: [], events: [] };
  }

  const allDomains = await db.select().from(interestDomains);
  const domainMap = new Map(allDomains.map((d) => [d.id, d.nameZh]));
  const domainNames = input.domainIds.map((id) => domainMap.get(id)).filter(Boolean) as string[];
  const persona_archetype = computePersonaArchetype({
    goals: input.goals,
    vibe: input.vibe,
    domainNames,
  });

  const clubRows = await db
    .select({
      club: clubs,
      universityShortName: universities.shortName,
    })
    .from(clubs)
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(and(eq(clubs.universityId, input.universityId), eq(clubs.verificationStatus, 'verified')))
    .limit(40);

  const targetDomainSet = new Set(input.domainIds);
  const scoredClubs = clubRows
    .map((r) => {
      const overlap = r.club.domainIds.filter((d) => targetDomainSet.has(d)).length;
      const recentBoost = r.club.lastActivityAt ? 1 : 0;
      return { ...r, overlap, score: overlap * 10 + recentBoost };
    })
    // The quiz promises to drop unrelated clubs, so zero-overlap clubs never fill the list.
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const now = new Date();
  const eventRows = await db
    .select({
      event: clubEvents,
      club: {
        id: clubs.id,
        slug: clubs.slug,
        name: clubs.name,
        isDemo: clubs.isDemo,
        universityId: clubs.universityId,
        universityShortName: universities.shortName,
      },
    })
    .from(clubEvents)
    .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(
      and(
        eq(clubs.universityId, input.universityId),
        eq(clubs.verificationStatus, 'verified'),
        eq(clubEvents.status, 'open'),
        or(sql`${clubEvents.startsAt} IS NULL`, gte(clubEvents.startsAt, now))
      )
    )
    .orderBy(desc(clubEvents.createdAt))
    .limit(20);

  const scoredEvents = eventRows
    .map((r) => {
      const overlap = r.event.domainIds.filter((d) => targetDomainSet.has(d)).length;
      const hoursBonus =
        input.goals.includes('earn_hours') && r.event.learningHoursCategory !== 'none' ? 3 : 0;
      return { ...r, overlap, score: overlap * 10 + hoursBonus };
    })
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const evIds = scoredEvents.map((e) => e.event.id);
  const goingCounts = new Map<string, number>();
  if (evIds.length > 0) {
    const rsvpCounts = await db
      .select({ eventId: eventRsvps.eventId, total: count() })
      .from(eventRsvps)
      .where(and(inArray(eventRsvps.eventId, evIds), eq(eventRsvps.status, 'going')))
      .groupBy(eventRsvps.eventId);
    for (const row of rsvpCounts) {
      goingCounts.set(row.eventId, Number(row.total));
    }
  }

  return {
    persona_archetype,
    clubs: scoredClubs.map((c) => ({
      id: c.club.id,
      slug: c.club.slug,
      name: c.club.name,
      tagline: c.club.tagline,
      university_short_name: c.universityShortName,
      pulse_label: computeClubPulse({ lastActivityAt: c.club.lastActivityAt, now }),
      is_demo: c.club.isDemo,
    })),
    events: scoredEvents.map((e) =>
      serializeDiscoverEventCard({
        ...e.event,
        goingCount: goingCounts.get(e.event.id) ?? 0,
        club: e.club,
      })
    ),
  };
}

export async function createBlendSessionForUser(params: {
  userId: string;
  universityId: string;
  domainIds?: string[];
  goals?: string[];
}) {
  const [profile] = await db
    .select()
    .from(userOnboardingProfiles)
    .where(eq(userOnboardingProfiles.userId, params.userId))
    .limit(1);

  const domainIds = params.domainIds?.length ? params.domainIds : profile?.domainIds ?? [];
  const goals = params.goals?.length ? params.goals : profile?.goals ?? [];

  if (domainIds.length > 0 || goals.length > 0) {
    const allDomains = await db.select().from(interestDomains);
    const dMap = new Map(allDomains.map((d) => [d.id, d.nameZh]));
    const archetype = computePersonaArchetype({
      goals,
      vibe: profile?.vibe,
      domainNames: domainIds.map((id) => dMap.get(id)).filter(Boolean) as string[],
    });
    await db
      .insert(userOnboardingProfiles)
      .values({
        userId: params.userId,
        selectedUniversityId: params.universityId,
        domainIds,
        goals,
        personaArchetype: archetype,
      })
      .onConflictDoUpdate({
        target: userOnboardingProfiles.userId,
        set: {
          selectedUniversityId: params.universityId,
          domainIds,
          goals,
          personaArchetype: archetype,
          updatedAt: new Date(),
        },
      });
  }

  const shortCode = generateShortCode(8);
  const [created] = await db
    .insert(blendSessions)
    .values({
      shortCode,
      creatorUserId: params.userId,
      universityId: params.universityId,
      sharedDomainIds: domainIds,
    })
    .returning();

  return created;
}

export async function joinBlendSessionForUser(params: {
  shortCode: string;
  partnerUserId: string;
}) {
  const [session] = await db
    .select()
    .from(blendSessions)
    .where(eq(blendSessions.shortCode, params.shortCode))
    .limit(1);

  if (!session) {
    throw new AppError(404, 'BLEND_NOT_FOUND', '找不到此興趣合拍邀請。');
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new AppError(410, 'BLEND_EXPIRED', '此興趣合拍邀請已過期。');
  }
  if (session.creatorUserId === params.partnerUserId) {
    throw new AppError(400, 'CANNOT_BLEND_SELF', '無法與自己建立雙人興趣合拍，請把連結分享給朋友！');
  }

  const [creatorProfile, partnerProfile] = await Promise.all([
    db
      .select()
      .from(userOnboardingProfiles)
      .where(eq(userOnboardingProfiles.userId, session.creatorUserId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(userOnboardingProfiles)
      .where(eq(userOnboardingProfiles.userId, params.partnerUserId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const domainsA = creatorProfile?.domainIds ?? session.sharedDomainIds ?? [];
  const domainsB = partnerProfile?.domainIds ?? [];
  const goalsA = creatorProfile?.goals ?? [];
  const goalsB = partnerProfile?.goals ?? [];

  const { matchScore, sharedDomainIds } = computeBlendScore({
    domainsA,
    goalsA,
    domainsB,
    goalsB,
  });

  // Recommend >= 1 smaller active club (below median post count) + matched clubs + >= 1 open event
  const clubRows = await db
    .select({
      id: clubs.id,
      domainIds: clubs.domainIds,
      lastActivityAt: clubs.lastActivityAt,
    })
    .from(clubs)
    .where(and(eq(clubs.universityId, session.universityId), eq(clubs.verificationStatus, 'verified')))
    .limit(40);

  const postCounts = await db
    .select({ clubId: posts.clubId, total: count() })
    .from(posts)
    .where(eq(posts.status, 'published'))
    .groupBy(posts.clubId);
  const countMap = new Map(postCounts.map((p) => [p.clubId, Number(p.total)]));
  const sortedCounts = clubRows.map((c) => countMap.get(c.id) ?? 0).sort((a, b) => a - b);
  const medianCount = sortedCounts[Math.floor(sortedCounts.length / 2)] ?? 3;

  const unionDomains = new Set([...domainsA, ...domainsB]);
  const sharedSet = new Set(sharedDomainIds);

  const rankedClubs = clubRows
    .map((c) => {
      const overlapShared = c.domainIds.filter((d) => sharedSet.has(d)).length;
      const overlapUnion = c.domainIds.filter((d) => unionDomains.has(d)).length;
      const isNicheActive = (countMap.get(c.id) ?? 0) <= medianCount && Boolean(c.lastActivityAt);
      return {
        id: c.id,
        isNicheActive,
        score: overlapShared * 15 + overlapUnion * 5 + (isNicheActive ? 3 : 0),
      };
    })
    .sort((a, b) => b.score - a.score);

  const nichePick = rankedClubs.find((c) => c.isNicheActive);
  const topClubs = rankedClubs.slice(0, 3).map((c) => c.id);
  if (nichePick && !topClubs.includes(nichePick.id)) {
    topClubs[Math.min(2, topClubs.length)] = nichePick.id;
  }

  const now = new Date();
  const openEvents = await db
    .select({ id: clubEvents.id, domainIds: clubEvents.domainIds })
    .from(clubEvents)
    .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
    .where(
      and(
        eq(clubs.universityId, session.universityId),
        eq(clubEvents.status, 'open'),
        eq(clubEvents.nonMembersWelcome, true),
        or(sql`${clubEvents.startsAt} IS NULL`, gte(clubEvents.startsAt, now))
      )
    )
    .limit(12);

  const rankedEvents = openEvents
    .map((ev) => ({
      id: ev.id,
      score: ev.domainIds.filter((d) => unionDomains.has(d)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((e) => e.id);

  const [updated] = await db
    .update(blendSessions)
    .set({
      partnerUserId: params.partnerUserId,
      sharedDomainIds,
      matchScore,
      recommendedClubIds: topClubs,
      recommendedEventIds: rankedEvents,
      joinedAt: now,
    })
    .where(eq(blendSessions.id, session.id))
    .returning();

  return updated;
}
