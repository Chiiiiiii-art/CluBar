import crypto from 'node:crypto';
import { and, desc, eq, gte, isNull, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { campusEmailOtps, universities, users } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { sendEmail } from '@/lib/email';
import { AppError, handleApiError } from '@/lib/errors';
import { assertRateLimit } from '@/lib/rate-limit';
import { matchesUniversityDomain } from '@/lib/validators';

const requestSchema = z.object({
  campus_email: z.string().trim().email('請輸入有效的電子信箱格式。').max(180),
});

function hashOtp(code: string): string {
  const pepper = process.env.OTP_HASH_PEPPER?.trim() || 'clubar-dev-otp-pepper';
  return crypto.createHash('sha256').update(`${code}:${pepper}`).digest('hex');
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    assertRateLimit(`otp:req:${user.id}`, 3, 60 * 1000);

    const body = await req.json();
    const parsed = requestSchema.parse(body);
    const campusEmail = parsed.campus_email.toLowerCase();

    const allUnis = await db.select().from(universities);
    const matchedUni = allUnis.find((u) => matchesUniversityDomain(campusEmail, u.emailDomains));
    if (!matchedUni) {
      throw new AppError(
        400,
        'UNSUPPORTED_CAMPUS_DOMAIN',
        '目前僅支援名錄內大專校院（.edu.tw）校園信箱，請確認信箱網域是否正確。'
      );
    }

    const [existingHolder] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.campusEmail, campusEmail), ne(users.id, user.id)))
      .limit(1);
    if (existingHolder) {
      throw new AppError(
        409,
        'CAMPUS_EMAIL_IN_USE',
        '此校園信箱已綁定至其他帳號，請改用原帳號登入或聯繫平台協助。'
      );
    }

    const oneMinAgo = new Date(Date.now() - 60 * 1000);
    const [recentOtp] = await db
      .select({ id: campusEmailOtps.id })
      .from(campusEmailOtps)
      .where(
        and(
          eq(campusEmailOtps.userId, user.id),
          isNull(campusEmailOtps.consumedAt),
          gte(campusEmailOtps.createdAt, oneMinAgo)
        )
      )
      .orderBy(desc(campusEmailOtps.createdAt))
      .limit(1);

    if (recentOtp) {
      throw new AppError(429, 'RATE_LIMITED', '請等待 1 分鐘後再重新發送驗證碼。');
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const otpHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.insert(campusEmailOtps).values({
      userId: user.id,
      campusEmail,
      universityId: matchedUni.id,
      otpHash,
      expiresAt,
    });

    await sendEmail({
      to: campusEmail,
      subject: '【社團聚 CluBar】校園信箱驗證碼（10 分鐘內有效）',
      text: `您好，您正在驗證 ${matchedUni.name} 校園身分。\n您的 6 位數驗證碼為：${code}\n此驗證碼將於 10 分鐘後失效，請勿轉傳他人。`,
      html: `<p>您好，您正在驗證 <strong>${matchedUni.name}</strong> 校園身分。</p><p>您的 6 位數驗證碼為：<strong style="font-size:20px;letter-spacing:2px;">${code}</strong></p><p>此驗證碼將於 10 分鐘後失效。</p>`,
    });

    return NextResponse.json({
      sent: true,
      university_name: matchedUni.name,
      expires_in_seconds: 600,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
