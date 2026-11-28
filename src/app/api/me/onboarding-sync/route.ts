import { inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { interestDomains, userOnboardingProfiles } from '@/db/schema';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { computePersonaArchetype } from '@/lib/services/onboarding-blend';

const syncSchema = z.object({
  university_id: z.string().uuid().optional().nullable(),
  goals: z.array(z.string().trim().max(40)).max(4).default([]),
  domain_ids: z.array(z.string().uuid()).max(12).default([]),
  vibe: z.string().trim().max(32).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const parsed = syncSchema.parse(await req.json());

    const domainRows =
      parsed.domain_ids.length > 0
        ? await db
            .select({ nameZh: interestDomains.nameZh })
            .from(interestDomains)
            .where(inArray(interestDomains.id, parsed.domain_ids))
        : [];
    const archetype = computePersonaArchetype({
      goals: parsed.goals,
      vibe: parsed.vibe,
      domainNames: domainRows.map((d) => d.nameZh),
    });

    await db
      .insert(userOnboardingProfiles)
      .values({
        userId: user.id,
        selectedUniversityId: parsed.university_id ?? user.universityId ?? null,
        goals: parsed.goals,
        domainIds: parsed.domain_ids,
        vibe: parsed.vibe ?? null,
        personaArchetype: archetype,
      })
      .onConflictDoUpdate({
        target: userOnboardingProfiles.userId,
        set: {
          selectedUniversityId: parsed.university_id ?? user.universityId ?? null,
          goals: parsed.goals,
          domainIds: parsed.domain_ids,
          vibe: parsed.vibe ?? null,
          personaArchetype: archetype,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ synced: true, persona_archetype: archetype });
  } catch (err) {
    return handleApiError(err);
  }
}
