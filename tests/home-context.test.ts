import assert from 'node:assert/strict';
import test from 'node:test';
import { pickRoleStrip, type OfficerClubSignal } from '../src/lib/services/home-context';

const club = (patch: Partial<OfficerClubSignal>): OfficerClubSignal => ({
  slug: 'game',
  name: '創遊社',
  hasPendingQuestion: false,
  hasPendingPhoto: false,
  hasUpcomingEvent: true,
  ...patch,
});
const followed = { clubName: '攝影社', shortCode: 'abc123' };

test('no clubs and no followed events: no strip', () => {
  assert.equal(pickRoleStrip([], null), null);
});

test('officer question beats photo, idle and student hint', () => {
  const strip = pickRoleStrip(
    [club({ slug: 'a', hasPendingPhoto: true }), club({ slug: 'b', name: '吉他社', hasPendingQuestion: true })],
    followed
  );
  assert.deepEqual(strip, { text: '吉他社有新提問待回覆 · 去回覆', href: '/clubs/b/manage?tab=questions' });
});

test('officer with nothing pending but no upcoming event gets the publish hint', () => {
  assert.equal(pickRoleStrip([club({ hasUpcomingEvent: false })], null)?.href, '/clubs/game/manage?new=event');
});

test('officer with everything in order falls through to the followed event', () => {
  assert.deepEqual(pickRoleStrip([club({})], followed), { text: '你追蹤的攝影社本週有活動', href: '/e/abc123' });
});

test('strip text never contains digits (no counts)', () => {
  const strip = pickRoleStrip([club({ hasPendingQuestion: true })], null);
  assert.ok(strip && !/\d/.test(strip.text));
});
