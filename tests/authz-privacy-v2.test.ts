import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateArchiveAccess,
  evaluateClubWriteAccess,
} from '../src/lib/auth/guards';
import {
  FORBIDDEN_PUBLIC_KEYS,
  serializeDiscoverEventCard,
  serializeDiscoverStreamCard,
  serializePublicClub,
  serializePublicQuestion,
  serializePublicStreamPost,
  serializePublicTogetherItem,
} from '../src/lib/serializers';
import { isAllowedEmbedUrl, isAllowedMediaUrl } from '../src/lib/validators';

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

test('evaluateClubWriteAccess enforces campus verification, same university, active role, and non-suspended status', () => {
  const now = new Date();
  const uniA = '11111111-1111-4111-8111-111111111111';
  const uniB = '22222222-2222-4222-8222-222222222222';

  const crossUni = evaluateClubWriteAccess({
    campusVerifiedAt: now,
    userUniversityId: uniA,
    clubUniversityId: uniB,
    clubStatus: 'verified',
    membershipRole: 'member',
    membershipEndedAt: null,
    allowedRoles: ['owner', 'editor', 'member'],
  });
  assert.equal(crossUni.ok, false);
  if (!crossUni.ok) assert.equal(crossUni.code, 'UNIVERSITY_MISMATCH');

  const revokedMember = evaluateClubWriteAccess({
    campusVerifiedAt: now,
    userUniversityId: uniA,
    clubUniversityId: uniA,
    clubStatus: 'verified',
    membershipRole: 'member',
    membershipEndedAt: now,
    allowedRoles: ['owner', 'editor', 'member'],
  });
  assert.equal(revokedMember.ok, false);

  const memberAllowedNrc = evaluateClubWriteAccess({
    campusVerifiedAt: now,
    userUniversityId: uniA,
    clubUniversityId: uniA,
    clubStatus: 'verified',
    membershipRole: 'member',
    membershipEndedAt: null,
    allowedRoles: ['owner', 'editor', 'member'],
  });
  assert.equal(memberAllowedNrc.ok, true);

  const memberBlockedOfficer = evaluateClubWriteAccess({
    campusVerifiedAt: now,
    userUniversityId: uniA,
    clubUniversityId: uniA,
    clubStatus: 'verified',
    membershipRole: 'member',
    membershipEndedAt: null,
    allowedRoles: ['owner', 'editor'],
  });
  assert.equal(memberBlockedOfficer.ok, false);
});

test('evaluateArchiveAccess grants alumni, active officers, matching school_admin, and platform_admin', () => {
  const uniA = '11111111-1111-4111-8111-111111111111';
  const uniB = '22222222-2222-4222-8222-222222222222';

  assert.equal(
    evaluateArchiveAccess({
      platformRole: 'user',
      membershipRole: 'alumni',
      membershipEndedAt: new Date(),
    }),
    true
  );
  assert.equal(
    evaluateArchiveAccess({
      platformRole: 'user',
      membershipRole: 'member',
      membershipEndedAt: null,
    }),
    false
  );
  assert.equal(
    evaluateArchiveAccess({
      platformRole: 'school_admin',
      managedUniversityId: uniA,
      clubUniversityId: uniB,
      membershipRole: null,
      membershipEndedAt: null,
    }),
    false
  );
  assert.equal(
    evaluateArchiveAccess({
      platformRole: 'school_admin',
      managedUniversityId: uniA,
      clubUniversityId: uniA,
      membershipRole: null,
      membershipEndedAt: null,
    }),
    true
  );
});

test('Public serializers strictly strip PII, asker IDs, blob paths, and vanity counts', () => {
  const club = serializePublicClub({
    id: 'c1',
    slug: 'ncu-photo',
    name: '中大攝影社',
    category: 'arts',
    domainIds: [],
    tagline: '底片',
    description: '介紹',
    avatarUrl: null,
    coverUrl: null,
    externalLinks: [],
    verificationStatus: 'verified',
    isDemo: true,
    officialDirectoryUrl: null,
    pulseLabel: '本週剛更新',
    university: { id: 'u1', code: 'NCU', name: '國立中央大學', shortName: '中央大學' },
  });

  const streamCard = serializeDiscoverStreamCard({
    id: 'p1',
    postKind: 'nrc_moment',
    headline: '暗房初體驗',
    mediaItems: [],
    pulseLabel: '本週剛更新',
    publishedAt: new Date(),
    club: {
      id: 'c1',
      slug: 'ncu-photo',
      name: '中大攝影社',
      avatarUrl: null,
      isDemo: true,
      verificationStatus: 'verified',
      universityId: 'u1',
      universityShortName: '中央大學',
    },
  });

  const eventCard = serializeDiscoverEventCard({
    id: 'e1',
    shortCode: 'ncu-ph-01',
    title: '暗房體驗夜',
    coverMedia: null,
    themePreset: 'warm_paper',
    scheduleMode: 'scheduled',
    startsAt: new Date(),
    locationText: '據德樓',
    beginnerFriendly: true,
    nonMembersWelcome: true,
    campusOnly: false,
    feeNtd: 0,
    learningHoursCategory: 'art',
    learningHoursCount: '2.0',
    goingCount: 12,
    club: {
      id: 'c1',
      slug: 'ncu-photo',
      name: '中大攝影社',
      isDemo: true,
      universityId: 'u1',
      universityShortName: '中央大學',
    },
  });

  const question = serializePublicQuestion({
    id: 'q1',
    isAnonymous: true,
    displayAlias: '路人甲',
    questionText: '零基礎可以去嗎？',
    answerText: '可以！',
    answeredAt: new Date(),
    isPinnedFaq: true,
  });

  const streamPost = serializePublicStreamPost({
    id: 'p1',
    clubId: 'c1',
    postKind: 'nrc_moment',
    headline: '暗房初體驗',
    contentMd: '內容',
    mediaItems: [],
    moodTag: null,
    publishedAt: new Date(),
    club: {
      id: 'c1',
      slug: 'ncu-photo',
      name: '中大攝影社',
      avatarUrl: null,
      isDemo: true,
      verificationStatus: 'verified',
      universityShortName: '中央大學',
    },
  });

  const togetherItem = serializePublicTogetherItem({
    id: 't1',
    domainId: 'd1',
    domainName: '遊戲開發',
    itemType: 'showcase',
    parentItemId: null,
    title: 'WebGL 試玩',
    contentMd: '心得',
    mediaItems: [],
    embedUrl: 'https://itch.io',
    replyCount: 2,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    club: {
      id: 'c1',
      slug: 'ncu-gamedev',
      name: '中大創遊社',
      isDemo: true,
      universityShortName: '中央大學',
    },
  });

  assert.equal(question.display_asker, '匿名同學');
  assertNoForbiddenKeys({ club, streamCard, eventCard, question, streamPost, togetherItem });
});

test('URL validators block javascript:, path traversal, and non-allowlisted embed hosts', () => {
  assert.equal(isAllowedMediaUrl('/images/demo/moment-4x5.svg'), true);
  assert.equal(isAllowedMediaUrl('/images/demo/../secret.svg'), false);
  assert.equal(isAllowedEmbedUrl('https://myteam.itch.io/game'), true);
  assert.equal(isAllowedEmbedUrl('https://evil.example.com/phish'), false);
  assert.equal(isAllowedEmbedUrl('javascript:alert(1)'), false);
});
