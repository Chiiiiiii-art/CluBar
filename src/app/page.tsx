import { asc } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { universities, type ClubCategory } from '@/db/schema';
import { getDiscoverFeed } from '@/lib/discovery/service';
import { clubCategorySchema } from '@/lib/validators';
import { DiscoverClient } from '@/components/DiscoverClient';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string; university_id?: string }>;
}) {
  const sp = await searchParams;
  const parsedCategory = sp.category ? clubCategorySchema.safeParse(sp.category) : null;
  const initialCategory: ClubCategory | '' = parsedCategory?.success ? parsedCategory.data : '';
  const initialTag = sp.tag?.trim().slice(0, 32) || '';
  const initialUniversityId =
    sp.university_id &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sp.university_id)
      ? sp.university_id
      : '';

  const dbReady = isDatabaseConfigured();
  const [feedData, uniRows] = dbReady
    ? await Promise.all([
        getDiscoverFeed({
          category: initialCategory || undefined,
          tag: initialTag || undefined,
          universityId: initialUniversityId || undefined,
        }).catch(() => ({
          items: [],
          batch_meta: {
            count: 0,
            cap: 12,
            is_end_of_batch: true as const,
            suggested_categories: [],
          },
        })),
        db
          .select({
            id: universities.id,
            short_name: universities.shortName,
            name: universities.name,
          })
          .from(universities)
          .orderBy(asc(universities.name))
          .catch(() => []),
      ])
    : [
        {
          items: [],
          batch_meta: {
            count: 0,
            cap: 12,
            is_end_of_batch: true as const,
            suggested_categories: [],
          },
        },
        [],
      ];

  return (
    <DiscoverClient
      initialItems={feedData.items}
      initialMeta={feedData.batch_meta}
      universities={uniRows}
      dbConfigured={dbReady}
      initialCategory={initialCategory}
      initialTag={initialTag}
      initialUniversityId={initialUniversityId}
    />
  );
}
