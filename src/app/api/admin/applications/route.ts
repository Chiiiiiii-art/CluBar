import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubApplications, clubs, universities, users } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

const querySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      status: url.searchParams.get('status') || undefined,
    });

    const rows = await db
      .select({
        app: clubApplications,
        applicantName: users.displayName,
        applicantCampusEmail: users.campusEmail,
        targetClubName: clubs.name,
        targetClubSlug: clubs.slug,
        proposedUniversityName: universities.name,
      })
      .from(clubApplications)
      .innerJoin(users, eq(clubApplications.applicantUserId, users.id))
      .leftJoin(clubs, eq(clubApplications.targetClubId, clubs.id))
      .leftJoin(universities, eq(clubApplications.proposedUniversityId, universities.id))
      .where(eq(clubApplications.status, parsed.status))
      .orderBy(asc(clubApplications.createdAt));

    return NextResponse.json({
      applications: rows.map((r) => ({
        id: r.app.id,
        type: r.app.type,
        status: r.app.status,
        applicant_name: r.applicantName,
        applicant_campus_email: r.applicantCampusEmail,
        target_club_id: r.app.targetClubId,
        target_club_name: r.targetClubName,
        target_club_slug: r.targetClubSlug,
        proposed_university_name: r.proposedUniversityName,
        proposed_name: r.app.proposedName,
        proposed_slug: r.app.proposedSlug,
        proposed_category: r.app.proposedCategory,
        evidence_text: r.app.evidenceText,
        evidence_urls: r.app.evidenceUrls,
        review_note: r.app.reviewNote,
        reviewed_at: r.app.reviewedAt ? r.app.reviewedAt.toISOString() : null,
        created_at: r.app.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
