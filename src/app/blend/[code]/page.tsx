import { notFound } from 'next/navigation';
import { and, count, eq, inArray } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  blendSessions,
  clubEvents,
  clubs,
  eventRsvps,
  interestDomains,
  universities,
  users,
} from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { serializeDiscoverEventCard } from '@/lib/serializers';
import { BlendClient } from '@/components/BlendClient';

export const dynamic = 'force-dynamic';

export default async function BlendPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { code } = await params;
  const currentUser = await getCurrentUser().catch(() => null);

  const [session] = await db
    .select()
    .from(blendSessions)
    .where(eq(blendSessions.shortCode, code))
    .limit(1);

  if (!session) notFound();

  const [uniRow, creatorRow, partnerRow, domainRows] = await Promise.all([
    db.select({ name: universities.name, shortName: universities.shortName }).from(universities).where(eq(universities.id, session.universityId)).limit(1),
    db.select({ displayName: users.displayName }).from(users).where(eq(users.id, session.creatorUserId)).limit(1),
    session.partnerUserId
      ? db.select({ displayName: users.displayName }).from(users).where(eq(users.id, session.partnerUserId)).limit(1)
      : Promise.resolve([]),
    session.sharedDomainIds.length > 0
      ? db.select({ nameZh: interestDomains.nameZh }).from(interestDomains).where(inArray(interestDomains.id, session.sharedDomainIds))
      : Promise.resolve([]),
  ]);

  const recClubs =
    session.recommendedClubIds.length > 0
      ? await db
          .select({ id: clubs.id, slug: clubs.slug, name: clubs.name, tagline: clubs.tagline })
          .from(clubs)
          .where(inArray(clubs.id, session.recommendedClubIds))
      : [];

  const recEventsRaw =
    session.recommendedEventIds.length > 0
      ? await db
          .select({
            event: clubEvents,
            club: {
              id: clubs.id,
              slug: clubs.slug,
              name: clubs.name,
              isDemo: clubs.isDemo,
              universityId: clubs.universityId,
              universityShortName: universities.shortName,
            },
          })
          .from(clubEvents)
          .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
          .innerJoin(universities, eq(clubs.universityId, universities.id))
          .where(inArray(clubEvents.id, session.recommendedEventIds))
      : [];

  const goingMap = new Map<string, number>();
  if (recEventsRaw.length > 0) {
    const rsvpCounts = await db
      .select({ eventId: eventRsvps.eventId, total: count() })
      .from(eventRsvps)
      .where(
        and(
          inArray(
            eventRsvps.eventId,
            recEventsRaw.map((e) => e.event.id)
          ),
          eq(eventRsvps.status, 'going')
        )
      )
      .groupBy(eventRsvps.eventId);
    for (const r of rsvpCounts) goingMap.set(r.eventId, Number(r.total));
  }

  return (
    <BlendClient
      shortCode={session.shortCode}
      creatorName={creatorRow[0]?.displayName.split('（')[0] || '校園探索者'}
      partnerName={partnerRow[0]?.displayName.split('（')[0] || null}
      universityName={uniRow[0]?.name || '大專校院'}
      matchScore={session.matchScore}
      sharedDomains={domainRows.map((d) => d.nameZh)}
      recommendedClubs={recClubs}
      recommendedEvents={recEventsRaw.map((r) =>
        serializeDiscoverEventCard({
          ...r.event,
          goingCount: goingMap.get(r.event.id) ?? 0,
          club: r.club,
        })
      )}
      isCreator={currentUser?.id === session.creatorUserId}
      isLoggedIn={Boolean(currentUser)}
      isExpired={session.expiresAt.getTime() <= Date.now()}
    />
  );
}
