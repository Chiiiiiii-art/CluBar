import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isPlaceholderMedia, realMediaUrl } from '../src/lib/media/placeholder';

/**
 * Guards the design system: UI code must use the semantic tokens defined in
 * src/app/globals.css (ink / accent / success / warning / danger, line,
 * canvas) and the shared components in src/components/ui.
 */

const ROOT = join(__dirname, '..', 'src');
// OG image routes render to PNG and need literal colours.
const EXEMPT = [join('app', 'api', 'og'), join('components', 'ui')];

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

const files = tsxFiles(ROOT).filter((f) => !EXEMPT.some((e) => relative(ROOT, f).startsWith(e + sep)));

const RULES: Array<{ name: string; pattern: RegExp; hint: string }> = [
  {
    name: 'raw Tailwind palette',
    pattern:
      /(?<![\w-])(?:bg|text|border(?:-[trblxy])?|ring|from|via|to|divide|outline|fill|stroke|decoration|placeholder|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
    hint: 'use ink-*, accent-*, success-*, warning-* or danger-*',
  },
  { name: 'hex colour in class', pattern: /-\[#[0-9a-fA-F]{3,8}\]/, hint: 'use a token from globals.css' },
  { name: 'legacy CSS var class', pattern: /-\[var\(--[a-z-]+\)\]/, hint: 'use the semantic utility (e.g. border-line)' },
  { name: 'sub-12px text', pattern: /text-\[(?:[0-9]|1[01])px\]/, hint: 'text-xs (12px) is the floor' },
  { name: 'extra-heavy weight', pattern: /(?<![\w-])font-(?:extrabold|black)\b/, hint: 'max weight is font-bold' },
  { name: 'off-scale radius', pattern: /(?<![\w-])rounded(?:-[trbl]{1,2})?-(?:2xl|3xl)\b/, hint: 'radii are lg / xl / full' },
  { name: 'window.confirm', pattern: /window\.confirm\(/, hint: 'use useConfirm() from components/ui' },
];

for (const rule of RULES) {
  test(`UI uses design tokens: no ${rule.name}`, () => {
    const hits: string[] = [];
    for (const f of files) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const m = line.match(rule.pattern);
          if (m) hits.push(`${relative(ROOT, f)}:${i + 1}  ${m[0]}`);
        });
    }
    assert.deepEqual(hits, [], `${rule.name} found (${rule.hint}):\n${hits.join('\n')}`);
  });
}

test('demo SVG placeholders are treated as missing media', () => {
  assert.equal(isPlaceholderMedia('/images/demo/moment-4x5.svg'), true);
  assert.equal(isPlaceholderMedia(null), true);
  assert.equal(isPlaceholderMedia(''), true);
  assert.equal(isPlaceholderMedia('/images/examples/coffee-roast-4x5.webp'), false);
  assert.equal(realMediaUrl('/images/demo/cover.svg'), null);
  assert.equal(realMediaUrl('https://cdn.example/a.webp'), 'https://cdn.example/a.webp');
});
