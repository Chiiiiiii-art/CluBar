import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '@/db';
import {
  clubEvents,
  clubMemberships,
  clubs,
  eventRsvps,
  interestDomains,
  posts,
  togetherItems,
  universities,
  users,
  type ClubMemberRole,
  type LearningHoursCategory,
  type PortfolioVisibility,
} from '@/db/schema';
import type { AuthenticatedUser } from '@/lib/auth/guards';

export interface UserPortfolioDTO {
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  university_short_name: string | null;
  portfolio_visibility: PortfolioVisibility;
  talent_discovery_opt_in: boolean;
  alumni_ping_enabled: boolean;
  alumni_expertise_tags: string[];
  learning_hours_total: number;
  learning_hours_by_category: Record<LearningHoursCategory, number>;
  clubs: {
    club_id: string;
    slug: string;
    name: string;
    university_short_name: string;
    role: ClubMemberRole;
    title: string | null;
    is_active: boolean;
  }[];
  attended_events: {
    id: string;
    short_code: string;
    title: string;
    club_name: string;
    starts_at: string | null;
    attended: boolean;
    learning_hours_category: LearningHoursCategory;
    learning_hours_count: number;
  }[];
  works_and_moments: {
    id: string;
    source: 'post' | 'together';
    kind_label: string;
    title: string;
    club_name: string;
    club_slug: string;
    url: string;
    created_at: string;
  }[];
}

export function canViewPortfolio(params: {
  visibility: PortfolioVisibility;
  targetUserId: string;
  targetUniversityId: string | null;
  viewer: AuthenticatedUser | null;
}): boolean {
  if (params.visibility === 'public') return true;
  if (!params.viewer) return false;
  if (params.viewer.id === params.targetUserId) return true;
  if (params.viewer.platformRole === 'platform_admin') return true;
  if (params.visibility === 'private') return false;
  // campus_only
  return Boolean(
    params.viewer.campusVerifiedAt &&
      params.targetUniversityId &&
      params.viewer.universityId === params.targetUniversityId
  );
}

export async function buildUserPortfolio(params: {
  targetUserId: string;
  viewer: AuthenticatedUser | null;
}): Promise<{ accessDenied: boolean; portfolio: UserPortfolioDTO | null }> {
  const [target] = await db
    .select({
      user: {
        id: users.id,
        displayName: users.displayName,
        handle: users.handle,
        avatarUrl: users.avatarUrl,
        universityId: users.universityId,
        portfolioVisibility: users.portfolioVisibility,
        talentDiscoveryOptIn: users.talentDiscoveryOptIn,
        alumniPingEnabled: users.alumniPingEnabled,
        alumniExpertiseTags: users.alumniExpertiseTags,
      },
      universityShortName: universities.shortName,
    })
    .from(users)
    .leftJoin(universities, eq(users.universityId, universities.id))
    .where(eq(users.id, params.targetUserId))
    .limit(1);

  if (!target) {
    return { accessDenied: false, portfolio: null };
  }

  const allowed = canViewPortfolio({
    visibility: target.user.portfolioVisibility,
    targetUserId: target.user.id,
    targetUniversityId: target.user.universityId,
    viewer: params.viewer,
  });

  if (!allowed) {
    return { accessDenied: true, portfolio: null };
  }

  const [memRows, rsvpRows, postRows, togetherRows] = await Promise.all([
    db
      .select({
        clubId: clubs.id,
        slug: clubs.slug,
        name: clubs.name,
        uniShort: universities.shortName,
        role: clubMemberships.role,
        title: clubMemberships.title,
        endedAt: clubMemberships.endedAt,
      })
      .from(clubMemberships)
      .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubMemberships.userId, target.user.id))
      .orderBy(desc(clubMemberships.joinedAt)),
    db
      .select({
        event: clubEvents,
        clubName: clubs.name,
        attended: eventRsvps.attended,
      })
      .from(eventRsvps)
      .innerJoin(clubEvents, eq(eventRsvps.eventId, clubEvents.id))
      .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
      .where(and(eq(eventRsvps.userId, target.user.id), eq(eventRsvps.status, 'going')))
      .orderBy(desc(clubEvents.startsAt))
      .limit(30),
    db
      .select({
        id: posts.id,
        postKind: posts.postKind,
        headline: posts.headline,
        publishedAt: posts.publishedAt,
        createdAt: posts.createdAt,
        clubName: clubs.name,
        clubSlug: clubs.slug,
      })
      .from(posts)
      .innerJoin(clubs, eq(posts.clubId, clubs.id))
      .where(and(eq(posts.authorUserId, target.user.id), eq(posts.status, 'published')))
      .orderBy(desc(posts.publishedAt))
      .limit(20),
    db
      .select({
        id: togetherItems.id,
        itemType: togetherItems.itemType,
        title: togetherItems.title,
        createdAt: togetherItems.createdAt,
        domainName: interestDomains.nameZh,
        clubName: clubs.name,
        clubSlug: clubs.slug,
      })
      .from(togetherItems)
      .innerJoin(interestDomains, eq(togetherItems.domainId, interestDomains.id))
      .innerJoin(clubs, eq(togetherItems.clubId, clubs.id))
      .where(
        and(
          eq(togetherItems.authorUserId, target.user.id),
          eq(togetherItems.status, 'published')
        )
      )
      .orderBy(desc(togetherItems.createdAt))
      .limit(20),
  ]);

  const byCat: Record<LearningHoursCategory, number> = {
    none: 0,
    art: 0,
    life: 0,
    service: 0,
  };
  let totalHours = 0;

  const attendedEvents = rsvpRows.map(({ event, clubName, attended }) => {
    const hrs = Number(event.learningHoursCount || 0);
    if (attended && event.learningHoursCategory !== 'none' && hrs > 0) {
      byCat[event.learningHoursCategory] += hrs;
      totalHours += hrs;
    }
    return {
      id: event.id,
      short_code: event.shortCode,
      title: event.title,
      club_name: clubName,
      starts_at: event.startsAt?.toISOString() ?? null,
      attended,
      learning_hours_category: event.learningHoursCategory,
      learning_hours_count: hrs,
    };
  });

  const worksAndMoments: UserPortfolioDTO['works_and_moments'] = [
    ...postRows.map((p) => ({
      id: p.id,
      source: 'post' as const,
      kind_label:
        p.postKind === 'wip_work'
          ? '實作作品'
          : p.postKind === 'nrc_moment'
            ? '社員日常'
            : '社團精華',
      title: p.headline,
      club_name: p.clubName,
      club_slug: p.clubSlug,
      url: `/posts/${p.id}`,
      created_at: (p.publishedAt ?? p.createdAt).toISOString(),
    })),
    ...togetherRows.map((t) => ({
      id: t.id,
      source: 'together' as const,
      kind_label: `一起聚 · ${t.domainName}`,
      title: t.title,
      club_name: t.clubName,
      club_slug: t.clubSlug,
      url: `/together/${t.id}`,
      created_at: t.createdAt.toISOString(),
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    accessDenied: false,
    portfolio: {
      handle: target.user.handle,
      display_name: target.user.displayName,
      avatar_url: target.user.avatarUrl,
      university_short_name: target.universityShortName ?? null,
      portfolio_visibility: target.user.portfolioVisibility,
      talent_discovery_opt_in: target.user.talentDiscoveryOptIn,
      alumni_ping_enabled: target.user.alumniPingEnabled,
      alumni_expertise_tags: target.user.alumniExpertiseTags ?? [],
      learning_hours_total: totalHours,
      learning_hours_by_category: byCat,
      clubs: memRows.map((m) => ({
        club_id: m.clubId,
        slug: m.slug,
        name: m.name,
        university_short_name: m.uniShort,
        role: m.role,
        title: m.title,
        is_active: m.endedAt === null,
      })),
      attended_events: attendedEvents,
      works_and_moments: worksAndMoments,
    },
  };
}
