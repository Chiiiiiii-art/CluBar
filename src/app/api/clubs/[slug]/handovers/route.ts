import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubs } from '@/db/schema';
import { requireClubOwner } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { createHandover } from '@/lib/services/handover';
import { handoverPitfallNoteSchema } from '@/lib/validators';

const handoverCreateSchema = z
  .object({
    to_user_id: z.string().uuid().optional(),
    to_campus_email: z.string().trim().email().optional(),
    pitfall_note: handoverPitfallNoteSchema.optional(),
    share_deidentified: z.boolean().default(false),
  })
  .refine((data) => Boolean(data.to_user_id || data.to_campus_email), {
    message: '請選擇接任幹部或輸入接任者校園信箱。',
  });

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    const { user } = await requireClubOwner(club.id);
    const body = await req.json();
    const parsed = handoverCreateSchema.parse(body);

    const handover = await createHandover({
      clubId: club.id,
      fromUserId: user.id,
      toUserId: parsed.to_user_id,
      toCampusEmail: parsed.to_campus_email,
      pitfallNote: parsed.pitfall_note ?? null,
      shareDeidentified: parsed.share_deidentified,
    });

    return NextResponse.json(
      {
        handover: {
          id: handover.id,
          status: handover.status,
          expires_at: handover.expiresAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
