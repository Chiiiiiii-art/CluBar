import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateClubWriteAccess, evaluateSummaryAccess } from '../src/lib/auth/guards';
import {
  FORBIDDEN_PUBLIC_KEYS,
  serializeDiscoverCard,
  serializeForumReply,
  serializeForumThread,
  serializePublicClub,
  serializePublicPost,
} from '../src/lib/serializers';
import { postWriteSchema, safeExternalUrlSchema, slugSchema } from '../src/lib/validators';

function collectAllKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.flatMap((item, idx) => collectAllKeys(item, `${prefix}[${idx}]`));
  }
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    keys.push(k);
    if (v && typeof v === 'object') {
      keys.push(...collectAllKeys(v, path));
    }
  }
  return keys;
}

test('RBAC guards enforce campus verification, active membership, and suspended boundary', () => {
  // Unverified member cannot post/edit
  const unverified = evaluateClubWriteAccess({
    campusVerifiedAt: null,
    clubStatus: 'verified',
    membershipRole: 'owner',
    membershipEndedAt: null,
    allowedRoles: ['owner', 'editor'],
  });
  assert.equal(unverified.ok, false);
  if (!unverified.ok) assert.equal(unverified.status, 403);

  // Regular verified student without club membership cannot post in forum or manage club
  const nonMember = evaluateClubWriteAccess({
    campusVerifiedAt: new Date(),
    clubStatus: 'verified',
    membershipRole: null,
    membershipEndedAt: null,
    allowedRoles: ['owner', 'editor'],
  });
  assert.equal(nonMember.ok, false);
  if (!nonMember.ok) assert.equal(nonMember.status, 403);

  // Suspended club blocks write operations
  const suspended = evaluateClubWriteAccess({
    campusVerifiedAt: new Date(),
    clubStatus: 'suspended',
    membershipRole: 'owner',
    membershipEndedAt: null,
    allowedRoles: ['owner', 'editor'],
  });
  assert.equal(suspended.ok, false);
  if (!suspended.ok) {
    assert.equal(suspended.status, 403);
    assert.equal(suspended.code, 'CLUB_SUSPENDED');
  }

  // Editor cannot execute owner-only action
  const editorOwnerOnly = evaluateClubWriteAccess({
    campusVerifiedAt: new Date(),
    clubStatus: 'verified',
    membershipRole: 'editor',
    membershipEndedAt: null,
    allowedRoles: ['owner'],
  });
  assert.equal(editorOwnerOnly.ok, false);
  if (!editorOwnerOnly.ok) assert.equal(editorOwnerOnly.code, 'CLUB_OWNER_REQUIRED');

  // Platform admin & alumni can read annual summary
  assert.equal(
    evaluateSummaryAccess({
      platformRole: 'platform_admin',
      membershipRole: null,
      membershipEndedAt: null,
    }),
    true
  );
  assert.equal(
    evaluateSummaryAccess({
      platformRole: 'user',
      membershipRole: 'alumni',
      membershipEndedAt: new Date(),
    }),
    true
  );
});

test('Post publication requires originality_confirmed and rejects unsafe URLs / reserved slugs', () => {
  const unconfirmedPublish = postWriteSchema.safeParse({
    title: '未勾選授權的貼文',
    post_type: 'work',
    content_md: '這是一段超過十個字的測試貼文內容。',
    originality_confirmed: false,
    status: 'published',
  });
  assert.equal(unconfirmedPublish.success, false);

  const confirmedDraft = postWriteSchema.safeParse({
    title: '儲存為草稿不強制勾選',
    post_type: 'work',
    content_md: '這是一段超過十個字的測試貼文草稿。',
    originality_confirmed: false,
    status: 'draft',
  });
  assert.equal(confirmedDraft.success, true);

  assert.equal(safeExternalUrlSchema.safeParse('javascript:alert(1)').success, false);
  assert.equal(safeExternalUrlSchema.safeParse('data:text/html,hi').success, false);
  assert.equal(safeExternalUrlSchema.safeParse('https://ncu.edu.tw').success, true);
  assert.equal(safeExternalUrlSchema.safeParse('mailto:club@ncu.edu.tw').success, true);

  assert.equal(slugSchema.safeParse('admin').success, false);
  assert.equal(slugSchema.safeParse('apply').success, false);
  assert.equal(slugSchema.safeParse('ncu-photo').success, true);
});

test('Public serializers strictly omit PII and vanity metrics at every object depth', () => {
  const clubDto = serializePublicClub({
    id: 'c1',
    slug: 'ncu-photo',
    name: '中大攝影社',
    category: 'arts',
    tagline: '記錄校園光影',
    description: '簡介',
    avatarUrl: null,
    coverUrl: null,
    externalLinks: [{ label: 'IG', url: 'https://instagram.com' }],
    verificationStatus: 'verified',
    isDemo: true,
    officialDirectoryUrl: null,
    university: { id: 'u1', code: 'NCU', name: '國立中央大學', shortName: '中央大學' },
  });

  const postDto = serializePublicPost({
    id: 'p1',
    clubId: 'c1',
    academicYear: 115,
    postType: 'work',
    title: '暗房攝影展',
    summary: '展覽摘要',
    contentMd: '正文內容',
    tags: ['攝影'],
    mediaUrls: [{ url: '/images/demo/arts.svg', alt: '作品' }],
    externalLinks: [],
    collaborators: null,
    publishedAt: new Date(),
    club: {
      id: 'c1',
      slug: 'ncu-photo',
      name: '中大攝影社',
      category: 'arts',
      avatarUrl: null,
      verificationStatus: 'verified',
      isDemo: true,
      universityShortName: '中央大學',
    },
  });

  const cardDto = serializeDiscoverCard({
    postId: 'p1',
    title: '暗房攝影展',
    summary: '展覽摘要',
    postType: 'work',
    academicYear: 115,
    tags: ['攝影'],
    mediaUrls: [{ url: '/images/demo/arts.svg' }],
    publishedAt: new Date(),
    reason: '符合底片與新手體驗需求',
    club: {
      id: 'c1',
      slug: 'ncu-photo',
      name: '中大攝影社',
      category: 'arts',
      avatarUrl: null,
      isDemo: true,
      verificationStatus: 'verified',
      universityId: 'u1',
      universityShortName: '中央大學',
    },
  });

  const threadDto = serializeForumThread({
    id: 't1',
    category: 'arts',
    discussionTag: 'equipment',
    authorTitle: '社長',
    title: '相機防潮管理',
    contentMd: '經驗分享',
    mediaUrls: [],
    externalUrl: null,
    replyCount: 2,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    club: {
      id: 'c1',
      slug: 'ncu-photo',
      name: '中大攝影社',
      isDemo: true,
      universityShortName: '中央大學',
    },
  });

  const replyDto = serializeForumReply({
    id: 'r1',
    threadId: 't1',
    authorTitle: '器材組',
    contentMd: '點交表單很有效',
    createdAt: new Date(),
    markedHelpfulByMe: true,
    hasHelpfulMarks: true,
    club: {
      id: 'c1',
      slug: 'ncu-photo',
      name: '中大攝影社',
      isDemo: true,
      universityShortName: '中央大學',
    },
  });

  for (const dto of [clubDto, postDto, cardDto, threadDto, replyDto]) {
    const keys = collectAllKeys(dto);
    for (const k of keys) {
      assert.equal(
        FORBIDDEN_PUBLIC_KEYS.has(k),
        false,
        `Forbidden key "${k}" leaked into public DTO`
      );
    }
  }
});
