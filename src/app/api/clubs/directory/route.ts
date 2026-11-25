import { and, asc, eq, ilike, ne, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db, isDatabaseConfigured } from '@/db';
import { clubs, universities } from '@/db/schema';
import { handleApiError } from '@/lib/errors';

const directoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  university_id: z.string().uuid().optional(),
  status: z.enum(['unclaimed_directory', 'verified', 'suspended']).optional(),
});

export async function GET(req: Request) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ clubs: [] });
    }

    const url = new URL(req.url);
    const parsed = directoryQuerySchema.parse({
      q: url.searchParams.get('q') || undefined,
      university_id: url.searchParams.get('university_id') || undefined,
      status: url.searchParams.get('status') || undefined,
    });

    const conditions = [ne(clubs.verificationStatus, 'pending_review')];
    if (parsed.university_id) {
      conditions.push(eq(clubs.universityId, parsed.university_id));
    }
    if (parsed.status) {
      conditions.push(eq(clubs.verificationStatus, parsed.status));
    }
    if (parsed.q) {
      const pattern = `%${parsed.q}%`;
      conditions.push(or(ilike(clubs.name, pattern), ilike(clubs.tagline, pattern))!);
    }

    const rows = await db
      .select({
        id: clubs.id,
        slug: clubs.slug,
        name: clubs.name,
        category: clubs.category,
        tagline: clubs.tagline,
        verification_status: clubs.verificationStatus,
        is_demo: clubs.isDemo,
        official_directory_url: clubs.officialDirectoryUrl,
        university_id: universities.id,
        university_name: universities.name,
        university_short_name: universities.shortName,
      })
      .from(clubs)
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(and(...conditions))
      .orderBy(asc(universities.shortName), asc(clubs.name))
      .limit(100);

    return NextResponse.json({ clubs: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
