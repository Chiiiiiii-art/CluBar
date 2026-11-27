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

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!isDatabaseConfigured()) redirect('/login?callbackUrl=/admin');

  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/admin');

  if (user.platformRole !== 'platform_admin') {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-danger-200 bg-surface p-8 text-center">
        <h1 className="text-lg font-bold text-fg">僅限平台管理員存取</h1>
        <p className="mt-2 text-sm text-fg-muted">
          您的帳號目前不是平台管理員（platform_admin）。
        </p>
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
