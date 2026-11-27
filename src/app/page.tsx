import { cookies } from 'next/headers';
import { asc } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { interestDomains, universities } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { getDiscoverEvents, getDiscoverStream } from '@/lib/discovery/service';
import { DiscoverClient } from '@/components/DiscoverClient';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ university_id?: string; domain_id?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const cookieUni = cookieStore.get('clubar_univ')?.value;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const initialUniversityId =
    sp.university_id && uuidRegex.test(sp.university_id)
      ? sp.university_id
      : cookieUni && uuidRegex.test(cookieUni)
        ? cookieUni
        : '';
  const initialDomainId =
    sp.domain_id && uuidRegex.test(sp.domain_id) ? sp.domain_id : '';
  const initialTab = sp.tab === 'events' ? 'events' : 'stream';

  const dbReady = isDatabaseConfigured();
  const currentUser = dbReady ? await getCurrentUser().catch(() => null) : null;

  const [streamData, eventData, uniRows, domainRows] = dbReady
    ? await Promise.all([
        getDiscoverStream({
          universityId: initialUniversityId || undefined,
          domainId: initialDomainId || undefined,
        }).catch(() => ({
          items: [],
          batch_meta: { count: 0, cap: 12, has_more: false, next_exclude_ids: [] },
        })),
        getDiscoverEvents({
          universityId: initialUniversityId || undefined,
          domainId: initialDomainId || undefined,
        }).catch(() => ({
          items: [],
          batch_meta: { count: 0, cap: 12, has_more: false, next_exclude_ids: [] },
        })),
        db
          .select({ id: universities.id, short_name: universities.shortName, name: universities.name })
          .from(universities)
          .orderBy(asc(universities.name))
          .catch(() => []),
        db
          .select({ id: interestDomains.id, slug: interestDomains.slug, name_zh: interestDomains.nameZh })
          .from(interestDomains)
          .orderBy(asc(interestDomains.sortOrder))
          .catch(() => []),
      ])
    : [
        { items: [], batch_meta: { count: 0, cap: 12, has_more: false, next_exclude_ids: [] } },
        { items: [], batch_meta: { count: 0, cap: 12, has_more: false, next_exclude_ids: [] } },
        [],
        [],
      ];

  return (
    <DiscoverClient
      initialTab={initialTab}
      initialStreamItems={streamData.items}
      initialStreamMeta={streamData.batch_meta}
      initialEventItems={eventData.items}
      initialEventMeta={eventData.batch_meta}
      universities={uniRows}
      domains={domainRows}
      dbConfigured={dbReady}
      initialUniversityId={initialUniversityId}
      isLoggedIn={Boolean(currentUser)}
    />
  );
}
