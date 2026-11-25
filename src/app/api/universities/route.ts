import { asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/db';
import { universities } from '@/db/schema';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ universities: [] });
    }
    const rows = await db
      .select({
        id: universities.id,
        code: universities.code,
        name: universities.name,
        short_name: universities.shortName,
      })
      .from(universities)
      .orderBy(asc(universities.name));
    return NextResponse.json({ universities: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
