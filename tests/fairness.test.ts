import assert from 'node:assert/strict';
import test from 'node:test';
import { applyFairnessPolicy, freshnessScore } from '../src/lib/discovery/fairness';

test('applyFairnessPolicy caps single club at 2, prevents consecutive duplicates, and never pads', () => {
  const highVolumePosts = Array.from({ length: 10 }, (_, idx) => ({
    postId: `hot-${idx + 1}`,
    clubId: 'club-hot',
    finalScore: 100 - idx * 0.5,
  }));

  const otherClubPosts = [
    { postId: 'other-a', clubId: 'club-a', finalScore: 82 },
    { postId: 'other-b', clubId: 'club-b', finalScore: 76 },
    { postId: 'other-c', clubId: 'club-c', finalScore: 71 },
  ];

  const output = applyFairnessPolicy([...highVolumePosts, ...otherClubPosts], {
    maxBatchSize: 12,
    maxPerClub: 2,
  });

  // 2 from club-hot + 3 from other clubs = 5 (never pads with remaining 8 hot posts)
  assert.equal(output.length, 5);

  const hotCount = output.filter((x) => x.clubId === 'club-hot').length;
  assert.equal(hotCount, 2);

  for (let i = 1; i < output.length; i++) {
    assert.notEqual(
      output[i].clubId,
      output[i - 1].clubId,
      'Consecutive posts from the same club must never appear'
    );
  }
});

test('applyFairnessPolicy ignores external popularity fields and respects exact small count', () => {
  const withPopularity = [
    { postId: 'p1', clubId: 'c1', finalScore: 90, fakeLikes: 1 },
    { postId: 'p2', clubId: 'c2', finalScore: 85, fakeLikes: 99999 },
    { postId: 'p3', clubId: 'c3', finalScore: 80, fakeLikes: 500 },
  ];
  const flippedPopularity = withPopularity.map((p) => ({
    ...p,
    fakeLikes: 100000 - p.fakeLikes,
  }));

  const resA = applyFairnessPolicy(withPopularity, { maxBatchSize: 12, maxPerClub: 2 });
  const resB = applyFairnessPolicy(flippedPopularity, { maxBatchSize: 12, maxPerClub: 2 });

  assert.deepEqual(
    resA.map((x) => x.postId),
    ['p1', 'p2', 'p3']
  );
  assert.deepEqual(
    resA.map((x) => x.postId),
    resB.map((x) => x.postId)
  );
});

test('freshnessScore gives 100 within 30 days and floors at 30 after 365 days', () => {
  const now = new Date('2026-11-25T00:00:00Z');
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400 * 1000);
  const twoYearsAgo = new Date(now.getTime() - 730 * 86400 * 1000);

  assert.equal(freshnessScore(fiveDaysAgo, now), 100);
  assert.equal(freshnessScore(twoYearsAgo, now), 30);
});
