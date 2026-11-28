import { cookies } from 'next/headers';
import { asc } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { interestDomains, universities } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { OnboardingClient } from '@/components/OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const dbReady = isDatabaseConfigured();
  const cookieUni = (await cookies()).get('clubar_univ')?.value ?? '';
  const [user, uniRows, domainRows] = dbReady
    ? await Promise.all([
        getCurrentUser().catch(() => null),
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
    : [null, [], []];

  return (
    <OnboardingClient
      universities={uniRows}
      domains={domainRows}
      isLoggedIn={Boolean(user)}
      userName={user?.displayName ?? ''}
      initialUniversityId={cookieUni}
    />
  );
}
