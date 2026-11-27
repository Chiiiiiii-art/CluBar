import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubEvents,
  clubHandoverNotes,
  clubHandovers,
  clubMemberships,
  clubs,
  posts,
  universities,
  users,
  type ClubMemberRole,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { ClubManageClient, type ManageClubData } from '@/components/ClubManageClient';

export const dynamic = 'force-dynamic';

export default async function ClubManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/clubs/${slug}/manage`)}`);
  }

  const [clubRow] = await db
    .select({ club: clubs, universityName: universities.name })
    .from(clubs)
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(eq(clubs.slug, slug))
    .limit(1);

  if (!clubRow) notFound();

  const [myMem] = await db
    .select()
    .from(clubMemberships)
    .where(
      and(
        eq(clubMemberships.clubId, clubRow.club.id),
        eq(clubMemberships.userId, user.id),
        or(isNull(clubMemberships.endedAt), eq(clubMemberships.role, 'alumni'))
      )
    )
    .limit(1);

  const myRole: ManageClubData['myRole'] | null = myMem
    ? (myMem.role as ClubMemberRole)
    : user.platformRole === 'platform_admin'
      ? 'platform_admin'
      : null;

  if (!myRole || myRole === 'member') {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center">
        <h1 className="text-lg font-extrabold text-slate-900">您沒有此社團的管理後台權限</h1>
        <p className="mt-2 text-sm text-slate-600">
          僅現任社長、現任幹部或歷屆校友（只讀檢視評鑑檔案）可進入社團管理後台。
        </p>
        <Link
          href={`/clubs/${slug}`}
          className="mt-4 inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white"
        >
          返回社團門面
        </Link>
      </div>
    );
  }

  const [postRows, eventRows, memberRows, pendingHandoverRows, noteRows] = await Promise.all([
    db.select().from(posts).where(eq(posts.clubId, clubRow.club.id)).orderBy(desc(posts.updatedAt)),
    db
      .select()
      .from(clubEvents)
      .where(eq(clubEvents.clubId, clubRow.club.id))
      .orderBy(desc(clubEvents.createdAt)),
    db
      .select({
        userId: clubMemberships.userId,
        displayName: users.displayName,
        role: clubMemberships.role,
        title: clubMemberships.title,
        endedAt: clubMemberships.endedAt,
      })
      .from(clubMemberships)
      .innerJoin(users, eq(clubMemberships.userId, users.id))
      .where(eq(clubMemberships.clubId, clubRow.club.id))
      .orderBy(desc(clubMemberships.joinedAt)),
    db
      .select({
        id: clubHandovers.id,
        toUserId: clubHandovers.toUserId,
        toUserName: users.displayName,
        expiresAt: clubHandovers.expiresAt,
      })
      .from(clubHandovers)
      .innerJoin(users, eq(clubHandovers.toUserId, users.id))
      .where(
        and(
          eq(clubHandovers.clubId, clubRow.club.id),
          eq(clubHandovers.status, 'pending'),
          gt(clubHandovers.expiresAt, new Date())
        )
      )
      .limit(1),
    db
      .select()
      .from(clubHandoverNotes)
      .where(eq(clubHandoverNotes.clubId, clubRow.club.id))
      .orderBy(desc(clubHandoverNotes.createdAt))
      .limit(5),
  ]);

  const data: ManageClubData = {
    club: {
      id: clubRow.club.id,
      slug: clubRow.club.slug,
      name: clubRow.club.name,
      category: clubRow.club.category,
      tagline: clubRow.club.tagline,
      description: clubRow.club.description,
      verificationStatus: clubRow.club.verificationStatus,
      universityName: clubRow.universityName,
    },
    myRole,
    posts: postRows.map((p) => ({
      id: p.id,
      postKind: p.postKind,
      headline: p.headline,
      status: p.status,
      includeInEvaluation: p.includeInEvaluation,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    })),
    events: eventRows.map((e) => ({
      id: e.id,
      shortCode: e.shortCode,
      title: e.title,
      scheduleMode: e.scheduleMode,
      startsAt: e.startsAt ? e.startsAt.toISOString() : null,
      status: e.status,
      includeInEvaluation: e.includeInEvaluation,
    })),
    members: memberRows.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      title: m.title,
      endedAt: m.endedAt ? m.endedAt.toISOString() : null,
    })),
    pendingHandover: pendingHandoverRows[0]
      ? {
          id: pendingHandoverRows[0].id,
          toUserName: pendingHandoverRows[0].toUserName,
          expiresAt: pendingHandoverRows[0].expiresAt.toISOString(),
        }
      : null,
    handoverNotes: noteRows.map((n) => ({
      id: n.id,
      venueTips: n.venueTips,
      hoursAndDeadlines: n.hoursAndDeadlines,
      contactsAndVendors: n.contactsAndVendors,
      createdAt: n.createdAt.toISOString(),
    })),
  };

  return <ClubManageClient data={data} />;
}
