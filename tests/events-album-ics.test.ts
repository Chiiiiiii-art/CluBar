import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import { closeDb, db, isDatabaseConfigured } from '../src/db';
import {
  clubEvents,
  clubMemberships,
  clubs,
  eventAlbumPhotos,
  posts,
  users,
} from '../src/db/schema';
import {
  createCalendarToken,
  generateEventIcs,
  verifyCalendarToken,
} from '../src/lib/calendar/ics';
import { AppError } from '../src/lib/errors';
import { FORBIDDEN_PUBLIC_KEYS } from '../src/lib/serializers';
import {
  createClubEvent,
  curateAlbumPhoto,
  getPublicEventDetail,
  updateClubEvent,
  upsertEventRsvp,
} from '../src/lib/services/events';

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

function assertNoForbiddenKeys(obj: unknown, path = 'root'): void {
  if (obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => assertNoForbiddenKeys(item, `${path}[${idx}]`));
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    assert.equal(
      FORBIDDEN_PUBLIC_KEYS.has(k),
      false,
      `Forbidden key "${k}" leaked at ${path}.${k}`
    );
    assertNoForbiddenKeys(v, `${path}.${k}`);
  }
}

test('RFC 5545 ICS generation supports SEQUENCE, STATUS:CANCELLED, escaping, and <=75 octet folding', () => {
  const start = new Date('2026-12-01T11:00:00Z');
  const end = new Date('2026-12-01T13:00:00Z');
  const ics = generateEventIcs(
    {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      shortCode: 'ncu-test-01',
      title: '零基礎攝影暗房沖洗與超長標題測試驗證這行超過七十五位元組會正確進行折行不會破字',
      summary: '歡迎攜帶底片，免費體驗；若有疑問請見活動頁\n第二行提醒',
      locationText: '綜合教學館, R102',
      preEventNotes: '請穿不怕弄髒的衣物',
      scheduleMode: 'scheduled',
      startsAt: start,
      endsAt: end,
      status: 'cancelled',
      icsSequence: 2,
      clubName: '中央攝影社',
    },
    'https://clubar.tw'
  );

  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /UID:event-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee@clubar\.tw\r\n/);
  assert.match(ics, /SEQUENCE:2\r\n/);
  assert.match(ics, /STATUS:CANCELLED\r\n/);
  assert.match(ics, /LOCATION:綜合教學館\\, R102\r\n/);

  for (const line of ics.split('\r\n')) {
    assert.ok(
      Buffer.byteLength(line, 'utf8') <= 75,
      `Line exceeded 75 octets: ${Buffer.byteLength(line, 'utf8')} -> ${line}`
    );
  }
});

test('Calendar HMAC token round-trips and rejects tampered signatures', () => {
  const userId = '11111111-2222-4333-8444-555555555555';
  const token = createCalendarToken(userId, 3);
  const verified = verifyCalendarToken(token);
  assert.deepEqual(verified, { userId, version: 3 });

  const tampered = `${token.slice(0, -1)}X`;
  assert.equal(verifyCalendarToken(tampered), null);
});

test('Live DB: Event ICS sequence bumps, 2-tier RSVP hides private_count_only identity, and Album caps featured_stream at 3', async (t) => {
  if (!isDatabaseConfigured()) {
    t.skip('DATABASE_URL 未設定，略過事件資料庫整合測試');
    return;
  }

  const [club] = await db
    .select()
    .from(clubs)
    .where(eq(clubs.slug, 'ncu-gamedev'))
    .limit(1);
  assert.ok(club, 'Seeded club ncu-gamedev required');

  const [officerMembership] = await db
    .select()
    .from(clubMemberships)
    .where(eq(clubMemberships.clubId, club.id))
    .limit(1);
  assert.ok(officerMembership, 'Officer membership required');

  const sampleUsers = await db.select().from(users).limit(3);
  assert.ok(sampleUsers.length >= 2, 'At least 2 seeded users required');
  const [userA, userB] = sampleUsers;

  let createdEventId: string | null = null;
  try {
    const created = await createClubEvent({
      clubId: club.id,
      clubSlug: club.slug,
      universityId: club.universityId,
      userId: officerMembership.userId,
      input: {
        title: 'Wave2 Integration Event Test',
        summary: 'Test summary',
        description_md: 'Test description',
        theme_preset: 'warm_paper',
        schedule_mode: 'scheduled',
        starts_at: new Date('2026-12-15T11:00:00Z').toISOString(),
        ends_at: new Date('2026-12-15T13:00:00Z').toISOString(),
        location_text: '工程一館 R107',
        beginner_friendly: true,
        non_members_welcome: true,
        campus_only: false,
        fee_ntd: 0,
        learning_hours_category: 'none',
        learning_hours_count: 0,
        domain_ids: [],
        include_in_evaluation: false,
      },
    });
    createdEventId = created.id;
    assert.equal(created.icsSequence, 0);

    // Location update bumps ICS SEQUENCE
    const updated = await updateClubEvent({
      eventId: created.id,
      input: { location_text: '工程五館 R201' },
    });
    assert.equal(updated.icsSequence, 1);

    // Public vs Private RSVP privacy check
    await upsertEventRsvp({
      event: updated,
      clubUniversityId: club.universityId,
      user: userA!,
      status: 'going',
      privacyMode: 'public_to_attendees',
      displayAlias: '公開測試代號',
    });
    await upsertEventRsvp({
      event: updated,
      clubUniversityId: club.universityId,
      user: userB!,
      status: 'going',
      privacyMode: 'private_count_only',
    });

    const publicView = await getPublicEventDetail(created.shortCode, null);
    assert.ok(publicView);
    assertNoForbiddenKeys(publicView);
    assert.equal(publicView.detail.going_count, 2);
    assert.equal(publicView.detail.public_attendees.length, 1);
    assert.equal(publicView.detail.public_attendees[0]!.display_name, '公開測試代號');

    // Insert 4 pending_review album photos
    const insertedPhotos = await db
      .insert(eventAlbumPhotos)
      .values(
        [1, 2, 3, 4].map((idx) => ({
          eventId: created.id,
          uploaderUserId: userA!.id,
          originalUrl: `/images/demo/moment-1x1.svg?o=${idx}`,
          previewUrl: `/images/demo/moment-1x1.svg?p=${idx}`,
          width: 900,
          height: 900,
          mimeType: 'image/webp',
          sizeBytes: 12000,
          caption: `Photo ${idx}`,
          status: 'pending_review' as const,
          consentConfirmed: true,
        }))
      )
      .returning();

    // Public view must NOT include pending_review photos
    const beforeCuratePublic = await getPublicEventDetail(created.shortCode, null);
    assert.equal(beforeCuratePublic?.album_photos.length, 0);
    assert.equal(beforeCuratePublic?.pending_album_photos.length, 0);

    // Feature 3 photos -> creates 3 album_highlight posts
    for (const p of insertedPhotos.slice(0, 3)) {
      await curateAlbumPhoto({
        event: updated,
        photoId: p.id,
        officerUserId: officerMembership.userId,
        action: 'feature',
      });
    }

    // 4th feature must fail with 409 MAX_FEATURED_PHOTOS_REACHED
    await assert.rejects(
      () =>
        curateAlbumPhoto({
          event: updated,
          photoId: insertedPhotos[3]!.id,
          officerUserId: officerMembership.userId,
          action: 'feature',
        }),
      (err: unknown) => err instanceof AppError && err.code === 'MAX_FEATURED_PHOTOS_REACHED'
    );

    const createdPosts = await db
      .select()
      .from(posts)
      .where(
        inArray(
          posts.sourceAlbumPhotoId,
          insertedPhotos.map((p) => p.id)
        )
      );
    assert.equal(createdPosts.length, 3);
    assert.ok(createdPosts.every((p) => p.postKind === 'album_highlight' && p.status === 'published'));
  } finally {
    if (createdEventId) {
      await db.delete(posts).where(eq(posts.relatedEventId, createdEventId));
      await db.delete(clubEvents).where(eq(clubEvents.id, createdEventId));
    }
  }
});
