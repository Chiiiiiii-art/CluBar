import { and, count, eq, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clubMemberships, clubs, notifications, universities } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const user = await requireAuth();

    const [uni] = user.universityId
      ? await db
          .select({ id: universities.id, name: universities.name, shortName: universities.shortName })
          .from(universities)
          .where(eq(universities.id, user.universityId))
          .limit(1)
      : [];

    const memberships = await db
      .select({
        clubId: clubs.id,
        slug: clubs.slug,
        name: clubs.name,
        category: clubs.category,
        verificationStatus: clubs.verificationStatus,
        isDemo: clubs.isDemo,
        role: clubMemberships.role,
        title: clubMemberships.title,
        endedAt: clubMemberships.endedAt,
        universityShortName: universities.shortName,
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

    const [unreadRow] = await db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

    return NextResponse.json({
      user: {
        id: user.id,
        display_name: user.displayName,
        avatar_url: user.avatarUrl,
        platform_role: user.platformRole,
        campus_verified_at: user.campusVerifiedAt ? user.campusVerifiedAt.toISOString() : null,
        university: uni ? { id: uni.id, name: uni.name, short_name: uni.shortName } : null,
      },
      memberships: memberships.map((m) => ({
        club_id: m.clubId,
        slug: m.slug,
        name: m.name,
        category: m.category,
        verification_status: m.verificationStatus,
        is_demo: m.isDemo,
        role: m.role,
        title: m.title,
        ended_at: m.endedAt ? m.endedAt.toISOString() : null,
        university_short_name: m.universityShortName,
      })),
      unread_notifications_count: Number(unreadRow?.total ?? 0),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
