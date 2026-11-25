import { redirect } from 'next/navigation';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { signOut } from '@/auth';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubHandovers,
  clubMemberships,
  clubs,
  notifications,
  posts,
  universities,
  userBookmarks,
  userFollows,
  users,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { MeClient, type MePageData } from '@/components/MeClient';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  if (!isDatabaseConfigured()) redirect('/login?callbackUrl=/me');

  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/me');

  const [uniRow] = user.universityId
    ? await db
        .select({ name: universities.name })
        .from(universities)
        .where(eq(universities.id, user.universityId))
        .limit(1)
    : [];

  const membershipRows = await db
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
    );

  const pendingHandoverRows = await db
    .select({
      id: clubHandovers.id,
      clubName: clubs.name,
      clubSlug: clubs.slug,
      fromUserName: users.displayName,
      note: clubHandovers.note,
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
    );

  const notifRows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(25);

  const bookmarkRows = await db
    .select({
      postId: posts.id,
      title: posts.title,
      clubName: clubs.name,
      clubSlug: clubs.slug,
      universityShortName: universities.shortName,
    })
    .from(userBookmarks)
    .innerJoin(posts, eq(userBookmarks.postId, posts.id))
    .innerJoin(clubs, eq(posts.clubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(and(eq(userBookmarks.userId, user.id), eq(posts.status, 'published')))
    .orderBy(desc(userBookmarks.createdAt));

  const followRows = await db
    .select({
      clubId: clubs.id,
      slug: clubs.slug,
      name: clubs.name,
      universityShortName: universities.shortName,
      category: clubs.category,
    })
    .from(userFollows)
    .innerJoin(clubs, eq(userFollows.clubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(eq(userFollows.userId, user.id))
    .orderBy(desc(userFollows.createdAt));

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
      note: h.note,
      expiresAt: h.expiresAt.toISOString(),
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
    bookmarks: bookmarkRows,
    follows: followRows,
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
