import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DiscoverLLMResponseSchema,
  extractSearchTokens,
  runDiscoverQuery,
  type DiscoverStreamCandidate,
} from '../src/lib/discovery/service';
import {
  computeBlendScore,
  computePersonaArchetype,
} from '../src/lib/services/onboarding-blend';
import { generateVisionOrRawDraft } from '../src/lib/ai/draft';

function makeCandidate(
  id: string,
  clubId: string,
  similarityScore = 0.8
): DiscoverStreamCandidate {
  return {
    id,
    clubId,
    postKind: 'nrc_moment',
    headline: `現場動態 ${id}`,
    contentMd: `這是 ${clubId} 的日常紀錄`,
    mediaItems: [],
    publishedAt: new Date('2026-11-25T00:00:00Z'),
    lastActivityAt: new Date('2026-11-25T00:00:00Z'),
    similarityScore,
    club: {
      id: clubId,
      slug: clubId,
      name: `社團 ${clubId}`,
      avatarUrl: null,
      isDemo: true,
      verificationStatus: 'verified',
      universityId: '11111111-1111-4111-8111-111111111111',
      universityShortName: '中央大學',
    },
  };
}

const P1 = '11111111-1111-4111-8111-111111111101';
const P2 = '11111111-1111-4111-8111-111111111102';
const P3 = '11111111-1111-4111-8111-111111111103';
const HALLUCINATED_ID = '99999999-9999-4999-8999-999999999999';

test('runDiscoverQuery degrades cleanly with warning when LLM times out or throws', async () => {
  const candidates = [
    makeCandidate(P1, 'club-1', 0.9),
    makeCandidate(P2, 'club-1', 0.88),
    makeCandidate(P3, 'club-2', 0.85),
  ];

  const res = await runDiscoverQuery(
    { query: '想學拍底片' },
    {
      embed: async () => new Array(1536).fill(0.1),
      vectorSearch: async () => candidates,
      keywordSearch: async () => candidates,
      rankWithLlm: async () => {
        throw new Error('AI_CHAT_TIMEOUT');
      },
    }
  );

  assert.equal(res.degraded, true);
  assert.ok(res.warning_message && res.warning_message.length > 0);
  assert.equal(res.items.length, 3);
  assert.equal(res.items[0]!.reason, undefined);
  assert.equal(res.items[0]!.club.id, 'club-1');
  assert.equal(res.items[1]!.club.id, 'club-2');
  assert.equal(res.items[2]!.club.id, 'club-1');
});

test('runDiscoverQuery degrades cleanly when LLM returns malformed JSON', async () => {
  const candidates = [makeCandidate(P1, 'club-1', 0.8), makeCandidate(P3, 'club-2', 0.7)];

  const res = await runDiscoverQuery(
    { query: '找遊戲開發夥伴' },
    {
      embed: async () => null,
      vectorSearch: async () => [],
      keywordSearch: async () => candidates,
      rankWithLlm: async () => DiscoverLLMResponseSchema.parse({ bad_field: 123 }),
    }
  );

  assert.equal(res.degraded, true);
  assert.ok(res.warning_message);
  assert.equal(res.items.length, 2);
});

test('runDiscoverQuery strips hallucinated IDs and relevance_score < 55', async () => {
  const candidates = [makeCandidate(P1, 'club-1'), makeCandidate(P2, 'club-2')];

  const res = await runDiscoverQuery(
    { query: '新手暗房體驗' },
    {
      embed: async () => new Array(1536).fill(0.2),
      vectorSearch: async () => candidates,
      keywordSearch: async () => [],
      rankWithLlm: async () => ({
        recommendations: [
          { post_id: HALLUCINATED_ID, relevance_score: 99, reason: '幻覺捏造 ID 應被剔除' },
          { post_id: P2, relevance_score: 40, reason: '低於 55 分應被剔除' },
          { post_id: P1, relevance_score: 92, reason: '提供零基礎暗房底片沖洗體驗課' },
        ],
      }),
    }
  );

  assert.equal(res.degraded, false);
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0]!.id, P1);
  assert.equal(res.items[0]!.reason, '提供零基礎暗房底片沖洗體驗課');
});

test('Onboarding archetype and Blend deterministic scoring stay bounded 45..100', () => {
  const archetype = computePersonaArchetype({
    goals: ['make_friends'],
    vibe: 'chill',
    domainNames: ['影像攝影'],
  });
  assert.equal(archetype, '暖心破冰派 · 影像攝影');

  const fullMatch = computeBlendScore({
    domainsA: ['d1', 'd2'],
    goalsA: ['g1'],
    domainsB: ['d1', 'd2'],
    goalsB: ['g1'],
  });
  assert.equal(fullMatch.matchScore, 100);
  assert.deepEqual(fullMatch.sharedDomainIds, ['d1', 'd2']);

  const zeroMatch = computeBlendScore({
    domainsA: ['d1'],
    goalsA: ['g1'],
    domainsB: ['d2'],
    goalsB: ['g2'],
  });
  assert.equal(zeroMatch.matchScore, 45);
  assert.deepEqual(zeroMatch.sharedDomainIds, []);
});


test('generateVisionOrRawDraft degrades cleanly on Vision timeout without throwing', async () => {
  const posterFile = new File([new Uint8Array([137, 80, 78, 71])], 'poster.png', {
    type: 'image/png',
  });

  const result = await generateVisionOrRawDraft(
    {
      rawText: '底片沖洗之夜歡迎零基礎免費體驗',
      file: posterFile,
      clubName: '中大攝影社',
      universityShortName: '中央大學',
    },
    {
      callVision: async () => {
        throw new Error('AI_VISION_TIMEOUT');
      },
    }
  );

  assert.equal(result.degraded, true);
  assert.equal(result.extracted_source, 'vision_poster');
  assert.ok(result.warnings.length >= 1);
  assert.ok(result.draft.title.length >= 2);
  assert.ok(result.draft.missing_beginner_fields.length >= 1);
});


test('extractSearchTokens splits natural-language CJK queries into meaningful bigrams', () => {
  const tokens = extractSearchTokens('想學拍底片，零基礎可以體驗的社團');
  assert.ok(tokens.includes('底片'));
  assert.ok(tokens.includes('零基礎') || tokens.includes('基礎'));
  assert.ok(tokens.includes('體驗'));
});
