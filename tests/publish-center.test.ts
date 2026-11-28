import assert from 'node:assert/strict';
import test from 'node:test';
import type { clubEvents, clubs } from '../src/db/schema';
import { AppError } from '../src/lib/errors';
import { buildEventPromoPack } from '../src/lib/services/events';
import {
  buildDiscordPayload,
  decryptSecret,
  encryptSecret,
  normalizeDiscordWebhookUrl,
  sendDiscordWebhook,
} from '../src/lib/services/publish-channels';

const TOKEN = 'abcDEF123_-abcDEF123_-abcDEF123_-abcDEF123_-abcDEF123_-abcDEF12';

test('Discord webhook URL: accepts only https discord hosts with /api/webhooks/<id>/<token>', () => {
  for (const host of ['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com']) {
    assert.equal(
      normalizeDiscordWebhookUrl(`  https://${host}/api/webhooks/123456789012345678/${TOKEN} `),
      `https://${host}/api/webhooks/123456789012345678/${TOKEN}`
    );
  }
  const rejects = [
    `http://discord.com/api/webhooks/123456789012345678/${TOKEN}`,
    `https://evil.com/api/webhooks/123456789012345678/${TOKEN}`,
    `https://discord.com.evil.com/api/webhooks/123456789012345678/${TOKEN}`,
    `https://evildiscord.com/api/webhooks/123456789012345678/${TOKEN}`,
    `https://user:pw@discord.com/api/webhooks/123456789012345678/${TOKEN}`,
    `https://discord.com:8443/api/webhooks/123456789012345678/${TOKEN}`,
    `https://discord.com/api/webhooks/abc/${TOKEN}`,
    `https://discord.com/api/webhooks/123456789012345678`,
    `https://discord.com/api/webhooks/123456789012345678/${TOKEN}/extra`,
    `https://discord.com/api/webhooks/123456789012345678/${TOKEN}?thread_id=1`,
    `https://discord.com/api/v10/users/@me`,
    'not a url',
    '',
  ];
  for (const url of rejects) assert.equal(normalizeDiscordWebhookUrl(url), null, url);
});

test('webhook secret: AES-256-GCM round trip, random IV, tamper and missing key fail', () => {
  const prev = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'test-secret-for-publish-center';
  try {
    const url = `https://discord.com/api/webhooks/123456789012345678/${TOKEN}`;
    const a = encryptSecret(url);
    const b = encryptSecret(url);
    assert.notEqual(a, b);
    assert.equal(a.split('.').length, 3);
    assert.ok(!a.includes(TOKEN));
    assert.equal(decryptSecret(a), url);

    const [iv, tag, ct] = a.split('.');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 1;
    assert.throws(() => decryptSecret([iv, tag, flipped.toString('base64')].join('.')), AppError);

    process.env.AUTH_SECRET = 'rotated';
    assert.throws(() => decryptSecret(a), AppError);

    delete process.env.AUTH_SECRET;
    assert.throws(() => encryptSecret(url), (err: unknown) => err instanceof AppError && err.code === 'SERVER_SECRET_MISSING');
  } finally {
    if (prev === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prev;
  }
});

test('Discord payload blocks mentions; send maps errors without leaking the URL', async () => {
  const payload = buildDiscordPayload('@everyone 來玩'.padEnd(2100, '!'), {
    title: '活動',
    url: 'https://clubar.test/e/abc',
    description: '說明',
    imageUrl: 'https://clubar.test/api/og/events/abc',
  });
  assert.deepEqual(payload.allowed_mentions, { parse: [] });
  assert.equal(payload.content.length, 2000);

  const secretUrl = `https://discord.com/api/webhooks/1/${TOKEN}`;
  let calledWith = '';
  await sendDiscordWebhook(secretUrl, payload, (async (u: string) => {
    calledWith = u;
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch);
  assert.equal(calledWith, `${secretUrl}?wait=true`);

  await assert.rejects(
    sendDiscordWebhook(secretUrl, payload, (async () => new Response('', { status: 404 })) as unknown as typeof fetch),
    (err: unknown) => err instanceof AppError && err.code === 'DISCORD_WEBHOOK_INVALID' && !err.message.includes(TOKEN)
  );
  await assert.rejects(
    sendDiscordWebhook(secretUrl, payload, (async () => {
      throw new TypeError(`fetch failed ${secretUrl}`);
    }) as unknown as typeof fetch),
    (err: unknown) => err instanceof AppError && !err.message.includes(TOKEN)
  );
});

function makeEvent(overrides: Partial<typeof clubEvents.$inferSelect>) {
  return {
    shortCode: 'photo-ab12',
    title: '底片攝影體驗',
    summary: '帶你拍第一卷底片',
    startsAt: new Date('2026-12-05T11:00:00Z'),
    scheduleMode: 'scheduled',
    feeNtd: 0,
    learningHoursCategory: 'none',
    learningHoursCount: '0',
    locationText: '工程五館 A205',
    beginnerFriendly: true,
    nonMembersWelcome: true,
    shareHideLocation: false,
    ...overrides,
  } as typeof clubEvents.$inferSelect;
}

test('promo pack: hides location when shareHideLocation, adds feed image url', () => {
  const club = { name: '攝影社' } as typeof clubs.$inferSelect;
  const shown = buildEventPromoPack({ event: makeEvent({}), club, universityShortName: '中央大學', baseUrl: 'https://clubar.test/' });
  assert.equal(shown.og_feed_image_url, 'https://clubar.test/api/og/events/photo-ab12?format=feed');
  assert.ok(shown.line_message.includes('工程五館 A205'));
  assert.equal(shown.location_text, '工程五館 A205');

  const hidden = buildEventPromoPack({
    event: makeEvent({ shareHideLocation: true }),
    club,
    universityShortName: '中央大學',
    baseUrl: 'https://clubar.test',
  });
  assert.equal(hidden.location_text, null);
  for (const text of [hidden.line_message, hidden.discord_markdown, hidden.ig_caption]) {
    assert.ok(!text.includes('工程五館'), text);
    assert.ok(!text.includes('地點'), text);
    assert.ok(text.includes('https://clubar.test/e/photo-ab12'));
  }
});
