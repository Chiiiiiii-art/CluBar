import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PALETTES,
  encodeRecipe,
  parseFood,
  parseMaker,
  parsePalette,
  parseRecipe,
  partColor,
  toRecipe,
} from '../src/lib/recipe';

test('recipe round-trips through the share link, biggest share first', () => {
  const parts = toRecipe({ 'software-ai': 1, 'game-dev': 3, 'boardgame-esports': 1, 'music-live': 0 });
  assert.deepEqual(
    parts.map((p) => [p.slug, p.count]),
    [['game-dev', 3], ['software-ai', 1], ['boardgame-esports', 1]]
  );
  assert.deepEqual(parseRecipe(encodeRecipe(parts)), parts);
});

test('parseRecipe drops untrusted junk', () => {
  assert.deepEqual(parseRecipe('nope:3,game-dev:-1,photo-film:1.5,music-live:abc'), []);
  assert.equal(parseRecipe('game-dev:500')[0]!.count, 99);
  assert.equal(parseFood('pizza'), 'pizza');
  assert.equal(parseFood('<script>'), 'drink');
});

test('palettes: neighbouring ingredients never share a colour; maker name is cleaned', () => {
  for (const pal of PALETTES) {
    for (let i = 0; i < 12; i++) assert.notEqual(partColor(pal.id, i), partColor(pal.id, i + 1), pal.id);
  }
  assert.equal(parsePalette('nope'), 'soda');
  assert.equal(parseMaker('  小明<script>  '), '小明script');
  assert.equal(parseMaker('a'.repeat(40)).length, 16);
});
