import { redirect } from 'next/navigation';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { clubMemberships, clubs, universities } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { MyClubsClient } from '@/components/MyClubsClient';

export const dynamic = 'force-dynamic';

export default async function MyClubsPage() {
  if (!isDatabaseConfigured()) redirect('/login?callbackUrl=/my-clubs');
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/my-clubs');

  const memberships = await db
    .select({
      clubId: clubs.id,
      slug: clubs.slug,
      name: clubs.name,
      universityShortName: universities.shortName,
      role: clubMemberships.role,
      title: clubMemberships.title,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(
      and(
        eq(clubMemberships.userId, user.id),
        or(isNull(clubMemberships.endedAt), eq(clubMemberships.role, 'alumni'))
      )
    );

  return (
    <div className="mx-auto max-w-3xl">
      <MyClubsClient
        memberships={memberships}
        isCampusVerified={Boolean(user.campusVerifiedAt)}
      />
    </div>
  );
}
