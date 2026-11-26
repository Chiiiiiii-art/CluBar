import { NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubMemberRequests, clubMemberships, clubs, users } from '@/db/schema';
import { requireClubOfficer, requireSameUniversity } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const createRequestSchema = z.object({
  note: z.string().trim().max(300).optional().nullable(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    await requireClubOfficer(club.id);

    const rows = await db
      .select({
        id: clubMemberRequests.id,
        userId: clubMemberRequests.userId,
        displayName: users.displayName,
        note: clubMemberRequests.note,
        status: clubMemberRequests.status,
        createdAt: clubMemberRequests.createdAt,
      })
      .from(clubMemberRequests)
      .innerJoin(users, eq(clubMemberRequests.userId, users.id))
      .where(eq(clubMemberRequests.clubId, club.id))
      .orderBy(desc(clubMemberRequests.createdAt))
      .limit(50);

    return NextResponse.json({
      requests: rows.map((r) => ({
        id: r.id,
        user_id: r.userId,
        display_name: r.displayName,
        note: r.note,
        status: r.status,
        created_at: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club || club.verificationStatus !== 'verified') {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定認證社團。');
    }

    const user = await requireSameUniversity(club.universityId);
    const raw = await req.text();
    const parsed = createRequestSchema.parse(raw ? JSON.parse(raw) : {});

    const [activeMember] = await db
      .select({ id: clubMemberships.id })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, club.id),
          eq(clubMemberships.userId, user.id),
          isNull(clubMemberships.endedAt)
        )
      )
      .limit(1);

    if (activeMember) {
      throw new AppError(409, 'ALREADY_CLUB_MEMBER', '你已經是此社團的認證社員或幹部。');
    }

    const [existingPending] = await db
      .select({ id: clubMemberRequests.id })
      .from(clubMemberRequests)
      .where(
        and(
          eq(clubMemberRequests.clubId, club.id),
          eq(clubMemberRequests.userId, user.id),
          eq(clubMemberRequests.status, 'pending')
        )
      )
      .limit(1);

    if (existingPending) {
      throw new AppError(409, 'REQUEST_ALREADY_PENDING', '已送出認證社員申請，請等待幹部審核。');
    }

    const [created] = await db
      .insert(clubMemberRequests)
      .values({
        clubId: club.id,
        userId: user.id,
        note: parsed.note ?? null,
        status: 'pending',
      })
      .returning();

    return NextResponse.json(
      {
        request: {
          id: created.id,
          status: created.status,
          created_at: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
