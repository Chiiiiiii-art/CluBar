import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { buildUserPortfolio } from '@/lib/services/portfolio';

const patchPortfolioSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{2,28}[a-z0-9]$/, '個人代號須為 4–30 字小寫英數字或連字號')
    .optional()
    .nullable(),
  portfolio_visibility: z.enum(['public', 'campus_only', 'private']).optional(),
  talent_discovery_opt_in: z.boolean().optional(),
  alumni_ping_enabled: z.boolean().optional(),
  alumni_expertise_tags: z.array(z.string().trim().min(1).max(24)).max(3, '最多填寫 3 個專長標籤').optional(),
});

export async function GET() {
  try {
    const user = await requireAuth();
    const { portfolio } = await buildUserPortfolio({
      targetUserId: user.id,
      viewer: user,
    });
    return NextResponse.json({ portfolio });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const parsed = patchPortfolioSchema.parse(body);

    if (parsed.handle) {
      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.handle, parsed.handle), ne(users.id, user.id)))
        .limit(1);
      if (taken) {
        throw new AppError(409, 'HANDLE_TAKEN', '此個人公開網址代號已被其他人使用。');
      }
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(parsed.handle !== undefined ? { handle: parsed.handle } : {}),
        ...(parsed.portfolio_visibility !== undefined
          ? { portfolioVisibility: parsed.portfolio_visibility }
          : {}),
        ...(parsed.talent_discovery_opt_in !== undefined
          ? { talentDiscoveryOptIn: parsed.talent_discovery_opt_in }
          : {}),
        ...(parsed.alumni_ping_enabled !== undefined
          ? { alumniPingEnabled: parsed.alumni_ping_enabled }
          : {}),
        ...(parsed.alumni_expertise_tags !== undefined
          ? { alumniExpertiseTags: parsed.alumni_expertise_tags }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json({
      settings: {
        handle: updated.handle,
        portfolio_visibility: updated.portfolioVisibility,
        talent_discovery_opt_in: updated.talentDiscoveryOptIn,
        alumni_ping_enabled: updated.alumniPingEnabled,
        alumni_expertise_tags: updated.alumniExpertiseTags,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
