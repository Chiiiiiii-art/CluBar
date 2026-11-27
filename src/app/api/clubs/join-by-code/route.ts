import { NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubInviteCodes, clubMemberships, clubs } from '@/db/schema';
import { requireVerifiedStudent } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const joinSchema = z.object({
  code: z.string().trim().min(4).max(32),
});

export async function POST(req: Request) {
  try {
    const user = await requireVerifiedStudent();
    const body = await req.json();
    const { code } = joinSchema.parse(body);
    const normalized = code.toUpperCase();

    const result = await db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(clubInviteCodes)
        .where(eq(clubInviteCodes.code, normalized))
        .limit(1);

      if (!invite) {
        throw new AppError(404, 'INVITE_CODE_NOT_FOUND', '找不到此社團邀請碼。');
      }

      if (invite.revokedAt || invite.expiresAt <= new Date()) {
        throw new AppError(410, 'INVITE_CODE_EXPIRED', '此邀請碼已過期或已被幹部撤銷。');
      }

      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
        throw new AppError(410, 'INVITE_CODE_EXHAUSTED', '此邀請碼使用次數已達上限。');
      }

      const [club] = await tx
        .select()
        .from(clubs)
        .where(eq(clubs.id, invite.clubId))
        .limit(1);

      if (!club || club.verificationStatus !== 'verified') {
        throw new AppError(404, 'CLUB_NOT_AVAILABLE', '此社團目前無法加入。');
      }

      if (user.universityId !== club.universityId) {
        throw new AppError(
          403,
          'UNIVERSITY_MISMATCH',
          '社團認證邀請碼僅限同校區 .edu.tw 學生使用，無法跨校認證。'
        );
      }

      const [existing] = await tx
        .select()
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, club.id),
            eq(clubMemberships.userId, user.id),
            isNull(clubMemberships.endedAt)
          )
        )
        .limit(1);

      if (existing) {
        return {
          club_id: club.id,
          club_slug: club.slug,
          club_name: club.name,
          role: existing.role,
          already_member: true,
        };
      }

      await tx.insert(clubMemberships).values({
        clubId: club.id,
        userId: user.id,
        role: 'member',
        title: '認證社員',
      });

      await tx
        .update(clubInviteCodes)
        .set({ usedCount: sql`${clubInviteCodes.usedCount} + 1` })
        .where(eq(clubInviteCodes.id, invite.id));

      return {
        club_id: club.id,
        club_slug: club.slug,
        club_name: club.name,
        role: 'member' as const,
        already_member: false,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
