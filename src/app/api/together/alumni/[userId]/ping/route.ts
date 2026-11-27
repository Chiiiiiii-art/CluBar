import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { alumniPings, interestDomains, users } from '@/db/schema';
import { requireVerifiedStudent } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { notifyUsers } from '@/lib/notifications/push';
import { assertRateLimit } from '@/lib/rate-limit';

const pingSchema = z.object({
  domain_id: z.string().uuid(),
  expertise_tag: z.string().trim().min(1).max(30),
  message: z.string().trim().min(10, '詢問內容至少 10 個字').max(500),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const sender = await requireVerifiedStudent();
    const { userId: toAlumniId } = await context.params;
    const validTargetId = z.string().uuid('無效的學長姐帳號識別碼。').parse(toAlumniId);

    if (validTargetId === sender.id) {
      throw new AppError(400, 'SELF_PING_NOT_ALLOWED', '無法對自己發送請益請求。');
    }

    assertRateLimit(
      `alumni-ping:${sender.id}`,
      3,
      24 * 60 * 60 * 1000,
      '每天最多發出 3 次歷屆學長姐經驗請益請求，請珍惜前輩時間。'
    );

    const body = await req.json();
    const parsed = pingSchema.parse(body);

    const [target] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        alumniPingEnabled: users.alumniPingEnabled,
      })
      .from(users)
      .where(eq(users.id, validTargetId))
      .limit(1);

    if (!target || !target.alumniPingEnabled) {
      throw new AppError(404, 'ALUMNI_NOT_AVAILABLE', '對方尚未開啟歷屆學長姐請益接收功能。');
    }

    const [domain] = await db
      .select({ id: interestDomains.id, nameZh: interestDomains.nameZh })
      .from(interestDomains)
      .where(eq(interestDomains.id, parsed.domain_id))
      .limit(1);
    if (!domain) {
      throw new AppError(404, 'DOMAIN_NOT_FOUND', '找不到指定興趣領域。');
    }

    const [created] = await db
      .insert(alumniPings)
      .values({
        fromUserId: sender.id,
        toAlumniId: target.id,
        domainId: domain.id,
        expertiseTag: parsed.expertise_tag,
        message: parsed.message,
      })
      .returning();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(req.url).origin;
    await notifyUsers({
      userIds: [target.id],
      type: 'alumni_ping',
      title: `來自學弟妹的「${parsed.expertise_tag}」請益 (${domain.nameZh})`,
      body: `${sender.displayName}：${parsed.message}`,
      linkUrl: `${baseUrl}/me`,
      emailSubject: `[CluBar 歷屆經驗請益] ${parsed.expertise_tag}`,
      fallbackToEmail: true,
    });

    return NextResponse.json(
      {
        ping: {
          id: created.id,
          created_at: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
