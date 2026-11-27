import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubEvents,
  clubMemberships,
  clubs,
  coClubLinks,
  eventRsvps,
  users,
  type ClubMemberRole,
  type ClubVerificationStatus,
  type PlatformRole,
} from '@/db/schema';
import { AppError } from '@/lib/errors';
import { isBootstrapAdminAccount } from '@/lib/validators';

export type AuthenticatedUser = typeof users.$inferSelect;

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (!isDatabaseConfigured()) return null;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  if (
    user.platformRole !== 'platform_admin' &&
    isBootstrapAdminAccount({
      campusEmail: user.campusEmail,
      campusVerifiedAt: user.campusVerifiedAt,
    })
  ) {
    const [promoted] = await db
      .update(users)
      .set({ platformRole: 'platform_admin', updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    return promoted ?? { ...user, platformRole: 'platform_admin' };
  }

  return user;
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', '請先登入後再執行此操作。');
  }
  return user;
}

export async function requireVerifiedStudent(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (!user.campusVerifiedAt || !user.universityId) {
    throw new AppError(
      403,
      'CAMPUS_VERIFICATION_REQUIRED',
      '此操作須先完成大專校院 .edu.tw 校園信箱驗證。'
    );
  }
  return user;
}

export async function requireSameUniversity(universityId: string): Promise<AuthenticatedUser> {
  const user = await requireVerifiedStudent();
  if (user.universityId !== universityId) {
    throw new AppError(
      403,
      'UNIVERSITY_MISMATCH',
      '此操作僅限該校已驗證學生執行。'
    );
  }
  return user;
}

export function evaluateClubWriteAccess(params: {
  campusVerifiedAt: Date | null;
  userUniversityId?: string | null;
  clubUniversityId?: string | null;
  clubStatus: ClubVerificationStatus;
  membershipRole: ClubMemberRole | null;
  membershipEndedAt: Date | null;
  allowedRoles: ClubMemberRole[];
}): { ok: true } | { ok: false; status: number; code: string; message: string } {
  if (!params.campusVerifiedAt) {
    return {
      ok: false,
      status: 403,
      code: 'CAMPUS_VERIFICATION_REQUIRED',
      message: '此操作須先完成大專校院 .edu.tw 校園信箱驗證。',
    };
  }
  if (
    params.userUniversityId &&
    params.clubUniversityId &&
    params.userUniversityId !== params.clubUniversityId
  ) {
    return {
      ok: false,
      status: 403,
      code: 'UNIVERSITY_MISMATCH',
      message: '僅限同校認證社員或幹部操作此社團功能。',
    };
  }
  if (params.clubStatus === 'suspended') {
    return {
      ok: false,
      status: 403,
      code: 'CLUB_SUSPENDED',
      message: '此社團目前暫停發布與更新權限。',
    };
  }
  if (params.clubStatus !== 'verified') {
    return {
      ok: false,
      status: 403,
      code: 'CLUB_NOT_VERIFIED',
      message: '社團尚未完成官方認證。',
    };
  }
  const isActive = params.membershipRole !== null && params.membershipEndedAt === null;
  if (!isActive || !params.allowedRoles.includes(params.membershipRole!)) {
    const isOwnerOnly =
      params.allowedRoles.length === 1 && params.allowedRoles[0] === 'owner';
    const isMemberAllowed = params.allowedRoles.includes('member');
    return {
      ok: false,
      status: 403,
      code: isOwnerOnly
        ? 'CLUB_OWNER_REQUIRED'
        : isMemberAllowed
          ? 'CLUB_MEMBER_REQUIRED'
          : 'CLUB_OFFICER_REQUIRED',
      message: isOwnerOnly
        ? '僅現任社長可執行此操作。'
        : isMemberAllowed
          ? '僅限此社團認證社員或幹部執行此操作。'
          : '僅限此社團現任幹部或社長執行此操作。',
    };
  }
  return { ok: true };
}

export function evaluateArchiveAccess(params: {
  platformRole: PlatformRole;
  managedUniversityId?: string | null;
  clubUniversityId?: string | null;
  membershipRole: ClubMemberRole | null;
  membershipEndedAt: Date | null;
}): boolean {
  if (params.platformRole === 'platform_admin') return true;
  if (
    params.platformRole === 'school_admin' &&
    params.managedUniversityId &&
    params.clubUniversityId &&
    params.managedUniversityId === params.clubUniversityId
  ) {
    return true;
  }
  if (!params.membershipRole) return false;
  if (params.membershipRole === 'alumni') return true;
  return params.membershipEndedAt === null && ['owner', 'editor'].includes(params.membershipRole);
}

export async function requireClubRole(
  clubId: string,
  allowedRoles: ('owner' | 'editor' | 'member')[]
): Promise<{
  user: AuthenticatedUser;
  club: typeof clubs.$inferSelect;
  membership: typeof clubMemberships.$inferSelect;
}> {
  const user = await requireVerifiedStudent();
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club) {
    throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
  }

  const [membership] = await db
    .select()
    .from(clubMemberships)
    .where(
      and(
        eq(clubMemberships.clubId, clubId),
        eq(clubMemberships.userId, user.id),
        isNull(clubMemberships.endedAt)
      )
    )
    .limit(1);

  const decision = evaluateClubWriteAccess({
    campusVerifiedAt: user.campusVerifiedAt,
    userUniversityId: user.universityId,
    clubUniversityId: club.universityId,
    clubStatus: club.verificationStatus,
    membershipRole: membership?.role ?? null,
    membershipEndedAt: membership?.endedAt ?? null,
    allowedRoles,
  });

  if (!decision.ok) {
    throw new AppError(decision.status, decision.code, decision.message);
  }

  return { user, club, membership: membership! };
}

export async function requireClubMember(clubId: string) {
  return requireClubRole(clubId, ['owner', 'editor', 'member']);
}

export async function requireClubOfficer(clubId: string) {
  return requireClubRole(clubId, ['owner', 'editor']);
}

export async function requireClubOwner(clubId: string) {
  return requireClubRole(clubId, ['owner']);
}

export async function requireClubArchiveAccess(clubId: string): Promise<{
  user: AuthenticatedUser;
  club: typeof clubs.$inferSelect;
}> {
  const user = await requireAuth();
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club) {
    throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
  }

  if (
    user.platformRole === 'platform_admin' ||
    (user.platformRole === 'school_admin' && user.managedUniversityId === club.universityId)
  ) {
    return { user, club };
  }

  const [membership] = await db
    .select()
    .from(clubMemberships)
    .where(
      and(
        eq(clubMemberships.clubId, clubId),
        eq(clubMemberships.userId, user.id),
        or(
          and(isNull(clubMemberships.endedAt), inArray(clubMemberships.role, ['owner', 'editor'])),
          eq(clubMemberships.role, 'alumni')
        )
      )
    )
    .limit(1);

  if (!membership) {
    throw new AppError(
      403,
      'ARCHIVE_ACCESS_DENIED',
      '僅社團現任幹部、歷屆校友、所屬校方承辦或平台管理員可檢視評鑑檔案。'
    );
  }

  return { user, club };
}

export async function requireEventAttendee(eventId: string): Promise<{
  user: AuthenticatedUser;
  event: typeof clubEvents.$inferSelect;
  isOfficer: boolean;
}> {
  const user = await requireAuth();
  const [event] = await db.select().from(clubEvents).where(eq(clubEvents.id, eventId)).limit(1);
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', '找不到指定活動。');
  }

  const coHosts = await db
    .select({ clubId: coClubLinks.partnerClubId })
    .from(coClubLinks)
    .where(
      and(
        eq(coClubLinks.targetType, 'event'),
        eq(coClubLinks.targetId, event.id),
        eq(coClubLinks.status, 'accepted')
      )
    );
  const hostClubIds = [event.clubId, ...coHosts.map((c) => c.clubId)];

  const [officerRow] = await db
    .select({ id: clubMemberships.id })
    .from(clubMemberships)
    .where(
      and(
        inArray(clubMemberships.clubId, hostClubIds),
        eq(clubMemberships.userId, user.id),
        isNull(clubMemberships.endedAt),
        inArray(clubMemberships.role, ['owner', 'editor'])
      )
    )
    .limit(1);

  if (officerRow) {
    return { user, event, isOfficer: true };
  }

  const [rsvp] = await db
    .select()
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.eventId, eventId),
        eq(eventRsvps.userId, user.id),
        eq(eventRsvps.status, 'going')
      )
    )
    .limit(1);

  if (!rsvp) {
    throw new AppError(
      403,
      'EVENT_ATTENDEE_REQUIRED',
      '僅限此場已報名參加者或主辦社團幹部執行此操作。'
    );
  }

  return { user, event, isOfficer: false };
}

export async function requireSchoolAdmin(universityId?: string): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.platformRole === 'platform_admin') {
    return user;
  }
  if (
    user.platformRole !== 'school_admin' ||
    !user.managedUniversityId ||
    (universityId && user.managedUniversityId !== universityId)
  ) {
    throw new AppError(403, 'SCHOOL_ADMIN_REQUIRED', '此介面僅限對應校方授權管理人員存取。');
  }
  return user;
}

export async function requirePlatformAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.platformRole !== 'platform_admin') {
    throw new AppError(403, 'ADMIN_REQUIRED', '此功能僅限平台管理員操作。');
  }
  return user;
}
