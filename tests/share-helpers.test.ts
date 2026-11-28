import assert from 'node:assert/strict';
import test from 'node:test';
import { joinShareText, lineShareUrl } from '../src/lib/share';

test('lineShareUrl encodes Chinese, newlines and URL characters', () => {
  const text = '吉他社｜期初茶會\nhttps://clubar.tw/e/ab?x=1&y=2';
  const url = lineShareUrl(text);
  assert.ok(url.startsWith('https://line.me/R/share?text='));
  assert.ok(!url.includes('\n'));
  assert.ok(!url.slice(url.indexOf('=') + 1).includes('&'));
  assert.equal(decodeURIComponent(url.split('?text=')[1]!), text);
});

test('joinShareText appends url on a new line', () => {
  assert.equal(joinShareText('來玩吧', 'https://x.tw/e/1'), '來玩吧\nhttps://x.tw/e/1');
});

test('joinShareText does not duplicate a url already in the text', () => {
  const text = '來玩吧 https://x.tw/e/1';
  assert.equal(joinShareText(text, 'https://x.tw/e/1'), text);
});

test('joinShareText with empty or blank text returns just the url', () => {
  assert.equal(joinShareText('', 'https://x.tw/e/1'), 'https://x.tw/e/1');
  assert.equal(joinShareText('   \n', 'https://x.tw/e/1'), 'https://x.tw/e/1');
});
