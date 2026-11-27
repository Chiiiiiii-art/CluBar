import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubMemberships, clubs, coClubLinks, notifications } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const respondSchema = z.object({
  decision: z.enum(['accept', 'reject']),
  partner_include_eval: z.boolean().default(true),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const [link] = await db
      .select()
      .from(coClubLinks)
      .where(eq(coClubLinks.id, id))
      .limit(1);

    if (!link) {
      throw new AppError(404, 'COCLUB_INVITE_NOT_FOUND', '找不到此 Co-Club 共辦邀請。');
    }
    if (link.status !== 'pending') {
      throw new AppError(409, 'COCLUB_ALREADY_RESPONDED', '此邀請已完成回應。');
    }

    const { user, club: partnerClub } = await requireClubOfficer(link.partnerClubId);
    const body = await req.json();
    const parsed = respondSchema.parse(body);

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(coClubLinks)
        .set({
          status: parsed.decision === 'accept' ? 'accepted' : 'rejected',
          partnerIncludeEval:
            parsed.decision === 'accept' ? parsed.partner_include_eval : false,
          respondedBy: user.id,
          respondedAt: new Date(),
        })
        .where(eq(coClubLinks.id, link.id))
        .returning();

      const [hostClub] = await tx
        .select({ name: clubs.name })
        .from(clubs)
        .where(eq(clubs.id, link.hostClubId))
        .limit(1);

      const hostOfficers = await tx
        .select({ userId: clubMemberships.userId })
        .from(clubMemberships)
        .where(
          and(
            eq(clubMemberships.clubId, link.hostClubId),
            isNull(clubMemberships.endedAt),
            inArray(clubMemberships.role, ['owner', 'editor'])
          )
        );

      if (hostOfficers.length > 0) {
        await tx.insert(notifications).values(
          hostOfficers.map((o) => ({
            userId: o.userId,
            type: 'coclub_responded',
            title: `${partnerClub.name} ${
              parsed.decision === 'accept' ? '已同意' : '已婉拒'
            }共辦邀請`,
            body:
              parsed.decision === 'accept'
                ? `${hostClub?.name ?? '本社'} 與 ${partnerClub.name} 的 Co-Club 共辦關係已建立。`
                : `${partnerClub.name} 婉拒了本次 Co-Club 共辦邀請。`,
            linkUrl: '/together',
          }))
        );
      }

      return row;
    });

    return NextResponse.json({
      invitation: {
        id: updated.id,
        status: updated.status,
        partner_include_eval: updated.partnerIncludeEval,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
