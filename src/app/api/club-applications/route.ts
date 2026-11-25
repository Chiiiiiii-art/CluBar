import { and, eq, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { clubApplications, clubMemberships, clubs, universities } from '@/db/schema';
import { requireVerifiedStudent } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { clubCategorySchema, safeExternalUrlSchema, slugSchema } from '@/lib/validators';

const applicationSchema = z
  .object({
    type: z.enum(['directory_claim', 'new_club', 'owner_takeover']),
    target_club_id: z.string().uuid().optional().nullable(),
    proposed_university_id: z.string().uuid().optional().nullable(),
    proposed_name: z.string().trim().min(2).max(60).optional().nullable(),
    proposed_slug: slugSchema.optional().nullable(),
    proposed_category: clubCategorySchema.optional().nullable(),
    evidence_text: z.string().trim().min(10, '請提供至少 10 字的幹部佐證說明。').max(2000),
    evidence_urls: z.array(safeExternalUrlSchema).max(5).default([]),
  })
  .superRefine((data, ctx) => {
    if (
      (data.type === 'directory_claim' || data.type === 'owner_takeover') &&
      !data.target_club_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['target_club_id'],
        message: '請選擇要認領或申訴接管的社團。',
      });
    }
    if (data.type === 'new_club') {
      if (!data.proposed_university_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposed_university_id'],
          message: '請選擇所屬大專校院。',
        });
      }
      if (!data.proposed_name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposed_name'],
          message: '請填寫社團正式名稱。',
        });
      }
      if (!data.proposed_slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposed_slug'],
          message: '請填寫社團公開網址代碼。',
        });
      }
      if (!data.proposed_category) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposed_category'],
          message: '請選擇台灣大專六大社團分類。',
        });
      }
    }
  });

export async function POST(req: Request) {
  try {
    const user = await requireVerifiedStudent();
    const body = await req.json();
    const parsed = applicationSchema.parse(body);

    const created = await db.transaction(async (tx) => {
      if (parsed.type === 'directory_claim') {
        const targetId = parsed.target_club_id!;
        const [club] = await tx.select().from(clubs).where(eq(clubs.id, targetId)).limit(1);
        if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定名錄社團。');

        const [activeOwner] = await tx
          .select({ id: clubMemberships.id })
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.clubId, targetId),
              eq(clubMemberships.role, 'owner'),
              isNull(clubMemberships.endedAt)
            )
          )
          .limit(1);

        if (club.verificationStatus !== 'unclaimed_directory' || activeOwner) {
          throw new AppError(
            409,
            'CLUB_ALREADY_CLAIMED',
            '此社團已有現任社長認證管理，請改聯繫現任社長加為幹部，或提出「社長失聯接管申訴」。'
          );
        }
      } else if (parsed.type === 'owner_takeover') {
        const targetId = parsed.target_club_id!;
        const [club] = await tx.select().from(clubs).where(eq(clubs.id, targetId)).limit(1);
        if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
        if (club.verificationStatus === 'unclaimed_directory') {
          throw new AppError(
            400,
            'USE_DIRECTORY_CLAIM',
            '此社團尚未被認領，請直接使用「名錄社團認領」流程。'
          );
        }
      } else if (parsed.type === 'new_club') {
        const [uni] = await tx
          .select({ id: universities.id })
          .from(universities)
          .where(eq(universities.id, parsed.proposed_university_id!))
          .limit(1);
        if (!uni) throw new AppError(400, 'UNIVERSITY_NOT_FOUND', '找不到指定的學校。');

        const [existingClub] = await tx
          .select({ id: clubs.id })
          .from(clubs)
          .where(
            or(
              eq(clubs.slug, parsed.proposed_slug!),
              and(
                eq(clubs.universityId, parsed.proposed_university_id!),
                eq(clubs.name, parsed.proposed_name!)
              )
            )
          )
          .limit(1);

        const [pendingSame] = await tx
          .select({ id: clubApplications.id })
          .from(clubApplications)
          .where(
            and(
              eq(clubApplications.status, 'pending'),
              or(
                eq(clubApplications.proposedSlug, parsed.proposed_slug!),
                and(
                  eq(clubApplications.proposedUniversityId, parsed.proposed_university_id!),
                  eq(clubApplications.proposedName, parsed.proposed_name!)
                )
              )
            )
          )
          .limit(1);

        if (existingClub || pendingSame) {
          throw new AppError(
            409,
            'CLUB_NAME_OR_SLUG_TAKEN',
            '同校社團名稱或公開網址代碼已被使用或正在審核中，請更換名稱或代碼。'
          );
        }
      }

      try {
        const [row] = await tx
          .insert(clubApplications)
          .values({
            type: parsed.type,
            applicantUserId: user.id,
            targetClubId: parsed.target_club_id ?? null,
            proposedUniversityId: parsed.proposed_university_id ?? null,
            proposedName: parsed.proposed_name ?? null,
            proposedSlug: parsed.proposed_slug ?? null,
            proposedCategory: parsed.proposed_category ?? null,
            evidenceText: parsed.evidence_text,
            evidenceUrls: parsed.evidence_urls,
          })
          .returning();
        return row;
      } catch (err: unknown) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (code === '23505') {
          throw new AppError(
            409,
            'APPLICATION_CONFLICT',
            '您已有重複的待審核申請，或此社團代碼正待審核中。'
          );
        }
        throw err;
      }
    });

    return NextResponse.json(
      {
        application: {
          id: created.id,
          type: created.type,
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
