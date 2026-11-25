import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubOpportunities, clubs } from '@/db/schema';
import { requireClubRole } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { serializePublicOpportunity } from '@/lib/serializers';
import { opportunityWriteSchema } from '@/lib/validators';

const uuidSchema = z.string().uuid();

export async function PATCH(
  req: Request,
  context: { params: Promise<{ slug: string; opportunityId: string }> }
) {
  try {
    const { slug, opportunityId } = await context.params;
    const validOppId = uuidSchema.parse(opportunityId);
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    await requireClubRole(club.id, ['owner', 'editor']);
    const body = await req.json();
    const parsed = opportunityWriteSchema.partial().parse(body);

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
      .where(and(eq(clubOpportunities.id, validOppId), eq(clubOpportunities.clubId, club.id)))
      .returning();

    if (!updated) throw new AppError(404, 'OPPORTUNITY_NOT_FOUND', '找不到此參與機會項目。');
    return NextResponse.json({ opportunity: serializePublicOpportunity(updated) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ slug: string; opportunityId: string }> }
) {
  try {
    const { slug, opportunityId } = await context.params;
    const validOppId = uuidSchema.parse(opportunityId);
    const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
    if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');

    await requireClubRole(club.id, ['owner', 'editor']);
    const deleted = await db
      .delete(clubOpportunities)
      .where(and(eq(clubOpportunities.id, validOppId), eq(clubOpportunities.clubId, club.id)))
      .returning({ id: clubOpportunities.id });

    if (deleted.length === 0) {
      throw new AppError(404, 'OPPORTUNITY_NOT_FOUND', '找不到此參與機會項目。');
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
