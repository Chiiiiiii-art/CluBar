import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyFairnessPolicy,
  computeClubPulse,
  freshnessScore,
} from '../src/lib/discovery/fairness';

test('applyFairnessPolicy caps single club at 2, prevents consecutive duplicates, and never pads', () => {
  const highVolumePosts = Array.from({ length: 10 }, (_, idx) => ({
    id: `hot-${idx + 1}`,
    clubId: 'club-hot',
    finalScore: 100 - idx * 0.5,
  }));

  const otherClubPosts = [
    { id: 'other-a', clubId: 'club-a', finalScore: 82 },
    { id: 'other-b', clubId: 'club-b', finalScore: 76 },
    { id: 'other-c', clubId: 'club-c', finalScore: 71 },
  ];

  const output = applyFairnessPolicy([...highVolumePosts, ...otherClubPosts], {
    maxBatchSize: 12,
    maxPerClub: 2,
  });

  assert.equal(output.length, 5);
  assert.equal(output.filter((x) => x.clubId === 'club-hot').length, 2);

  for (let i = 1; i < output.length; i++) {
    assert.notEqual(output[i]!.clubId, output[i - 1]!.clubId);
  }
});

test('applyFairnessPolicy ignores external popularity fields', () => {
  const withPopularity = [
    { id: 'p1', clubId: 'c1', finalScore: 90, fakeLikes: 1 },
    { id: 'p2', clubId: 'c2', finalScore: 85, fakeLikes: 99999 },
    { id: 'p3', clubId: 'c3', finalScore: 80, fakeLikes: 500 },
  ];
  const flipped = withPopularity.map((p) => ({ ...p, fakeLikes: 100000 - p.fakeLikes }));

  const resA = applyFairnessPolicy(withPopularity, { maxBatchSize: 12, maxPerClub: 2 });
  const resB = applyFairnessPolicy(flipped, { maxBatchSize: 12, maxPerClub: 2 });

  assert.deepEqual(
    resA.map((x) => x.id),
    ['p1', 'p2', 'p3']
  );
  assert.deepEqual(
    resA.map((x) => x.id),
    resB.map((x) => x.id)
  );
});

test('freshnessScore and computeClubPulse produce expected qualitative signals', () => {
  const now = new Date('2026-11-26T00:00:00Z');
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400 * 1000);
  const twentyDaysAgo = new Date(now.getTime() - 20 * 86400 * 1000);
  const twoYearsAgo = new Date(now.getTime() - 730 * 86400 * 1000);

  assert.equal(freshnessScore(threeDaysAgo, now), 100);
  assert.equal(freshnessScore(twoYearsAgo, now), 30);

  assert.equal(computeClubPulse({ lastActivityAt: threeDaysAgo, now }), '本週剛更新');
  assert.equal(
    computeClubPulse({ lastActivityAt: twentyDaysAgo, recentQaMedianHours: 12, now }),
    '幹部當日回覆提問'
  );
  assert.equal(computeClubPulse({ lastActivityAt: twentyDaysAgo, now }), '近 30 天活躍');
});
