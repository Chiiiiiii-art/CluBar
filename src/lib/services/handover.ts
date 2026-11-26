import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { db, type CluBarDb } from '@/db';
import {
  auditLogs,
  clubHandoverNotes,
  clubHandovers,
  clubMemberships,
  clubs,
  notifications,
  practicalResources,
  users,
  type HandoverPitfallNote,
} from '@/db/schema';
import { AppError } from '@/lib/errors';

type TxOrDb = Parameters<Parameters<CluBarDb['transaction']>[0]>[0] | CluBarDb;

export async function expireStaleHandovers(tx: TxOrDb, clubId: string): Promise<void> {
  await tx
    .update(clubHandovers)
    .set({ status: 'expired', resolvedAt: new Date() })
    .where(
      and(
        eq(clubHandovers.clubId, clubId),
        eq(clubHandovers.status, 'pending'),
        lte(clubHandovers.expiresAt, sql`now()`)
      )
    );
}

export async function createHandover(params: {
  clubId: string;
  fromUserId: string;
  toUserId?: string;
  toCampusEmail?: string;
  pitfallNote?: HandoverPitfallNote | null;
  shareDeidentified?: boolean;
}) {
  return db.transaction(async (tx) => {
    await expireStaleHandovers(tx, params.clubId);

    const targetEmail = params.toCampusEmail?.trim().toLowerCase();
    const [target] = params.toUserId
      ? await tx.select().from(users).where(eq(users.id, params.toUserId)).limit(1)
      : targetEmail
        ? await tx.select().from(users).where(eq(users.campusEmail, targetEmail)).limit(1)
        : [];

    if (!target || !target.campusVerifiedAt) {
      throw new AppError(
        400,
        'TARGET_NOT_ELIGIBLE',
        '接任者必須為已完成 .edu.tw 校園驗證之帳號。'
      );
    }

    if (target.id === params.fromUserId) {
      throw new AppError(400, 'SELF_HANDOVER_NOT_ALLOWED', '無法將社長權限移交給自己。');
    }

    const [club] = await tx.select().from(clubs).where(eq(clubs.id, params.clubId)).limit(1);
    if (!club) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    if (target.universityId && target.universityId !== club.universityId) {
      throw new AppError(403, 'UNIVERSITY_MISMATCH', '接任社長必須為同校已驗證學生。');
    }

    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [handover] = await tx
        .insert(clubHandovers)
        .values({
          clubId: params.clubId,
          fromUserId: params.fromUserId,
          toUserId: target.id,
          status: 'pending',
          pendingNoteJson: params.pitfallNote ?? null,
          shareDeidentified: params.shareDeidentified ?? false,
          expiresAt,
        })
        .returning();

      await tx.insert(notifications).values({
        userId: target.id,
        type: 'handover_invite',
        title: `社團社長交接邀請：${club.name}`,
        body: `現任社長邀請您接任「${club.name}」社長。請於 7 天內前往個人中心確認接受或婉拒。`,
        linkUrl: '/me',
      });

      await tx.insert(auditLogs).values({
        actorUserId: params.fromUserId,
        action: 'club.handover.initiated',
        targetType: 'club_handover',
        targetId: handover.id,
        metadata: { club_id: params.clubId, to_user_id: target.id },
      });

      return handover;
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === '23505') {
        throw new AppError(
          409,
          'HANDOVER_ALREADY_PENDING',
          '此社團目前已有尚未確認的交接邀請，請先撤回或等待對方回應。'
        );
      }
      throw err;
    }
  });
}

export async function respondHandover(params: {
  handoverId: string;
  actingUserId: string;
  action: 'accept' | 'reject' | 'cancel';
}) {
  return db.transaction(async (tx) => {
    const [peek] = await tx
      .select({ id: clubHandovers.id, clubId: clubHandovers.clubId })
      .from(clubHandovers)
      .where(eq(clubHandovers.id, params.handoverId))
      .limit(1);

    if (!peek) {
      throw new AppError(404, 'HANDOVER_NOT_FOUND', '找不到此換屆交接邀請。');
    }

    await expireStaleHandovers(tx, peek.clubId);

    const lockedRows = await tx.execute<{
      id: string;
      club_id: string;
      from_user_id: string;
      to_user_id: string;
      status: string;
      pending_note_json: HandoverPitfallNote | null;
      share_deidentified: boolean;
      expires_at: Date;
    }>(sql`
      SELECT id, club_id, from_user_id, to_user_id, status, pending_note_json, share_deidentified, expires_at
      FROM club_handovers
      WHERE id = ${params.handoverId}
      FOR UPDATE
    `);

    const handover = lockedRows[0];
    if (!handover) {
      throw new AppError(404, 'HANDOVER_NOT_FOUND', '找不到此換屆交接邀請。');
    }

    if (handover.status !== 'pending') {
      throw new AppError(409, 'HANDOVER_NOT_PENDING', '此交接邀請已處理或已過期失效。');
    }

    const [club] = await tx
      .select()
      .from(clubs)
      .where(eq(clubs.id, handover.club_id))
      .limit(1);
    if (!club) {
      throw new AppError(404, 'CLUB_NOT_FOUND', '找不到指定社團。');
    }

    if (params.action === 'cancel') {
      if (handover.from_user_id !== params.actingUserId) {
        throw new AppError(403, 'FORBIDDEN', '僅原發起社長可撤回此邀請。');
      }

      const [updated] = await tx
        .update(clubHandovers)
        .set({ status: 'cancelled', resolvedAt: new Date() })
        .where(eq(clubHandovers.id, handover.id))
        .returning();

      await tx.insert(notifications).values({
        userId: handover.to_user_id,
        type: 'handover_resolved',
        title: `社長交接邀請已撤回：${club.name}`,
        body: `原社長已撤回「${club.name}」的社長交接邀請。`,
        linkUrl: `/clubs/${club.slug}`,
      });

      await tx.insert(auditLogs).values({
        actorUserId: params.actingUserId,
        action: 'club.handover.cancelled',
        targetType: 'club_handover',
        targetId: handover.id,
        metadata: { club_id: club.id },
      });

      return updated;
    }

    if (handover.to_user_id !== params.actingUserId) {
      throw new AppError(403, 'FORBIDDEN', '僅受邀人可接受或婉拒此交接邀請。');
    }

    if (params.action === 'reject') {
      const [updated] = await tx
        .update(clubHandovers)
        .set({ status: 'rejected', resolvedAt: new Date() })
        .where(eq(clubHandovers.id, handover.id))
        .returning();

      await tx.insert(notifications).values({
        userId: handover.from_user_id,
        type: 'handover_resolved',
        title: `社長交接邀請已被婉拒：${club.name}`,
        body: `受邀人已婉拒「${club.name}」的社長交接邀請，您的社長權限不受影響。`,
        linkUrl: `/clubs/${club.slug}/manage`,
      });

      await tx.insert(auditLogs).values({
        actorUserId: params.actingUserId,
        action: 'club.handover.rejected',
        targetType: 'club_handover',
        targetId: handover.id,
        metadata: { club_id: club.id },
      });

      return updated;
    }

    if (new Date(handover.expires_at).getTime() <= Date.now()) {
      throw new AppError(409, 'HANDOVER_EXPIRED', '此交接邀請已超過 7 天有效期限。');
    }

    const [toUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, handover.to_user_id))
      .limit(1);
    if (!toUser || !toUser.campusVerifiedAt || toUser.universityId !== club.universityId) {
      throw new AppError(
        403,
        'CAMPUS_VERIFICATION_REQUIRED',
        '接任社長須維持同校有效的 .edu.tw 校園驗證身分。'
      );
    }

    const now = new Date();

    await tx
      .update(clubMemberships)
      .set({ role: 'alumni', endedAt: now })
      .where(
        and(
          eq(clubMemberships.clubId, handover.club_id),
          eq(clubMemberships.userId, handover.from_user_id),
          isNull(clubMemberships.endedAt)
        )
      );

    const [existingActiveTarget] = await tx
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, handover.club_id),
          eq(clubMemberships.userId, handover.to_user_id),
          isNull(clubMemberships.endedAt)
        )
      )
      .limit(1);

    if (existingActiveTarget) {
      await tx
        .update(clubMemberships)
        .set({ role: 'owner', title: existingActiveTarget.title || '社長' })
        .where(eq(clubMemberships.id, existingActiveTarget.id));
    } else {
      await tx.insert(clubMemberships).values({
        clubId: handover.club_id,
        userId: handover.to_user_id,
        role: 'owner',
        title: '社長',
      });
    }

    const [accepted] = await tx
      .update(clubHandovers)
      .set({ status: 'accepted', resolvedAt: now })
      .where(eq(clubHandovers.id, handover.id))
      .returning();

    await tx
      .update(clubs)
      .set({ lastHandoverAt: now, updatedAt: now })
      .where(eq(clubs.id, club.id));

    const note = handover.pending_note_json;
    if (
      note &&
      (note.venue_tips?.trim() ||
        note.hours_and_deadlines?.trim() ||
        note.contacts_and_vendors?.trim())
    ) {
      await tx.insert(clubHandoverNotes).values({
        clubId: club.id,
        handoverId: handover.id,
        authorUserId: handover.from_user_id,
        venueTips: note.venue_tips?.trim() || '',
        hoursAndDeadlines: note.hours_and_deadlines?.trim() || '',
        contactsAndVendors: note.contacts_and_vendors?.trim() || '',
      });

      if (handover.share_deidentified && club.domainIds.length > 0) {
        const parts: string[] = [];
        if (note.venue_tips?.trim()) parts.push(`### 場地借用眉角\n${note.venue_tips.trim()}`);
        if (note.hours_and_deadlines?.trim()) {
          parts.push(`### 時數與申報死線\n${note.hours_and_deadlines.trim()}`);
        }
        if (note.contacts_and_vendors?.trim()) {
          parts.push(`### 外部廠商與活動實務提醒\n${note.contacts_and_vendors.trim()}`);
        }
        await tx.insert(practicalResources).values({
          domainId: club.domainIds[0]!,
          sourceUniversityId: club.universityId,
          title: `社團交接實務避雷分享（去識別化）`,
          contentMd: parts.join('\n\n'),
        });
      }
    }

    await tx.insert(auditLogs).values({
      actorUserId: params.actingUserId,
      action: 'club.handover.accepted',
      targetType: 'club_handover',
      targetId: handover.id,
      metadata: {
        club_id: club.id,
        from_user_id: handover.from_user_id,
        to_user_id: handover.to_user_id,
      },
    });

    await tx.insert(notifications).values([
      {
        userId: handover.from_user_id,
        type: 'handover_resolved',
        title: `已完成換屆交接：${club.name}`,
        body: `新任社長已接受「${club.name}」交接邀請，您的身分已轉為歷屆校友。`,
        linkUrl: `/clubs/${club.slug}`,
      },
      {
        userId: handover.to_user_id,
        type: 'handover_resolved',
        title: `您已成為「${club.name}」新任社長`,
        body: `交接已完成，現在可檢視交接避雷便條並管理社團活動與評鑑檔案。`,
        linkUrl: `/clubs/${club.slug}/manage`,
      },
    ]);

    return accepted;
  });
}
