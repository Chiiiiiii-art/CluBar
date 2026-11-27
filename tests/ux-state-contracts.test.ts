import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInternalPath, isAllowedMediaUrl } from '../src/lib/validators';
import { clampedAspectRatio } from '../src/lib/serializers';
import { buildFallbackDraft, shouldRouteDraftToEvent, type VisionDraftExtractResult } from '../src/lib/ai/draft';

test('sanitizeInternalPath accepts relative app paths and blocks open redirects', () => {
  assert.equal(sanitizeInternalPath('/e/coffee-1?tab=poll'), '/e/coffee-1?tab=poll');
  assert.equal(sanitizeInternalPath('  /my-clubs  '), '/my-clubs');
  assert.equal(sanitizeInternalPath('/me?returnTo=%2Fclubs%2Fapply'), '/me?returnTo=%2Fclubs%2Fapply');

  assert.equal(sanitizeInternalPath('https://evil.example/phish'), '/');
  assert.equal(sanitizeInternalPath('//evil.example/phish'), '/');
  assert.equal(sanitizeInternalPath('/\\evil.example'), '/');
  assert.equal(sanitizeInternalPath('javascript:alert(1)', ''), '');
  assert.equal(sanitizeInternalPath('', ''), '');
  assert.equal(sanitizeInternalPath(undefined, '/fallback'), '/fallback');
});

test('isAllowedMediaUrl permits curated /images/examples assets and blocks traversal/untrusted hosts', () => {
  assert.equal(isAllowedMediaUrl('/images/examples/coffee-roast-4x5.webp'), true);
  assert.equal(isAllowedMediaUrl('/images/examples/service-interview-4x5.webp'), true);
  assert.equal(isAllowedMediaUrl('/images/demo/sample.png'), true);

  assert.equal(isAllowedMediaUrl('/images/examples/../secret.webp'), false);
  assert.equal(isAllowedMediaUrl('/images/examples/bad path.webp'), false);
  assert.equal(isAllowedMediaUrl('https://untrusted.example.com/poster.png'), false);
});

test('clampedAspectRatio preserves natural masonry ratios and clamps extremes to [0.56, 1.91]', () => {
  assert.equal(clampedAspectRatio(undefined, undefined), '4 / 5');
  assert.equal(clampedAspectRatio(0, 500), '4 / 5');
  assert.equal(clampedAspectRatio(947, 1187), '0.798 / 1');
  assert.equal(clampedAspectRatio(1280, 720), '1.778 / 1');
  assert.equal(clampedAspectRatio(100, 500), '0.560 / 1');
  assert.equal(clampedAspectRatio(2000, 400), '1.910 / 1');
});

test('AI fallback draft still routes event posters and club calendars to Events (D-11)', () => {
  const calendar = '創遊社下學期社課表\n3/5 19:00 Unity 入門\n3/12 19:00 美術資源';
  assert.equal(buildFallbackDraft(calendar, '創遊社').extracted_event.starts_at_hint, '3/5 19:00');
  assert.equal(shouldRouteDraftToEvent(buildFallbackDraft(calendar, '創遊社'), calendar), true);

  const poster = '迎新體驗課 11月29日 19:00 免費報名';
  const posterDraft = buildFallbackDraft(poster, '熱舞社');
  assert.equal(posterDraft.extracted_event.fee_ntd, 0);
  assert.equal(shouldRouteDraftToEvent(posterDraft, poster), true);

  const recap = '昨晚社課試烘淺焙豆，大家輪流手沖，香氣超棒';
  assert.equal(shouldRouteDraftToEvent(buildFallbackDraft(recap, '咖啡社'), recap), false);
});

test('shouldRouteDraftToEvent routes recruitment/event posters to Events while keeping club recaps in stream', () => {
  const posterEventDraft: VisionDraftExtractResult = {
    title: '期中手沖咖啡體驗夜｜免經驗歡迎報名',
    summary: '歡迎非社員一起認識手沖器材，現場提供手沖試飲。',
    content_md: '週四晚間在遊藝館一樓，免費報名參加。',
    post_kind: 'nrc_moment',
    extracted_event: {
      starts_at_hint: '10/24 19:00',
      location_text: '遊藝館 101',
      fee_ntd: 0,
      beginner_friendly: true,
      non_members_welcome: true,
      learning_hours_hint: '生活 2 小時',
    },
    missing_beginner_fields: [],
    poster_text_heavy: true,
  };
  assert.equal(
    shouldRouteDraftToEvent(posterEventDraft, '10/24 19:00 遊藝館 101 新生迎新體驗課開放報名'),
    true
  );

  const cleanEventInvite: VisionDraftExtractResult = {
    ...posterEventDraft,
    poster_text_heavy: false,
  };
  assert.equal(shouldRouteDraftToEvent(cleanEventInvite, '免費體驗報名中'), true);

  const retrospectiveMoment: VisionDraftExtractResult = {
    title: '昨晚社課試烘淺焙豆，差點過萃但香氣超棒',
    summary: '週四晚間社員一起調整粉水比的心得紀錄。',
    content_md: '昨晚大家在社辦練了六壺耶加雪菲，還留了一小包給週五值班同學喝。',
    post_kind: 'nrc_moment',
    extracted_event: {
      starts_at_hint: null,
      location_text: null,
      fee_ntd: null,
      beginner_friendly: null,
      non_members_welcome: null,
      learning_hours_hint: null,
    },
    missing_beginner_fields: [],
    poster_text_heavy: false,
  };
  assert.equal(
    shouldRouteDraftToEvent(retrospectiveMoment, '昨晚社課試烘淺焙豆的心得與現場紀錄'),
    false
  );
});
