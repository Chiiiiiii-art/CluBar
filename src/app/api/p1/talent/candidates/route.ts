import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { clubMemberships, universities, users } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

export async function GET(req: Request) {
  try {
    await requirePlatformAdmin();
    const url = new URL(req.url);
    const tag = url.searchParams.get('tag')?.trim().toLowerCase() ?? '';

    const rows = await db
      .select({
        id: users.id,
        handle: users.handle,
        displayName: users.displayName,
        universityShortName: universities.shortName,
        portfolioVisibility: users.portfolioVisibility,
        alumniExpertiseTags: users.alumniExpertiseTags,
      })
      .from(users)
      .leftJoin(universities, eq(users.universityId, universities.id))
      .where(and(eq(users.talentDiscoveryOptIn, true)))
      .limit(50);

    const userIds = rows.map((r) => r.id);
    const clubCounts =
      userIds.length > 0
        ? await db
            .select({
              userId: clubMemberships.userId,
              count: sql<number>`count(*)::int`,
            })
            .from(clubMemberships)
            .where(inArray(clubMemberships.userId, userIds))
            .groupBy(clubMemberships.userId)
        : [];
    const countMap = new Map(clubCounts.map((c) => [c.userId, c.count]));

    const filtered = tag
      ? rows.filter((r) =>
          r.alumniExpertiseTags.some((t) => t.toLowerCase().includes(tag))
        )
      : rows;

    // Zero email / campusEmail PII exposed in P1 talent contract
    return NextResponse.json({
      contract_version: 'p1-v1',
      candidates: filtered.map((r) => ({
        handle: r.handle,
        display_name: r.displayName,
        university_short_name: r.universityShortName ?? '大專校院',
        portfolio_visibility: r.portfolioVisibility,
        expertise_tags: r.alumniExpertiseTags,
        clubs_count: countMap.get(r.id) ?? 0,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
