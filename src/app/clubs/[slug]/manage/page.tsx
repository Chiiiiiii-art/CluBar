import { notFound, redirect } from 'next/navigation';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubHandovers,
  clubMemberships,
  clubOpportunities,
  clubs,
  posts,
  universities,
  users,
} from '@/db/schema';
import { getCurrentAcademicYear } from '@/lib/academic-year';
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
    .select({
      club: clubs,
      universityName: universities.name,
    })
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
    ? myMem.role
    : user.platformRole === 'platform_admin'
      ? 'platform_admin'
      : null;

  if (!myRole) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center">
        <h1 className="text-lg font-extrabold text-slate-900">您沒有此社團的管理權限</h1>
        <p className="mt-2 text-sm text-slate-600">
          僅現任社長、現任幹部或歷屆校友（只讀檢視）可進入社團管理後台。
        </p>
      </div>
    );
  }

  const [postRows, oppRows, memberRows, pendingHandoverRows] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(eq(posts.clubId, clubRow.club.id))
      .orderBy(desc(posts.updatedAt)),
    db
      .select()
      .from(clubOpportunities)
      .where(eq(clubOpportunities.clubId, clubRow.club.id))
      .orderBy(desc(clubOpportunities.createdAt)),
    db
      .select({
        userId: clubMemberships.userId,
        displayName: users.displayName,
        role: clubMemberships.role,
        title: clubMemberships.title,
        joinedAt: clubMemberships.joinedAt,
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
        note: clubHandovers.note,
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
  ]);

  const data: ManageClubData = {
    club: {
      id: clubRow.club.id,
      slug: clubRow.club.slug,
      name: clubRow.club.name,
      category: clubRow.club.category,
      tagline: clubRow.club.tagline,
      description: clubRow.club.description,
      avatarUrl: clubRow.club.avatarUrl,
      coverUrl: clubRow.club.coverUrl,
      externalLinks: clubRow.club.externalLinks,
      verificationStatus: clubRow.club.verificationStatus,
      isDemo: clubRow.club.isDemo,
      universityName: clubRow.universityName,
    },
    myRole,
    myUserId: user.id,
    currentAcademicYear: getCurrentAcademicYear(),
    posts: postRows.map((p) => ({
      id: p.id,
      authorUserId: p.authorUserId,
      academicYear: p.academicYear,
      postType: p.postType,
      title: p.title,
      summary: p.summary,
      contentMd: p.contentMd,
      tags: p.tags,
      mediaUrls: p.mediaUrls,
      externalLinks: p.externalLinks,
      collaborators: p.collaborators,
      originalityConfirmed: p.originalityConfirmed,
      status: p.status,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      updatedAt: p.updatedAt.toISOString(),
    })),
    opportunities: oppRows.map((o) => ({
      id: o.id,
      title: o.title,
      summary: o.summary,
      scheduleText: o.scheduleText,
      deadlineAt: o.deadlineAt ? o.deadlineAt.toISOString() : null,
      externalUrl: o.externalUrl,
      isActive: o.isActive,
    })),
    members: memberRows.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      title: m.title,
      joinedAt: m.joinedAt.toISOString(),
      endedAt: m.endedAt ? m.endedAt.toISOString() : null,
    })),
    pendingHandover: pendingHandoverRows[0]
      ? {
          id: pendingHandoverRows[0].id,
          toUserId: pendingHandoverRows[0].toUserId,
          toUserName: pendingHandoverRows[0].toUserName,
          note: pendingHandoverRows[0].note,
          expiresAt: pendingHandoverRows[0].expiresAt.toISOString(),
        }
      : null,
  };

  return <ClubManageClient data={data} />;
}
