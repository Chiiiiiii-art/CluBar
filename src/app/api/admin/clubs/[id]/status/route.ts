import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, clubMemberships, clubs, notifications } from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const uuidSchema = z.string().uuid('無效的社團識別碼。');

const statusSchema = z.object({
  action: z.literal('unsuspend'),
  note: z.string().trim().max(400).default(''),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await context.params;
    const clubId = uuidSchema.parse(id);

    const body = await req.json();
    const parsed = statusSchema.parse(body);

    await db.transaction(async (tx) => {
      const [club] = await tx.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
      if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

      await tx
        .update(clubs)
        .set({ verificationStatus: 'verified', updatedAt: new Date() })
        .where(eq(clubs.id, clubId));

      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: 'club.unsuspended',
        targetType: 'club',
        targetId: clubId,
        metadata: { note: parsed.note },
      });

      const owners = await tx
        .select({ userId: clubMemberships.userId })
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, clubId),
            eq(clubMemberships.role, 'owner'),
            isNull(clubMemberships.endedAt)
          )
        );

      for (const owner of owners) {
        await tx.insert(notifications).values({
          userId: owner.userId,
          type: 'moderation_notice',
          title: `社團發文權限已恢復：${club.name}`,
          body: parsed.note
            ? `管理員已解除暫停處置（備註：${parsed.note}）。`
            : '管理員已解除社團暫停處置，現在可正常發布與編輯成果貼文。',
          linkUrl: `/clubs/${club.slug}/manage`,
        });
      }
    });

    return NextResponse.json({ verification_status: 'verified' });
  } catch (err) {
    return handleApiError(err);
  }
}
