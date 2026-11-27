import { notFound } from 'next/navigation';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubMemberships,
  clubs,
  interestDomains,
  togetherItems,
  togetherReplies,
  universities,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { serializePublicTogetherItem } from '@/lib/serializers';
import { TogetherDetailClient } from '@/components/TogetherDetailClient';

export const dynamic = 'force-dynamic';

export default async function TogetherItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { id } = await params;

  const [found] = await db
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
    .where(and(eq(togetherItems.id, id), eq(togetherItems.status, 'published')))
    .limit(1);

  if (!found) notFound();

  const user = await getCurrentUser().catch(() => null);

  const [parentRows, repliesRows, reboundRows, myClubs] = await Promise.all([
    found.item.parentItemId
      ? db
          .select({
            id: togetherItems.id,
            title: togetherItems.title,
            clubName: clubs.name,
          })
          .from(togetherItems)
          .innerJoin(clubs, eq(togetherItems.clubId, clubs.id))
          .where(eq(togetherItems.id, found.item.parentItemId))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: togetherReplies.id,
        contentMd: togetherReplies.contentMd,
        createdAt: togetherReplies.createdAt,
        clubSlug: clubs.slug,
        clubName: clubs.name,
        uniShort: universities.shortName,
      })
      .from(togetherReplies)
      .innerJoin(clubs, eq(togetherReplies.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(and(eq(togetherReplies.itemId, found.item.id), eq(togetherReplies.status, 'published')))
      .orderBy(asc(togetherReplies.createdAt))
      .limit(80),
    db
      .select({
        id: togetherItems.id,
        title: togetherItems.title,
        createdAt: togetherItems.createdAt,
        clubName: clubs.name,
      })
      .from(togetherItems)
      .innerJoin(clubs, eq(togetherItems.clubId, clubs.id))
      .where(
        and(
          eq(togetherItems.parentItemId, found.item.id),
          eq(togetherItems.status, 'published')
        )
      )
      .orderBy(desc(togetherItems.createdAt))
      .limit(20),
    user
      ? db
          .select({ clubId: clubs.id, name: clubs.name })
          .from(clubMemberships)
          .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
          .where(and(eq(clubMemberships.userId, user.id), isNull(clubMemberships.endedAt)))
      : Promise.resolve([]),
  ]);

  return (
    <TogetherDetailClient
      item={serializePublicTogetherItem({
        ...found.item,
        domainName: found.domainName,
        club: found.club,
      })}
      parentItem={
        parentRows[0]
          ? {
              id: parentRows[0].id,
              title: parentRows[0].title,
              club_name: parentRows[0].clubName,
            }
          : null
      }
      initialReplies={repliesRows.map((r) => ({
        id: r.id,
        content_md: r.contentMd,
        created_at: r.createdAt.toISOString(),
        club: {
          slug: r.clubSlug,
          name: r.clubName,
          university_short_name: r.uniShort,
        },
      }))}
      rebounds={reboundRows.map((rb) => ({
        id: rb.id,
        title: rb.title,
        club_name: rb.clubName,
        created_at: rb.createdAt.toISOString(),
      }))}
      myClubs={myClubs}
    />
  );
}
