import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { clubMemberships, clubs, universities, users } from '@/db/schema';
import { requireVerifiedStudent } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

export async function GET(req: Request) {
  try {
    await requireVerifiedStudent();
    const url = new URL(req.url);
    const tagFilter = url.searchParams.get('tag')?.trim().toLowerCase() ?? '';

    const alumniUsers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        handle: users.handle,
        avatarUrl: users.avatarUrl,
        universityShortName: universities.shortName,
        alumniExpertiseTags: users.alumniExpertiseTags,
      })
      .from(users)
      .leftJoin(universities, eq(users.universityId, universities.id))
      .where(and(eq(users.alumniPingEnabled, true)))
      .limit(50);

    const userIds = alumniUsers.map((u) => u.id);
    const pastClubs =
      userIds.length > 0
        ? await db
            .select({
              userId: clubMemberships.userId,
              clubName: clubs.name,
              clubSlug: clubs.slug,
              title: clubMemberships.title,
              role: clubMemberships.role,
            })
            .from(clubMemberships)
            .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
            .where(inArray(clubMemberships.userId, userIds))
        : [];

    const filtered = tagFilter
      ? alumniUsers.filter(
          (u) =>
            u.alumniExpertiseTags.some((t) => t.toLowerCase().includes(tagFilter)) ||
            u.displayName.toLowerCase().includes(tagFilter)
        )
      : alumniUsers;

    return NextResponse.json({
      alumni: filtered.map((u) => ({
        user_id: u.id,
        display_name: u.displayName,
        handle: u.handle,
        avatar_url: u.avatarUrl,
        university_short_name: u.universityShortName ?? '大專校院',
        expertise_tags: u.alumniExpertiseTags,
        clubs: pastClubs
          .filter((c) => c.userId === u.id)
          .slice(0, 3)
          .map((c) => ({
            slug: c.clubSlug,
            name: c.clubName,
            title: c.title,
            role: c.role,
          })),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
