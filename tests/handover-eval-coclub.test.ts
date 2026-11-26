import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { and, eq, isNotNull, isNull, like } from 'drizzle-orm';
import { closeDb, db, isDatabaseConfigured } from '../src/db';
import {
  clubArchiveFiles,
  clubHandoverNotes,
  clubHandovers,
  clubMemberships,
  clubs,
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
