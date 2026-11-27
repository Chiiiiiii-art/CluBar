import { and, asc, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, clubMemberships, clubs, notifications, users } from '@/db/schema';
import { requireClubOfficer, requireClubOwner } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const addMemberSchema = z.object({
  user_campus_email_or_id: z.string().trim().min(3).max(180),
  role: z.enum(['editor', 'member']).default('editor'),
  title: z.string().trim().max(40).optional().nullable(),
});

const removeMemberSchema = z.object({
  user_id: z.string().uuid('無效的使用者識別碼。'),
  archive_as_alumni: z.boolean().default(false),
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
        userId: clubMemberships.userId,
        displayName: users.displayName,
        role: clubMemberships.role,
        title: clubMemberships.title,
        joinedAt: clubMemberships.joinedAt,
      })
      .from(clubMemberships)
      .innerJoin(users, eq(clubMemberships.userId, users.id))
      .where(and(eq(clubMemberships.clubId, club.id), isNull(clubMemberships.endedAt)))
      .orderBy(asc(clubMemberships.joinedAt));

    return NextResponse.json({
      members: rows.map((r) => ({
        user_id: r.userId,
        display_name: r.displayName,
        role: r.role,
        title: r.title,
        joined_at: r.joinedAt.toISOString(),
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
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const body = await req.json();
    const parsed = addMemberSchema.parse(body);

    const { user } =
      parsed.role === 'editor'
        ? await requireClubOwner(club.id)
        : await requireClubOfficer(club.id);

    const identifier = parsed.user_campus_email_or_id;
    const isUuid = z.string().uuid().safeParse(identifier).success;

    const [target] = isUuid
      ? await db.select().from(users).where(eq(users.id, identifier)).limit(1)
      : await db
          .select()
          .from(users)
          .where(eq(users.campusEmail, identifier.toLowerCase()))
          .limit(1);

    // Generic error message prevents campus email enumeration (SRS §5.3)
    if (!target || !target.campusVerifiedAt || target.universityId !== club.universityId) {
      throw new AppError(
        400,
        'TARGET_NOT_ELIGIBLE',
        '目標帳號須為同校已完成 .edu.tw 校園驗證之使用者。'
      );
    }

    const [existingActive] = await db
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, club.id),
          eq(clubMemberships.userId, target.id),
          isNull(clubMemberships.endedAt)
        )
      )
      .limit(1);

    if (existingActive) {
      if (existingActive.role === 'owner') {
        throw new AppError(409, 'ALREADY_OWNER', '此使用者已是現任社長。');
      }
      if (existingActive.role !== parsed.role) {
        await requireClubOwner(club.id);
      }
      const [updated] = await db
        .update(clubMemberships)
        .set({
          role: parsed.role,
          title: parsed.title?.trim() || existingActive.title,
        })
        .where(eq(clubMemberships.id, existingActive.id))
        .returning();

      return NextResponse.json({
        member: {
          user_id: target.id,
          display_name: target.displayName,
          role: updated.role,
          title: updated.title,
        },
      });
    }

    const defaultTitle = parsed.role === 'editor' ? '幹部' : '認證社員';
    const [inserted] = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(clubMemberships)
        .values({
          clubId: club.id,
          userId: target.id,
          role: parsed.role,
          title: parsed.title?.trim() || defaultTitle,
        })
        .returning();

      await tx.insert(notifications).values({
        userId: target.id,
        type: 'application_result',
        title: `已加入${club.name}（${parsed.role === 'editor' ? '幹部' : '認證社員'}）`,
        body:
          parsed.role === 'editor'
            ? `您已被現任社長指派為「${club.name}」幹部，可管理活動與社團專頁。`
            : `您已成為「${club.name}」認證社員，可於「我的社團」記錄社員日常與作品。`,
        linkUrl: parsed.role === 'editor' ? `/clubs/${club.slug}/manage` : '/my-clubs',
      });

      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        action: 'club.member.added',
        targetType: 'club',
        targetId: club.id,
        metadata: { member_user_id: target.id, role: parsed.role },
      });

      return [row];
    });

    return NextResponse.json(
      {
        member: {
          user_id: target.id,
          display_name: target.displayName,
          role: inserted.role,
          title: inserted.title,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user } = await requireClubOfficer(club.id);
    const body = await req.json();
    const parsed = removeMemberSchema.parse(body);

    if (parsed.user_id === user.id) {
      throw new AppError(400, 'CANNOT_REMOVE_OWNER', '社長無法直接移除自己，請改用換屆交接功能。');
    }

    const [targetMembership] = await db
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, club.id),
          eq(clubMemberships.userId, parsed.user_id),
          isNull(clubMemberships.endedAt)
        )
      )
      .limit(1);

    if (!targetMembership) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', '找不到此有效社員或幹部紀錄。');
    }
    if (targetMembership.role === 'owner') {
      throw new AppError(400, 'CANNOT_REMOVE_OWNER', '社長無法直接移除，請透過換屆交接移轉。');
    }
    if (targetMembership.role === 'editor') {
      await requireClubOwner(club.id);
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(clubMemberships)
        .set({
          endedAt: now,
          ...(parsed.archive_as_alumni ? { role: 'alumni' } : {}),
        })
        .where(eq(clubMemberships.id, targetMembership.id));

      await tx.insert(auditLogs).values({
        actorUserId: user.id,
        action: parsed.archive_as_alumni ? 'club.member.archived_alumni' : 'club.member.removed',
        targetType: 'club',
        targetId: club.id,
        metadata: { member_user_id: parsed.user_id, previous_role: targetMembership.role },
      });
    });

    return NextResponse.json({ removed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
