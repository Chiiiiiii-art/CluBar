import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { clubInviteCodes, clubs } from '@/db/schema';
import { requireClubOfficer } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const createCodeSchema = z.object({
  expires_in_days: z.number().int().min(1).max(30).default(7),
  max_uses: z.number().int().min(1).max(500).optional().nullable(),
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
      .select()
      .from(clubInviteCodes)
      .where(and(eq(clubInviteCodes.clubId, club.id), isNull(clubInviteCodes.revokedAt)))
      .orderBy(desc(clubInviteCodes.createdAt))
      .limit(10);

    return NextResponse.json({
      invite_codes: rows.map((r) => ({
        id: r.id,
        code: r.code,
        max_uses: r.maxUses,
        used_count: r.usedCount,
        expires_at: r.expiresAt.toISOString(),
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
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user } = await requireClubOfficer(club.id);
    const raw = await req.text();
    const parsed = createCodeSchema.parse(raw ? JSON.parse(raw) : {});

    const prefix = club.slug
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 4)
      .toUpperCase();
    const code = `${prefix || 'CLUB'}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresAt = new Date(Date.now() + parsed.expires_in_days * 24 * 60 * 60 * 1000);

    const [created] = await db
      .insert(clubInviteCodes)
      .values({
        clubId: club.id,
        code,
        createdBy: user.id,
        maxUses: parsed.max_uses ?? null,
        expiresAt,
      })
      .returning();

    return NextResponse.json(
      {
        invite_code: {
          id: created.id,
          code: created.code,
          max_uses: created.maxUses,
          used_count: created.usedCount,
          expires_at: created.expiresAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
