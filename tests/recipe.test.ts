import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeRecipe, parseFood, parseRecipe, toRecipe } from '../src/lib/recipe';
import { DOMAIN_COLORS } from '../src/lib/og/card-parts';
import { INTEREST_DOMAIN_SEEDS } from '../src/lib/constants';

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

test('OG domain colours match the --color-domain-* tokens', () => {
  const css = readFileSync(join(__dirname, '..', 'src', 'app', 'globals.css'), 'utf8');
  for (const d of INTEREST_DOMAIN_SEEDS) {
    const m = css.match(new RegExp(`--color-domain-${d.slug}:\\s*(#[0-9a-f]{6})`));
    assert.ok(m, `missing token for ${d.slug}`);
    assert.equal(DOMAIN_COLORS[d.slug], m![1]);
  }
});
