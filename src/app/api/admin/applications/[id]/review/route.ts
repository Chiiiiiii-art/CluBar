import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  auditLogs,
  clubApplications,
  clubMemberships,
  clubs,
  notifications,
} from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';
import { expireStaleHandovers } from '@/lib/services/handover';

const uuidSchema = z.string().uuid('無效的申請識別碼。');

const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  review_note: z.string().trim().max(500).default(''),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await context.params;
    const appId = uuidSchema.parse(id);

    const body = await req.json();
    const parsed = reviewSchema.parse(body);

    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute<{
        id: string;
        type: 'directory_claim' | 'new_club' | 'owner_takeover';
        applicant_user_id: string;
        target_club_id: string | null;
        proposed_university_id: string | null;
        proposed_name: string | null;
        proposed_slug: string | null;
        proposed_category: typeof clubs.$inferInsert.category | null;
        status: 'pending' | 'approved' | 'rejected';
      }>(sql`
        SELECT id, type, applicant_user_id, target_club_id, proposed_university_id,
               proposed_name, proposed_slug, proposed_category, status
        FROM club_applications
        WHERE id = ${appId}
        FOR UPDATE
      `);
      const app = locked[0];
      if (!app) {
        throw new AppError(404, 'APPLICATION_NOT_FOUND', '找不到此社團申請單。');
      }
      if (app.status !== 'pending') {
        throw new AppError(409, 'APPLICATION_ALREADY_REVIEWED', '此申請單已完成審核。');
      }

      const now = new Date();
      if (parsed.action === 'reject') {
        await tx
          .update(clubApplications)
          .set({
            status: 'rejected',
            reviewerUserId: admin.id,
            reviewNote: parsed.review_note || '未通過審核',
            reviewedAt: now,
          })
          .where(eq(clubApplications.id, appId));

        await tx.insert(notifications).values({
          userId: app.applicant_user_id,
          type: 'application_result',
          title: '社團申請審核未通過',
          body: parsed.review_note
            ? `審核說明：${parsed.review_note}`
            : '您的社團申請未通過，請補充佐證資料後重新提交。',
          linkUrl: '/clubs/apply',
        });

        await tx.insert(auditLogs).values({
          actorUserId: admin.id,
          action: 'club.application.rejected',
          targetType: 'club_application',
          targetId: appId,
          metadata: { type: app.type, review_note: parsed.review_note },
        });

        return { status: 'rejected' as const };
      }

      // action === 'approve'
      let clubSlug = '';
      let clubName = '';
      let clubId = '';

      if (app.type === 'directory_claim') {
        if (!app.target_club_id) {
          throw new AppError(400, 'INVALID_APPLICATION', '缺少目標名錄社團。');
        }
        const [club] = await tx
          .select()
          .from(clubs)
          .where(eq(clubs.id, app.target_club_id))
          .limit(1);
        if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到目標名錄社團。');

        const [existingOwner] = await tx
          .select({ id: clubMemberships.id })
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.clubId, club.id),
              eq(clubMemberships.role, 'owner'),
              isNull(clubMemberships.endedAt)
            )
          )
          .limit(1);
        if (existingOwner) {
          throw new AppError(409, 'CLUB_ALREADY_CLAIMED', '此社團已有現任社長，無法核准認領。');
        }

        await tx
          .update(clubs)
          .set({ verificationStatus: 'verified', updatedAt: now })
          .where(eq(clubs.id, club.id));

        await tx.insert(clubMemberships).values({
          clubId: club.id,
          userId: app.applicant_user_id,
          role: 'owner',
          title: '社長',
        });

        clubId = club.id;
        clubSlug = club.slug;
        clubName = club.name;
      } else if (app.type === 'new_club') {
        if (
          !app.proposed_university_id ||
          !app.proposed_name ||
          !app.proposed_slug ||
          !app.proposed_category
        ) {
          throw new AppError(400, 'INVALID_APPLICATION', '新社團申請資料不完整。');
        }

        const [createdClub] = await tx
          .insert(clubs)
          .values({
            universityId: app.proposed_university_id,
            name: app.proposed_name,
            slug: app.proposed_slug,
            category: app.proposed_category,
            verificationStatus: 'verified',
            isDemo: false,
          })
          .returning();

        await tx.insert(clubMemberships).values({
          clubId: createdClub.id,
          userId: app.applicant_user_id,
          role: 'owner',
          title: '社長',
        });

        clubId = createdClub.id;
        clubSlug = createdClub.slug;
        clubName = createdClub.name;
      } else if (app.type === 'owner_takeover') {
        if (!app.target_club_id) {
          throw new AppError(400, 'INVALID_APPLICATION', '缺少目標接管社團。');
        }
        const [club] = await tx
          .select()
          .from(clubs)
          .where(eq(clubs.id, app.target_club_id))
          .limit(1);
        if (!club) throw new AppError(404, 'CLUB_NOT_FOUND', '找不到目標社團。');

        await expireStaleHandovers(tx, club.id);

        const [prevOwner] = await tx
          .select()
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.clubId, club.id),
              eq(clubMemberships.role, 'owner'),
              isNull(clubMemberships.endedAt)
            )
          )
          .limit(1);

        if (prevOwner && prevOwner.userId !== app.applicant_user_id) {
          await tx
            .update(clubMemberships)
            .set({ role: 'alumni', endedAt: now })
            .where(eq(clubMemberships.id, prevOwner.id));

          await tx.insert(notifications).values({
            userId: prevOwner.userId,
            type: 'moderation_notice',
            title: `社團社長權限已由平台核准接管：${club.name}`,
            body: `平台管理員已依接管申訴將「${club.name}」社長權限移交給新任幹部，您的身分已轉為歷屆校友。`,
            linkUrl: `/clubs/${club.slug}`,
          });
        }

        const [applicantMembership] = await tx
          .select()
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.clubId, club.id),
              eq(clubMemberships.userId, app.applicant_user_id),
              isNull(clubMemberships.endedAt)
            )
          )
          .limit(1);

        if (applicantMembership) {
          await tx
            .update(clubMemberships)
            .set({ role: 'owner', title: applicantMembership.title || '社長' })
            .where(eq(clubMemberships.id, applicantMembership.id));
        } else {
          await tx.insert(clubMemberships).values({
            clubId: club.id,
            userId: app.applicant_user_id,
            role: 'owner',
            title: '社長',
          });
        }

        if (club.verificationStatus === 'unclaimed_directory') {
          await tx
            .update(clubs)
            .set({ verificationStatus: 'verified', updatedAt: now })
            .where(eq(clubs.id, club.id));
        }

        clubId = club.id;
        clubSlug = club.slug;
        clubName = club.name;
      }

      await tx
        .update(clubApplications)
        .set({
          status: 'approved',
          reviewerUserId: admin.id,
          reviewNote: parsed.review_note || '已核准',
          reviewedAt: now,
        })
        .where(eq(clubApplications.id, appId));

      await tx.insert(notifications).values({
        userId: app.applicant_user_id,
        type: 'application_result',
        title: `社團申請已核准：${clubName}`,
        body: `恭喜！您已取得「${clubName}」社長管理權限，現在可前往管理後台發布社團成果。`,
        linkUrl: `/clubs/${clubSlug}/manage`,
      });

      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action:
          app.type === 'owner_takeover'
            ? 'club.takeover.approved'
            : 'club.application.approved',
        targetType: 'club_application',
        targetId: appId,
        metadata: { type: app.type, club_id: clubId, review_note: parsed.review_note },
      });

      return { status: 'approved' as const, club_slug: clubSlug };
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
