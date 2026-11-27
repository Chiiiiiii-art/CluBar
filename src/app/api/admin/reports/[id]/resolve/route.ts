import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import {
  auditLogs,
  clubEvents,
  clubMemberships,
  clubQuestions,
  clubs,
  eventAlbumPhotos,
  eventComments,
  notifications,
  posts,
  reports,
  togetherItems,
} from '@/db/schema';
import { requirePlatformAdmin } from '@/lib/auth/guards';
import { AppError, handleApiError } from '@/lib/errors';

const uuidSchema = z.string().uuid('無效的檢舉識別碼。');

const resolveSchema = z.object({
  resolution: z.enum(['keep', 'takedown', 'suspend_club']),
  resolution_note: z.string().trim().max(500).default(''),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requirePlatformAdmin();
    const { id } = await context.params;
    const reportId = uuidSchema.parse(id);

    const body = await req.json();
    const parsed = resolveSchema.parse(body);

    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute<{
        id: string;
        target_type: string;
        target_id: string;
        status: string;
      }>(sql`SELECT id, target_type, target_id, status FROM reports WHERE id = ${reportId} FOR UPDATE`);

      const report = locked[0];
      if (!report) throw new AppError(404, 'REPORT_NOT_FOUND', '找不到此檢舉紀錄。');
      if (report.status !== 'open') {
        throw new AppError(409, 'REPORT_ALREADY_RESOLVED', '此檢舉案已處理完成。');
      }

      const now = new Date();
      let affectedClubId: string | null = null;

      if (report.target_type === 'post') {
        const [p] = await tx
          .select({ id: posts.id, clubId: posts.clubId })
          .from(posts)
          .where(eq(posts.id, report.target_id))
          .limit(1);
        affectedClubId = p?.clubId ?? null;
        if (parsed.resolution === 'takedown' && p) {
          await tx
            .update(posts)
            .set({ status: 'removed_by_admin', updatedAt: now })
            .where(eq(posts.id, p.id));
        }
      } else if (report.target_type === 'club') {
        affectedClubId = report.target_id;
      } else if (report.target_type === 'event') {
        const [ev] = await tx
          .select({ id: clubEvents.id, clubId: clubEvents.clubId })
          .from(clubEvents)
          .where(eq(clubEvents.id, report.target_id))
          .limit(1);
        affectedClubId = ev?.clubId ?? null;
        if (parsed.resolution === 'takedown' && ev) {
          await tx
            .update(clubEvents)
            .set({ status: 'cancelled', updatedAt: now })
            .where(eq(clubEvents.id, ev.id));
        }
      } else if (report.target_type === 'event_comment') {
        const [c] = await tx
          .select({ id: eventComments.id, eventId: eventComments.eventId })
          .from(eventComments)
          .where(eq(eventComments.id, report.target_id))
          .limit(1);
        if (c) {
          const [ev] = await tx
            .select({ clubId: clubEvents.clubId })
            .from(clubEvents)
            .where(eq(clubEvents.id, c.eventId))
            .limit(1);
          affectedClubId = ev?.clubId ?? null;
          if (parsed.resolution === 'takedown') {
            await tx
              .update(eventComments)
              .set({ isDeleted: true, deletedBy: admin.id })
              .where(eq(eventComments.id, c.id));
          }
        }
      } else if (report.target_type === 'album_photo') {
        const [ph] = await tx
          .select({ id: eventAlbumPhotos.id, eventId: eventAlbumPhotos.eventId })
          .from(eventAlbumPhotos)
          .where(eq(eventAlbumPhotos.id, report.target_id))
          .limit(1);
        if (ph) {
          const [ev] = await tx
            .select({ clubId: clubEvents.clubId })
            .from(clubEvents)
            .where(eq(clubEvents.id, ph.eventId))
            .limit(1);
          affectedClubId = ev?.clubId ?? null;
          if (parsed.resolution === 'takedown') {
            await tx
              .update(eventAlbumPhotos)
              .set({ status: 'rejected', curatedBy: admin.id })
              .where(eq(eventAlbumPhotos.id, ph.id));
          }
        }
      } else if (report.target_type === 'club_question') {
        const [q] = await tx
          .select({ id: clubQuestions.id, clubId: clubQuestions.clubId })
          .from(clubQuestions)
          .where(eq(clubQuestions.id, report.target_id))
          .limit(1);
        affectedClubId = q?.clubId ?? null;
        if (parsed.resolution === 'takedown' && q) {
          await tx
            .update(clubQuestions)
            .set({ status: 'hidden', isPinnedFaq: false, updatedAt: now })
            .where(eq(clubQuestions.id, q.id));
        }
      } else if (report.target_type === 'together_item') {
        const [ti] = await tx
          .select({ id: togetherItems.id, clubId: togetherItems.clubId })
          .from(togetherItems)
          .where(eq(togetherItems.id, report.target_id))
          .limit(1);
        affectedClubId = ti?.clubId ?? null;
        if (parsed.resolution === 'takedown' && ti) {
          await tx
            .update(togetherItems)
            .set({ status: 'removed_by_admin' })
            .where(eq(togetherItems.id, ti.id));
        }
      }

      if (
        (parsed.resolution === 'suspend_club' ||
          (parsed.resolution === 'takedown' && report.target_type === 'club')) &&
        affectedClubId
      ) {
        await tx
          .update(clubs)
          .set({ verificationStatus: 'suspended', updatedAt: now })
          .where(eq(clubs.id, affectedClubId));
      }

      const nextStatus =
        parsed.resolution === 'keep'
          ? 'resolved_keep'
          : parsed.resolution === 'takedown'
            ? 'resolved_takedown'
            : 'resolved_suspend_club';

      await tx
        .update(reports)
        .set({
          status: nextStatus,
          handlerUserId: admin.id,
          resolutionNote: parsed.resolution_note || null,
          resolvedAt: now,
        })
        .where(eq(reports.id, reportId));

      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: `report.${nextStatus}`,
        targetType: report.target_type,
        targetId: report.target_id,
        metadata: { report_id: reportId, note: parsed.resolution_note },
      });

      if (parsed.resolution !== 'keep' && affectedClubId) {
        const [club] = await tx
          .select({ name: clubs.name, slug: clubs.slug })
          .from(clubs)
          .where(eq(clubs.id, affectedClubId))
          .limit(1);

        const owners = await tx
          .select({ userId: clubMemberships.userId })
          .from(clubMemberships)
          .where(
            and(
              eq(clubMemberships.clubId, affectedClubId),
              eq(clubMemberships.role, 'owner'),
              isNull(clubMemberships.endedAt)
            )
          );

        for (const owner of owners) {
          await tx.insert(notifications).values({
            userId: owner.userId,
            type: 'moderation_notice',
            title:
              parsed.resolution === 'suspend_club'
                ? `社團權限暫停通知：${club?.name ?? ''}`
                : `內容下架處置通知：${club?.name ?? ''}`,
            body: `處置原因：${parsed.resolution_note || '經檢舉審核違反平台規範'}。如有疑問請透過平台申訴窗口聯繫管理員。`,
            linkUrl: club ? `/clubs/${club.slug}` : '/me',
          });
        }
      }

      return { status: nextStatus };
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
