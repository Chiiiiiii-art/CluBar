import { asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/db';
import { interestDomains, universities } from '@/db/schema';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ universities: [], interest_domains: [] });
    }
    const [uniRows, domainRows] = await Promise.all([
      db
        .select({
          id: universities.id,
          code: universities.code,
          name: universities.name,
          short_name: universities.shortName,
        })
        .from(universities)
        .orderBy(asc(universities.name)),
      db
        .select({
          id: interestDomains.id,
          slug: interestDomains.slug,
          name_zh: interestDomains.nameZh,
          sort_order: interestDomains.sortOrder,
        })
        .from(interestDomains)
        .orderBy(asc(interestDomains.sortOrder)),
    ]);
    return NextResponse.json({ universities: uniRows, interest_domains: domainRows });
  } catch (err) {
    return handleApiError(err);
  }
}
