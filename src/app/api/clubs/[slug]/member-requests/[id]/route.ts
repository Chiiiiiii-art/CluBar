import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubMemberRequests, clubMemberships, clubs, notifications } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const reviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user } = await requireClubOfficer(club.id);
    const body = await req.json();
    const { decision } = reviewSchema.parse(body);

    const updated = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(clubMemberRequests)
        .where(
          and(eq(clubMemberRequests.id, id), eq(clubMemberRequests.clubId, club.id))
        )
        .limit(1);

      if (!request) {
        throw new AppError(404, 'MEMBER_REQUEST_NOT_FOUND', '找不到指定入社申請。');
      }
      if (request.status !== 'pending') {
        throw new AppError(409, 'REQUEST_ALREADY_REVIEWED', '此申請已完成審核。');
      }

      const [nextReq] = await tx
        .update(clubMemberRequests)
        .set({
          status: decision === 'approve' ? 'approved' : 'rejected',
          reviewerId: user.id,
          reviewedAt: new Date(),
        })
        .where(eq(clubMemberRequests.id, request.id))
        .returning();

      if (decision === 'approve') {
        const [active] = await tx
          .select({ id: clubMemberships.id })
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.clubId, club.id),
              eq(clubMemberships.userId, request.userId),
              isNull(clubMemberships.endedAt)
            )
          )
          .limit(1);

        if (!active) {
          await tx.insert(clubMemberships).values({
            clubId: club.id,
            userId: request.userId,
            role: 'member',
            title: '認證社員',
          });
        }

        await tx.insert(notifications).values({
          userId: request.userId,
          type: 'member_request_approved',
          title: `社員身分認證通過：${club.name}`,
          body: `你已成為「${club.name}」的認證社員，現在可於「我的社團」發布社員日常 (NRC) 與作品紀錄！`,
          linkUrl: '/my-clubs',
        });
      }

      return nextReq;
    });

    return NextResponse.json({
      request: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
