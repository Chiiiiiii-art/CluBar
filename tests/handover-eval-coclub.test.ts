import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { and, eq, isNotNull, isNull, like } from 'drizzle-orm';
import { closeDb, db, isDatabaseConfigured } from '../src/db';
import {
  clubArchiveFiles,
  clubEvents,
  clubHandoverNotes,
  clubHandovers,
  clubMemberships,
  clubs,
  coClubLinks,
  notifications,
  practicalResources,
  users,
} from '../src/db/schema';
import {
  buildClubEvaluationPack,
  renderEvaluationMarkdown,
} from '../src/lib/services/evaluation';
import { createHandover, respondHandover } from '../src/lib/services/handover';

for (const envFile of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // ignore missing env file
  }
}

after(async () => {
  await closeDb();
});

test('Live DB: 3-step handover transitions owner->alumni and successor->owner with pitfall note and evaluation pack', async (t) => {
  if (!isDatabaseConfigured()) {
    t.skip('DATABASE_URL 未設定，略過交接與評鑑測試');
    return;
  }

  // Test evaluation pack & markdown on seeded club ncu-photo
  const [photoClub] = await db
    .select()
    .from(clubs)
    .where(eq(clubs.slug, 'ncu-photo'))
    .limit(1);
  assert.ok(photoClub, 'Seeded ncu-photo required');

  const pack = await buildClubEvaluationPack({ clubId: photoClub.id });
  assert.equal(pack.club.slug, 'ncu-photo');
  assert.ok(pack.events.length >= 1, 'Expected at least 1 evaluation event for ncu-photo');
  assert.ok(pack.archive_files.length >= 1, 'Expected seeded archive file metadata');
  // Archive index must never expose raw blob_path
  for (const af of pack.archive_files) {
    assert.equal('blobPath' in af, false);
    assert.equal('blob_path' in af, false);
  }
  const md = renderEvaluationMarkdown(pack);
  assert.match(md, /社團評鑑暨活動成果報告/);
  assert.match(md, /一、年度活動辦理實績/);

  const sameUniUsers = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.universityId, photoClub.universityId),
        isNotNull(users.campusVerifiedAt)
      )
    )
    .limit(2);
  const [ownerUser, successorUser] = sameUniUsers;
  assert.ok(ownerUser && successorUser, 'Two campus-verified users in same university required');

  let tempClubId: string | null = null;
  let handoverId: string | null = null;
  try {
    const [tempClub] = await db
      .insert(clubs)
      .values({
        universityId: photoClub.universityId,
        slug: `handover-test-${Date.now()}`,
        name: `交接測試社 ${Date.now()}`,
        category: 'academic',
        verificationStatus: 'verified',
        isDemo: true,
      })
      .returning();
    tempClubId = tempClub.id;

    await db.insert(clubMemberships).values({
      clubId: tempClub.id,
      userId: ownerUser.id,
      role: 'owner',
      title: '原社長',
    });

    const handover = await createHandover({
      clubId: tempClub.id,
      fromUserId: ownerUser.id,
      toUserId: successorUser.id,
      pitfallNote: {
        venue_tips: '投影機轉接頭放在社辦抽屜',
        hours_and_deadlines: '學期末前 14 天送出時數認證名單',
        contacts_and_vendors: '印刷廠商 A 小姐',
      },
      shareDeidentified: true,
    });
    handoverId = handover.id;
    assert.equal(handover.status, 'pending');

    const accepted = await respondHandover({
      handoverId: handover.id,
      actingUserId: successorUser.id,
      action: 'accept',
    });
    assert.equal(accepted.status, 'accepted');

    const [newOwnerMem] = await db
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, tempClub.id),
          eq(clubMemberships.userId, successorUser.id),
          isNull(clubMemberships.endedAt)
        )
      )
      .limit(1);
    assert.equal(newOwnerMem?.role, 'owner');

    const [oldOwnerMem] = await db
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, tempClub.id),
          eq(clubMemberships.userId, ownerUser.id)
        )
      )
      .limit(1);
    assert.equal(oldOwnerMem?.role, 'alumni');
    assert.ok(oldOwnerMem?.endedAt);

    const notes = await db
      .select()
      .from(clubHandoverNotes)
      .where(eq(clubHandoverNotes.clubId, tempClub.id));
    assert.equal(notes.length, 1);
    assert.match(notes[0]!.venueTips, /投影機轉接頭/);
  } finally {
    if (tempClubId) {
      await db
        .delete(practicalResources)
        .where(like(practicalResources.contentMd, '%投影機轉接頭%'));
      await db.delete(clubHandoverNotes).where(eq(clubHandoverNotes.clubId, tempClubId));
      await db.delete(clubHandovers).where(eq(clubHandovers.clubId, tempClubId));
      await db.delete(clubArchiveFiles).where(eq(clubArchiveFiles.clubId, tempClubId));
      await db.delete(clubMemberships).where(eq(clubMemberships.clubId, tempClubId));
      await db.delete(notifications).where(like(notifications.title, '%交接測試社%'));
      await db.delete(clubs).where(eq(clubs.id, tempClubId));
    }
  }
});


test('Live DB: Co-Club accepted invitation with partnerIncludeEval=true merges event into partner club evaluation pack', async (t) => {
  if (!isDatabaseConfigured()) {
    t.skip('DATABASE_URL 未設定，略過 Co-Club 評鑑彙整測試');
    return;
  }

  const [hostClub] = await db.select().from(clubs).where(eq(clubs.slug, 'ncu-gamedev')).limit(1);
  const [partnerClub] = await db.select().from(clubs).where(eq(clubs.slug, 'ncu-art')).limit(1);
  const [someUser] = await db.select().from(users).limit(1);

  assert.ok(hostClub && partnerClub && someUser, 'Seeded clubs and user required');

  let tempEventId: string | null = null;
  try {
    const [ev] = await db
      .insert(clubEvents)
      .values({
        clubId: hostClub.id,
        createdBy: someUser.id,
        shortCode: `cc-${Date.now().toString(36).slice(-6)}`,
        title: 'Co-Club Eval Merge Integration Event',
        locationText: '跨社團排練室',
        scheduleMode: 'scheduled',
        startsAt: new Date(),
        includeInEvaluation: true,
      })
      .returning();
    tempEventId = ev.id;

    await db.insert(coClubLinks).values({
      targetType: 'event',
      targetId: ev.id,
      hostClubId: hostClub.id,
      partnerClubId: partnerClub.id,
      status: 'accepted',
      partnerIncludeEval: true,
      invitedBy: someUser.id,
      respondedBy: someUser.id,
      respondedAt: new Date(),
    });

    const partnerPack = await buildClubEvaluationPack({ clubId: partnerClub.id });
    const merged = partnerPack.events.find((item) => item.id === ev.id);
    assert.ok(merged, 'Expected partner evaluation pack to include accepted Co-Club event');
    assert.equal(merged.is_co_hosted, true);
    assert.equal(merged.partner_or_host_club, hostClub.name);
  } finally {
    if (tempEventId) {
      await db.delete(coClubLinks).where(eq(coClubLinks.targetId, tempEventId));
      await db.delete(clubEvents).where(eq(clubEvents.id, tempEventId));
    }
  }
});
