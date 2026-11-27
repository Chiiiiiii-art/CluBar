import { redirect } from 'next/navigation';
import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { signOut } from '@/auth';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubEvents,
  clubHandovers,
  clubMemberships,
  clubs,
  coClubLinks,
  notifications,
  posts,
  universities,
  userBookmarks,
  userFollows,
  users,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { buildUserPortfolio } from '@/lib/services/portfolio';
import { MeClient, type MePageData } from '@/components/MeClient';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  if (!isDatabaseConfigured()) redirect('/login?callbackUrl=/me');

  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/me');

  const [
    [uniRow],
    membershipRows,
    pendingHandoverRows,
    notifRows,
    postBookmarkRows,
    eventBookmarkRows,
    followRows,
    portfolioRes,
  ] = await Promise.all([
    user.universityId
      ? db
          .select({ name: universities.name })
          .from(universities)
          .where(eq(universities.id, user.universityId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        clubId: clubs.id,
        slug: clubs.slug,
        name: clubs.name,
        universityShortName: universities.shortName,
        category: clubs.category,
        role: clubMemberships.role,
        title: clubMemberships.title,
        verificationStatus: clubs.verificationStatus,
      })
      .from(clubMemberships)
      .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(
        and(
          eq(clubMemberships.userId, user.id),
          or(isNull(clubMemberships.endedAt), eq(clubMemberships.role, 'alumni'))
        )
      ),
    db
      .select({
        id: clubHandovers.id,
        clubName: clubs.name,
        clubSlug: clubs.slug,
        fromUserName: users.displayName,
        pendingNoteJson: clubHandovers.pendingNoteJson,
        expiresAt: clubHandovers.expiresAt,
      })
      .from(clubHandovers)
      .innerJoin(clubs, eq(clubHandovers.clubId, clubs.id))
      .innerJoin(users, eq(clubHandovers.fromUserId, users.id))
      .where(
        and(
          eq(clubHandovers.toUserId, user.id),
          eq(clubHandovers.status, 'pending'),
          gt(clubHandovers.expiresAt, new Date())
        )
      ),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(25),
    db
      .select({
        postId: posts.id,
        title: posts.headline,
        clubName: clubs.name,
        clubSlug: clubs.slug,
        universityShortName: universities.shortName,
      })
      .from(userBookmarks)
      .innerJoin(posts, eq(userBookmarks.targetId, posts.id))
      .innerJoin(clubs, eq(posts.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(
        and(
          eq(userBookmarks.userId, user.id),
          eq(userBookmarks.targetType, 'post'),
          eq(posts.status, 'published')
        )
      )
      .orderBy(desc(userBookmarks.createdAt)),
    db
      .select({
        eventId: clubEvents.id,
        shortCode: clubEvents.shortCode,
        title: clubEvents.title,
        clubName: clubs.name,
        universityShortName: universities.shortName,
      })
      .from(userBookmarks)
      .innerJoin(clubEvents, eq(userBookmarks.targetId, clubEvents.id))
      .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(and(eq(userBookmarks.userId, user.id), eq(userBookmarks.targetType, 'event')))
      .orderBy(desc(userBookmarks.createdAt)),
    db
      .select({
        clubId: clubs.id,
        slug: clubs.slug,
        name: clubs.name,
        universityShortName: universities.shortName,
        category: clubs.category,
        followMode: userFollows.followMode,
      })
      .from(userFollows)
      .innerJoin(clubs, eq(userFollows.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(userFollows.userId, user.id))
      .orderBy(desc(userFollows.createdAt)),
    buildUserPortfolio({ targetUserId: user.id, viewer: user }),
  ]);

  const officerClubIds = membershipRows
    .filter((m) => m.role === 'owner' || m.role === 'editor')
    .map((m) => m.clubId);

  const pendingCoClubRows =
    officerClubIds.length > 0
      ? await db
          .select({
            id: coClubLinks.id,
            targetType: coClubLinks.targetType,
            targetId: coClubLinks.targetId,
            hostClubName: clubs.name,
          })
          .from(coClubLinks)
          .innerJoin(clubs, eq(coClubLinks.hostClubId, clubs.id))
          .where(
            and(
              inArray(coClubLinks.partnerClubId, officerClubIds),
              eq(coClubLinks.status, 'pending')
            )
          )
      : [];

  const data: MePageData = {
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      campusEmail: user.campusEmail,
      universityName: uniRow?.name ?? null,
      campusVerifiedAt: user.campusVerifiedAt ? user.campusVerifiedAt.toISOString() : null,
      platformRole: user.platformRole,
    },
    memberships: membershipRows,
    pendingHandovers: pendingHandoverRows.map((h) => ({
      id: h.id,
      clubName: h.clubName,
      clubSlug: h.clubSlug,
      fromUserName: h.fromUserName,
      note: h.pendingNoteJson?.venue_tips || null,
      expiresAt: h.expiresAt.toISOString(),
    })),
    pendingCoClubInvitations: pendingCoClubRows.map((c) => ({
      id: c.id,
      targetType: c.targetType,
      hostClubName: c.hostClubName,
    })),
    notifications: notifRows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      linkUrl: n.linkUrl,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    })),
    bookmarks: [
      ...postBookmarkRows,
      ...eventBookmarkRows.map((e) => ({
        postId: e.eventId,
        title: `活動：${e.title}`,
        clubName: e.clubName,
        clubSlug: `../e/${e.shortCode}`,
        universityShortName: e.universityShortName,
      })),
    ],
    follows: followRows,
    portfolio: portfolioRes.portfolio,
  };

  return (
    <MeClient
      data={data}
      signOutAction={async () => {
        'use server';
        await signOut({ redirectTo: '/' });
      }}
    />
  );
}
