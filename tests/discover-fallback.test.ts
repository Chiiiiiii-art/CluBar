import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DiscoverLLMResponseSchema,
  runDiscoverQuery,
  type DiscoverCandidate,
} from '../src/lib/discovery/service';

function makeCandidate(id: string, clubId: string, similarityScore = 0.8): DiscoverCandidate {
  return {
    postId: id,
    clubId,
    title: `作品 ${id}`,
    summary: `這是 ${clubId} 的成果摘要`,
    postType: 'work',
    academicYear: 115,
    tags: ['攝影'],
    mediaUrls: [],
    publishedAt: new Date('2026-11-20T00:00:00Z'),
    similarityScore,
    club: {
      id: clubId,
      slug: clubId,
      name: `社團 ${clubId}`,
      category: 'arts',
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

test('runDiscoverQuery falls back cleanly with warning when LLM times out or throws', async () => {
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
  assert.equal(res.items[0].reason, undefined);
  // Fairness rule: club-1 cannot be back-to-back
  assert.equal(res.items[0].club.id, 'club-1');
  assert.equal(res.items[1].club.id, 'club-2');
  assert.equal(res.items[2].club.id, 'club-1');
});

test('runDiscoverQuery degrades when LLM returns invalid JSON structure', async () => {
  const candidates = [makeCandidate(P1, 'club-1', 0.8), makeCandidate(P3, 'club-2', 0.7)];

  const res = await runDiscoverQuery(
    { query: '找軟體專案夥伴' },
    {
      embed: async () => null, // triggers keyword search + degraded=true
      vectorSearch: async () => [],
      keywordSearch: async () => candidates,
      rankWithLlm: async () => {
        // Simulate Zod parse failure from bad JSON
        return DiscoverLLMResponseSchema.parse({ bad_field: 123 });
      },
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
  assert.equal(res.items[0].post_id, P1);
  assert.equal(res.items[0].reason, '提供零基礎暗房底片沖洗體驗課');
});
