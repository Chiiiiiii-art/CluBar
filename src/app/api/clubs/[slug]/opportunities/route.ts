import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubOpportunities, clubs } from '@/db/schema';
import { requireClubRole } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { serializePublicOpportunity } from '@/lib/serializers';
import { opportunityWriteSchema } from '@/lib/validators';

const patchWithIdSchema = opportunityWriteSchema.partial().extend({
  id: z.string().uuid('請提供有效的參與機會 ID。'),
});

const deleteWithIdSchema = z.object({
  id: z.string().uuid('請提供有效的參與機會 ID。'),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    await requireClubRole(club.id, ['owner', 'editor']);
    const body = await req.json();
    const parsed = opportunityWriteSchema.parse(body);

    const [created] = await db
      .insert(clubOpportunities)
      .values({
        clubId: club.id,
        title: parsed.title,
        summary: parsed.summary,
        scheduleText: parsed.schedule_text ?? null,
        deadlineAt: parsed.deadline_at ? new Date(parsed.deadline_at) : null,
        externalUrl: parsed.external_url,
        isActive: parsed.is_active,
      })
      .returning();

    return NextResponse.json({ opportunity: serializePublicOpportunity(created) }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    await requireClubRole(club.id, ['owner', 'editor']);
    const body = await req.json();
    const parsed = patchWithIdSchema.parse(body);

    const [updated] = await db
      .update(clubOpportunities)
      .set({
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.summary !== undefined ? { summary: parsed.summary } : {}),
        ...(parsed.schedule_text !== undefined ? { scheduleText: parsed.schedule_text } : {}),
        ...(parsed.deadline_at !== undefined
          ? { deadlineAt: parsed.deadline_at ? new Date(parsed.deadline_at) : null }
          : {}),
        ...(parsed.external_url !== undefined ? { externalUrl: parsed.external_url } : {}),
        ...(parsed.is_active !== undefined ? { isActive: parsed.is_active } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(clubOpportunities.id, parsed.id), eq(clubOpportunities.clubId, club.id)))
      .returning();

    if (!updated) {
      throw new AppError(404, 'OPPORTUNITY_NOT_FOUND', '找不到此參與機會項目。');
    }

    return NextResponse.json({ opportunity: serializePublicOpportunity(updated) });
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

    await requireClubRole(club.id, ['owner', 'editor']);
    const body = await req.json();
    const parsed = deleteWithIdSchema.parse(body);

    const deleted = await db
      .delete(clubOpportunities)
      .where(and(eq(clubOpportunities.id, parsed.id), eq(clubOpportunities.clubId, club.id)))
      .returning({ id: clubOpportunities.id });

    if (deleted.length === 0) {
      throw new AppError(404, 'OPPORTUNITY_NOT_FOUND', '找不到此參與機會項目。');
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
