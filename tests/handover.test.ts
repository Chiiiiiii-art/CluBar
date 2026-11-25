import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { closeDb } from '../src/db';
import * as schema from '../src/db/schema';
import { evaluateClubWriteAccess, evaluateSummaryAccess } from '../src/lib/auth/guards';

for (const envFile of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Ignore missing env file
  }
}

test('Handover role transitions preserve alumni summary access and block alumni writes', () => {
  // Before handover: owner can write
  assert.equal(
    evaluateClubWriteAccess({
      campusVerifiedAt: new Date(),
      clubStatus: 'verified',
      membershipRole: 'owner',
      membershipEndedAt: null,
      allowedRoles: ['owner', 'editor'],
    }).ok,
    true
  );

  // After handover: old owner becomes alumni with endedAt !== null
  const oldOwnerWrite = evaluateClubWriteAccess({
    campusVerifiedAt: new Date(),
    clubStatus: 'verified',
    membershipRole: 'alumni',
    membershipEndedAt: new Date(),
    allowedRoles: ['owner', 'editor'],
  });
  assert.equal(oldOwnerWrite.ok, false);
  if (!oldOwnerWrite.ok) {
    assert.equal(oldOwnerWrite.status, 403);
  }

  // Alumni keeps summary read access
  assert.equal(
    evaluateSummaryAccess({
      platformRole: 'user',
      membershipRole: 'alumni',
      membershipEndedAt: new Date(),
    }),
    true
  );
});

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

test(
  'Live DB handover transaction enforces atomic role switch and prevents concurrent dual owners',
  { skip: !hasDb },
  async () => {
    const { createHandover, respondHandover } = await import('../src/lib/services/handover');
    const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 });
    const db = drizzle(sql, { schema });

    const uid = crypto.randomUUID().slice(0, 8);
    let uniId = '';
    let clubId = '';
    let ownerId = '';
    let successorId = '';

    try {
      const [uni] = await db
        .insert(schema.universities)
        .values({
          code: `TST_${uid}`,
          name: `測試大學_${uid}`,
          shortName: `測大_${uid}`,
          emailDomains: [`test-${uid}.edu.tw`],
        })
        .returning();
      uniId = uni.id;

      const [u1] = await db
        .insert(schema.users)
        .values({
          email: `owner-${uid}@test-${uid}.edu.tw`,
          displayName: '原社長',
          campusEmail: `owner-${uid}@test-${uid}.edu.tw`,
          universityId: uniId,
          campusVerifiedAt: new Date(),
        })
        .returning();
      ownerId = u1.id;

      const [u2] = await db
        .insert(schema.users)
        .values({
          email: `next-${uid}@test-${uid}.edu.tw`,
          displayName: '接任幹部',
          campusEmail: `next-${uid}@test-${uid}.edu.tw`,
          universityId: uniId,
          campusVerifiedAt: new Date(),
        })
        .returning();
      successorId = u2.id;

      const [club] = await db
        .insert(schema.clubs)
        .values({
          universityId: uniId,
          slug: `test-club-${uid}`,
          name: `測試攝影社_${uid}`,
          category: 'arts',
          verificationStatus: 'verified',
          isDemo: true,
        })
        .returning();
      clubId = club.id;

      await db.insert(schema.clubMemberships).values([
        { clubId, userId: ownerId, role: 'owner', title: '社長' },
        { clubId, userId: successorId, role: 'editor', title: '副社長' },
      ]);

      const [post] = await db
        .insert(schema.posts)
        .values({
          clubId,
          authorUserId: ownerId,
          academicYear: 115,
          postType: 'work',
          title: '交接前歷史成果',
          summary: '歷史作品應在交接後完整保留',
          contentMd: '歷史作品內文紀錄至少十字以上。',
          originalityConfirmed: true,
          status: 'published',
          publishedAt: new Date(),
        })
        .returning();

      const handover = await createHandover({
        clubId,
        fromUserId: ownerId,
        toUserId: successorId,
        note: '測試換屆',
      });

      // Concurrent accept attempts must yield exactly 1 success and 1 conflict
      const settled = await Promise.allSettled([
        respondHandover({ handoverId: handover.id, actingUserId: successorId, action: 'accept' }),
        respondHandover({ handoverId: handover.id, actingUserId: successorId, action: 'accept' }),
      ]);

      const fulfilledCount = settled.filter((s) => s.status === 'fulfilled').length;
      const rejectedCount = settled.filter((s) => s.status === 'rejected').length;
      assert.equal(fulfilledCount, 1);
      assert.equal(rejectedCount, 1);

      const activeOwners = await db
        .select()
        .from(schema.clubMemberships)
        .where(
          and(
            eq(schema.clubMemberships.clubId, clubId),
            eq(schema.clubMemberships.role, 'owner'),
            isNull(schema.clubMemberships.endedAt)
          )
        );
      assert.equal(activeOwners.length, 1);
      assert.equal(activeOwners[0].userId, successorId);

      const [oldOwnerRow] = await db
        .select()
        .from(schema.clubMemberships)
        .where(
          and(
            eq(schema.clubMemberships.clubId, clubId),
            eq(schema.clubMemberships.userId, ownerId)
          )
        )
        .limit(1);
      assert.equal(oldOwnerRow.role, 'alumni');
      assert.ok(oldOwnerRow.endedAt !== null);

      const [persistedPost] = await db
        .select()
        .from(schema.posts)
        .where(eq(schema.posts.id, post.id))
        .limit(1);
      assert.equal(persistedPost.status, 'published');
    } finally {
      if (clubId) {
        await db.delete(schema.posts).where(eq(schema.posts.clubId, clubId));
        await db.delete(schema.clubs).where(eq(schema.clubs.id, clubId));
      }
      const userIds = [ownerId, successorId].filter(Boolean);
      if (userIds.length > 0) {
        await db.delete(schema.auditLogs).where(inArray(schema.auditLogs.actorUserId, userIds));
        await db.delete(schema.notifications).where(inArray(schema.notifications.userId, userIds));
        await db.delete(schema.users).where(inArray(schema.users.id, userIds));
      }
      if (uniId) {
        await db.delete(schema.universities).where(eq(schema.universities.id, uniId));
      }
      await sql.end();
      await closeDb();
    }
  }
);
