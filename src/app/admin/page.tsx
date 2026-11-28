import { redirect } from 'next/navigation';
import { asc, count, desc, eq, inArray } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  analyticsEvents,
  clubApplications,
  clubs,
  posts,
  reports,
  universities,
  users,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { AdminClient, type AdminPageData } from '@/components/AdminClient';
import { ButtonLink, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!isDatabaseConfigured()) redirect('/login?callbackUrl=/admin');

  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/admin');

  if (user.platformRole !== 'platform_admin') {
    const isSchoolAdmin = user.platformRole === 'school_admin';
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          title={isSchoolAdmin ? '學校後台還在準備中' : '這裡是平台管理員的工作區'}
          description={
            isSchoolAdmin
              ? '你是學校承辦帳號。學校專用的社團總覽與評鑑彙整正在做，完成後會從這裡進入；現在可以先到首頁看看各社團的活動與作品。'
              : '你的帳號沒有這一頁的權限。如果你是社團幹部，管理社團請到「我的聚」。'
          }
          action={
            isSchoolAdmin ? (
              <ButtonLink href="/" variant="secondary">
                去首頁看社團
              </ButtonLink>
            ) : (
              <ButtonLink href="/my-clubs" variant="secondary">
                去我的聚
              </ButtonLink>
            )
          }
        />
      </div>
    );
  }

  const [appRows, reportRows, suspendedRows, removedPostRows, analyticsRows] = await Promise.all([
    db
      .select({
        app: clubApplications,
        applicantName: users.displayName,
        applicantCampusEmail: users.campusEmail,
        targetClubName: clubs.name,
        proposedUniversityName: universities.name,
      })
      .from(clubApplications)
      .innerJoin(users, eq(clubApplications.applicantUserId, users.id))
      .leftJoin(clubs, eq(clubApplications.targetClubId, clubs.id))
      .leftJoin(universities, eq(clubApplications.proposedUniversityId, universities.id))
      .where(eq(clubApplications.status, 'pending'))
      .orderBy(asc(clubApplications.createdAt)),
    db
      .select({
        report: reports,
        reporterName: users.displayName,
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterUserId, users.id))
      .where(eq(reports.status, 'open'))
      .orderBy(asc(reports.createdAt)),
    db
      .select({
        id: clubs.id,
        name: clubs.name,
        slug: clubs.slug,
        universityShortName: universities.shortName,
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubs.verificationStatus, 'suspended')),
    db
      .select({
        id: posts.id,
        title: posts.headline,
        status: posts.status,
        clubName: clubs.name,
      })
      .from(posts)
      .innerJoin(clubs, eq(posts.clubId, clubs.id))
      .where(inArray(posts.status, ['hidden_by_owner', 'removed_by_admin']))
      .orderBy(desc(posts.updatedAt))
      .limit(40),
    db
      .select({
        eventType: analyticsEvents.eventType,
        total: count(),
      })
      .from(analyticsEvents)
      .groupBy(analyticsEvents.eventType),
  ]);

  const data: AdminPageData = {
    applications: appRows.map((r) => ({
      id: r.app.id,
      type: r.app.type,
      applicantName: r.applicantName,
      applicantCampusEmail: r.applicantCampusEmail,
      targetClubName: r.targetClubName,
      proposedUniversityName: r.proposedUniversityName,
      proposedName: r.app.proposedName,
      proposedSlug: r.app.proposedSlug,
      evidenceText: r.app.evidenceText,
      evidenceUrls: r.app.evidenceUrls,
      createdAt: r.app.createdAt.toISOString(),
    })),
    reports: reportRows.map((r) => ({
      id: r.report.id,
      targetType: r.report.targetType,
      targetId: r.report.targetId,
      reason: r.report.reason,
      detail: r.report.detail,
      reporterName: r.reporterName,
      createdAt: r.report.createdAt.toISOString(),
    })),
    suspendedClubs: suspendedRows,
    removedPosts: removedPostRows,
    analyticsSummary: analyticsRows.map((r) => ({
      eventType: r.eventType,
      count: Number(r.total),
    })),
  };

  return <AdminClient data={data} />;
}
