import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { respondHandover } from '@/lib/services/handover';

const respondSchema = z.object({
  action: z.enum(['accept', 'reject', 'cancel']),
});

const uuidSchema = z.string().uuid('無效的交接識別碼。');

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const validId = uuidSchema.parse(id);

    const body = await req.json();
    const parsed = respondSchema.parse(body);

    const result = await respondHandover({
      handoverId: validId,
      actingUserId: user.id,
      action: parsed.action,
    });

    return NextResponse.json({
      handover: {
        id: result.id,
        status: result.status,
        resolved_at: result.resolvedAt ? result.resolvedAt.toISOString() : null,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
