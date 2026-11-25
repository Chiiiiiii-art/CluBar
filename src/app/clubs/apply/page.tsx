import { redirect } from 'next/navigation';
import { asc, eq, ne } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { clubs, universities } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { ClubApplyClient, type DirectoryClubOption } from '@/components/ClubApplyClient';

export const dynamic = 'force-dynamic';

export default async function ClubApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>;
}) {
  if (!isDatabaseConfigured()) redirect('/login?callbackUrl=/clubs/apply');

  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/clubs/apply');

  const sp = await searchParams;

  const [uniRows, clubRows] = await Promise.all([
    db
      .select({ id: universities.id, name: universities.name, short_name: universities.shortName })
      .from(universities)
      .orderBy(asc(universities.name)),
    db
      .select({
        id: clubs.id,
        slug: clubs.slug,
        name: clubs.name,
        category: clubs.category,
        verification_status: clubs.verificationStatus,
        university_id: clubs.universityId,
        university_short_name: universities.shortName,
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(ne(clubs.verificationStatus, 'pending_review'))
      .orderBy(asc(universities.shortName), asc(clubs.name)),
  ]);

  return (
    <ClubApplyClient
      universities={uniRows}
      initialDirectory={clubRows as DirectoryClubOption[]}
      preselectedClaimSlug={sp.claim}
      campusVerified={Boolean(user.campusVerifiedAt)}
    />
  );
}
