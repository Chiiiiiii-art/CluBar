import crypto from 'node:crypto';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { campusEmailOtps, universities, users } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const confirmSchema = z.object({
  campus_email: z.string().trim().email().max(180),
  code: z.string().trim().regex(/^\d{6}$/, '請輸入 6 位數字驗證碼。'),
});

function hashOtp(code: string): string {
  const pepper = process.env.OTP_HASH_PEPPER?.trim() || 'clubar-dev-otp-pepper';
  return crypto.createHash('sha256').update(`${code}:${pepper}`).digest('hex');
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = confirmSchema.parse(body);
    const campusEmail = parsed.campus_email.toLowerCase();

    const [otp] = await db
      .select()
      .from(campusEmailOtps)
      .where(
        and(
          eq(campusEmailOtps.userId, user.id),
          eq(campusEmailOtps.campusEmail, campusEmail),
          isNull(campusEmailOtps.consumedAt)
        )
      )
      .orderBy(desc(campusEmailOtps.createdAt))
      .limit(1);

    if (!otp || otp.expiresAt.getTime() <= Date.now() || otp.attempts >= 5) {
      throw new AppError(400, 'OTP_INVALID_OR_EXPIRED', '驗證碼無效或已過期，請重新申請。');
    }

    const expectedBuf = Buffer.from(otp.otpHash, 'hex');
    const actualBuf = Buffer.from(hashOtp(parsed.code), 'hex');
    const matched =
      expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);

    if (!matched) {
      const nextAttempts = otp.attempts + 1;
      await db
        .update(campusEmailOtps)
        .set({
          attempts: nextAttempts,
          consumedAt: nextAttempts >= 5 ? new Date() : null,
        })
        .where(eq(campusEmailOtps.id, otp.id));

      throw new AppError(400, 'OTP_INVALID_OR_EXPIRED', '驗證碼錯誤或已失效，請確認後再試。');
    }

    const verifiedAt = new Date();
    const uni = await db.transaction(async (tx) => {
      const [existingHolder] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.campusEmail, campusEmail), ne(users.id, user.id)))
        .limit(1);
      if (existingHolder) {
        throw new AppError(409, 'CAMPUS_EMAIL_IN_USE', '此校園信箱已綁定至其他帳號。');
      }

      await tx
        .update(campusEmailOtps)
        .set({ consumedAt: verifiedAt })
        .where(eq(campusEmailOtps.id, otp.id));

      await tx
        .update(users)
        .set({
          campusEmail,
          universityId: otp.universityId,
          campusVerifiedAt: verifiedAt,
          updatedAt: verifiedAt,
        })
        .where(eq(users.id, user.id));

      const [university] = await tx
        .select()
        .from(universities)
        .where(eq(universities.id, otp.universityId))
        .limit(1);
      return university;
    });

    return NextResponse.json({
      university_name: uni?.name ?? '',
      verified_at: verifiedAt.toISOString(),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
