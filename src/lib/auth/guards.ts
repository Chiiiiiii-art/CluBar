import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubMemberships,
  clubs,
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
  if (!user.campusVerifiedAt) {
    throw new AppError(
      403,
      'CAMPUS_VERIFICATION_REQUIRED',
      '此操作須先完成大專校院 .edu.tw 校園信箱驗證。'
    );
  }
  return user;
}

export function evaluateClubWriteAccess(params: {
  campusVerifiedAt: Date | null;
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
    return {
      ok: false,
      status: 403,
      code: isOwnerOnly ? 'CLUB_OWNER_REQUIRED' : 'CLUB_PERMISSION_DENIED',
      message: isOwnerOnly ? '僅現任社長可執行此操作。' : '您目前沒有此社團的編輯權限。',
    };
  }
  return { ok: true };
}

export function evaluateSummaryAccess(params: {
  platformRole: PlatformRole;
  membershipRole: ClubMemberRole | null;
  membershipEndedAt: Date | null;
}): boolean {
  if (params.platformRole === 'platform_admin') return true;
  if (!params.membershipRole) return false;
  if (params.membershipRole === 'alumni') return true;
  return params.membershipEndedAt === null && ['owner', 'editor'].includes(params.membershipRole);
}

export async function requireClubRole(
  clubId: string,
  allowedRoles: ('owner' | 'editor')[]
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

export async function requireClubOwner(clubId: string) {
  return requireClubRole(clubId, ['owner']);
}

export async function requireClubSummaryAccess(clubId: string): Promise<{
  user: AuthenticatedUser;
  club: typeof clubs.$inferSelect;
}> {
  const user = await requireAuth();
  const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!club) {
    throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
  }

  if (user.platformRole === 'platform_admin') {
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
    throw new AppError(403, 'CLUB_PERMISSION_DENIED', '僅社團現任幹部、歷屆校友或平台管理員可檢視成果彙整。');
  }

  return { user, club };
}

export async function requirePlatformAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.platformRole !== 'platform_admin') {
    throw new AppError(403, 'ADMIN_REQUIRED', '此功能僅限平台管理員操作。');
  }
  return user;
}
