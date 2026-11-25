import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { clubMemberships, clubs, forumThreads, universities } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { serializeForumThread } from '@/lib/serializers';
import { TogetherClient, type OfficerClubOption } from '@/components/TogetherClient';

export const dynamic = 'force-dynamic';

export default async function TogetherPage() {
  const dbReady = isDatabaseConfigured();
  const currentUser = dbReady ? await getCurrentUser() : null;

  let officerClubs: OfficerClubOption[] = [];
  if (dbReady && currentUser?.campusVerifiedAt) {
    const memberships = await db
      .select({
        club_id: clubs.id,
        club_name: clubs.name,
        university_short_name: universities.shortName,
        default_title: clubMemberships.title,
      })
      .from(clubMemberships)
      .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(
        and(
          eq(clubMemberships.userId, currentUser.id),
          isNull(clubMemberships.endedAt),
          inArray(clubMemberships.role, ['owner', 'editor']),
          eq(clubs.verificationStatus, 'verified')
        )
      );
    officerClubs = memberships;
  }

  const limit = 20;
  const rows = dbReady
    ? await db
        .select({
          thread: forumThreads,
          club: {
            id: clubs.id,
            slug: clubs.slug,
            name: clubs.name,
            isDemo: clubs.isDemo,
            universityShortName: universities.shortName,
          },
        })
        .from(forumThreads)
        .innerJoin(clubs, eq(forumThreads.clubId, clubs.id))
        .innerJoin(universities, eq(clubs.universityId, universities.id))
        .where(eq(forumThreads.status, 'published'))
        .orderBy(desc(forumThreads.lastActivityAt))
        .limit(limit + 1)
        .catch(() => [])
    : [];

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? items[items.length - 1]?.thread.lastActivityAt.toISOString() ?? null
    : null;

  return (
    <TogetherClient
      initialThreads={items.map((r) => serializeForumThread({ ...r.thread, club: r.club }))}
      initialNextCursor={nextCursor}
      officerClubs={officerClubs}
      isLoggedIn={Boolean(currentUser)}
    />
  );
}
