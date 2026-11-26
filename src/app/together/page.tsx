import { asc, desc, eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { clubs, interestDomains, togetherItems, universities } from '@/db/schema';
import { serializePublicTogetherItem } from '@/lib/serializers';
import { TogetherClient } from '@/components/TogetherClient';

export const dynamic = 'force-dynamic';

export default async function TogetherPage() {
  const dbReady = isDatabaseConfigured();
  const [domains, rows] = dbReady
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
          .limit(20)
          .catch(() => []),
      ])
    : [[], []];

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
    />
  );
}
