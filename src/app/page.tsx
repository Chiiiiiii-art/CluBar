import { asc } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { interestDomains, universities } from '@/db/schema';
import { getDiscoverStream } from '@/lib/discovery/service';
import { DiscoverClient } from '@/components/DiscoverClient';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ university_id?: string; domain_id?: string }>;
}) {
  const sp = await searchParams;
  const initialUniversityId =
    sp.university_id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.university_id)
      ? sp.university_id
      : '';
  const initialDomainId =
    sp.domain_id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.domain_id)
      ? sp.domain_id
      : '';

  const dbReady = isDatabaseConfigured();
  const [streamData, uniRows, domainRows] = dbReady
    ? await Promise.all([
        getDiscoverStream({
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
        [],
        [],
      ];

  return (
    <DiscoverClient
      initialItems={streamData.items}
      initialMeta={streamData.batch_meta}
      universities={uniRows}
      domains={domainRows}
      dbConfigured={dbReady}
      initialUniversityId={initialUniversityId}
    />
  );
}
