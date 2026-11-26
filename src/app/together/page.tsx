import { and, asc, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubMemberships,
  clubs,
  interestDomains,
  practicalResources,
  togetherItems,
  togetherJams,
  universities,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { serializePublicTogetherItem } from '@/lib/serializers';
import { TogetherClient } from '@/components/TogetherClient';

export const dynamic = 'force-dynamic';

export default async function TogetherPage() {
  const dbReady = isDatabaseConfigured();
  const user = dbReady ? await getCurrentUser().catch(() => null) : null;

  const [domains, rows, jamRows, resRows, myMemberships] = dbReady
    ? await Promise.all([
        db
          .select({ id: interestDomains.id, slug: interestDomains.slug, name_zh: interestDomains.nameZh })
          .from(interestDomains)
          .orderBy(asc(interestDomains.sortOrder))
          .catch(() => []),
        db
          .select({
            item: togetherItems,
            domainName: interestDomains.nameZh,
            club: {
              id: clubs.id,
              slug: clubs.slug,
              name: clubs.name,
              isDemo: clubs.isDemo,
              universityShortName: universities.shortName,
            },
          })
          .from(togetherItems)
          .innerJoin(interestDomains, eq(togetherItems.domainId, interestDomains.id))
          .innerJoin(clubs, eq(togetherItems.clubId, clubs.id))
          .innerJoin(universities, eq(clubs.universityId, universities.id))
          .where(eq(togetherItems.status, 'published'))
          .orderBy(desc(togetherItems.lastActivityAt))
          .limit(30)
          .catch(() => []),
        db
          .select({
            jam: togetherJams,
            domainName: interestDomains.nameZh,
            club: {
              id: clubs.id,
              slug: clubs.slug,
              name: clubs.name,
              uniShort: universities.shortName,
            },
          })
          .from(togetherJams)
          .innerJoin(interestDomains, eq(togetherJams.domainId, interestDomains.id))
          .innerJoin(clubs, eq(togetherJams.hostClubId, clubs.id))
          .innerJoin(universities, eq(clubs.universityId, universities.id))
          .where(and(eq(togetherJams.status, 'open'), gt(togetherJams.deadlineAt, new Date())))
          .orderBy(asc(togetherJams.deadlineAt))
          .limit(20)
          .catch(() => []),
        db
          .select({
            resource: practicalResources,
            domainName: interestDomains.nameZh,
            uniShort: universities.shortName,
          })
          .from(practicalResources)
          .innerJoin(interestDomains, eq(practicalResources.domainId, interestDomains.id))
          .leftJoin(universities, eq(practicalResources.sourceUniversityId, universities.id))
          .where(eq(practicalResources.status, 'published'))
          .orderBy(desc(practicalResources.createdAt))
          .limit(20)
          .catch(() => []),
        user
          ? db
              .select({
                clubId: clubs.id,
                slug: clubs.slug,
                name: clubs.name,
                role: clubMemberships.role,
              })
              .from(clubMemberships)
              .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
              .where(
                and(
                  eq(clubMemberships.userId, user.id),
                  isNull(clubMemberships.endedAt)
                )
              )
              .catch(() => [])
          : Promise.resolve([]),
      ])
    : [[], [], [], [], []];

  return (
    <TogetherClient
      domains={domains}
      initialItems={rows.map((r) =>
        serializePublicTogetherItem({
          ...r.item,
          domainName: r.domainName,
          club: r.club,
        })
      )}
      initialJams={jamRows.map((r) => ({
        id: r.jam.id,
        title: r.jam.title,
        summary: r.jam.summary,
        domain_id: r.jam.domainId,
        domain_name: r.domainName,
        target_schools_count: r.jam.targetSchoolsCount,
        needed_roles: r.jam.neededRoles,
        collab_format: r.jam.collabFormat,
        deadline_at: r.jam.deadlineAt.toISOString(),
        host_club: {
          id: r.club.id,
          slug: r.club.slug,
          name: r.club.name,
          university_short_name: r.club.uniShort,
        },
      }))}
      initialResources={resRows.map((r) => ({
        id: r.resource.id,
        domain_id: r.resource.domainId,
        domain_name: r.domainName,
        source_university_short_name: r.uniShort ?? '跨校去識別',
        title: r.resource.title,
        content_md: r.resource.contentMd,
        created_at: r.resource.createdAt.toISOString(),
      }))}
      myMemberships={myMemberships}
      isCampusVerified={Boolean(user?.campusVerifiedAt)}
    />
  );
}
