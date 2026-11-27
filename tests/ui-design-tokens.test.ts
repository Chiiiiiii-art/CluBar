import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isPlaceholderMedia, realMediaUrl } from '../src/lib/media/placeholder';

/**
 * Guards the design system: UI code must use the semantic tokens defined in
 * src/app/globals.css and the shared components in src/components/ui (which
 * themselves may not use primitive scale utilities).
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

function uiKitFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return uiKitFiles(full);
    return full.endsWith('.tsx') || full.endsWith('.ts') ? [full] : [];
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

/**
 * Class strings defined in non-JSX modules. The only raw palette allowed is
 * EVENT_THEME_PRESETS[*].gradientClass: organisers pick an event theme, so
 * those colours are content, not UI chrome.
 */
const CLASS_CONSTANT_FILES = [join('lib', 'constants.ts')];
const ALLOWED_RAW_PALETTE_LINE = /^\s*gradientClass:/;

test('class constants use design tokens (event theme gradients excepted)', () => {
  const palette = RULES[0].pattern;
  const hits: string[] = [];
  for (const rel of CLASS_CONSTANT_FILES) {
    readFileSync(join(ROOT, rel), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (ALLOWED_RAW_PALETTE_LINE.test(line)) return;
        const m = line.match(palette);
        if (m) hits.push(`${rel}:${i + 1}  ${m[0]}`);
      });
  }
  assert.deepEqual(hits, [], `raw palette in class constants:\n${hits.join('\n')}`);
});

test('src/components/ui uses semantic tokens only (no primitive scale utilities)', () => {
  const primitive =
    /(?<![\w-])(?:bg|text|border(?:-[trblxy])?|ring|from|via|to|divide|outline|fill|stroke|decoration|placeholder|accent|caret|shadow)-(?:ink|accent|success|warning|danger)-\d{2,3}\b/;
  const hits: string[] = [];
  for (const f of uiKitFiles(join(ROOT, 'components', 'ui'))) {
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const m = line.match(primitive);
        if (m) hits.push(`${relative(ROOT, f)}:${i + 1}  ${m[0]}`);
      });
  }
  assert.deepEqual(hits, [], `primitive scale utility found in src/components/ui:\n${hits.join('\n')}`);
});

test('legacy CSS variable aliases are gone', () => {
  const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
  assert.doesNotMatch(css, /--(?:brand|primary|surface-warm|border-strong):/);
});

/** Index just past the `>` closing the JSX opening tag that starts at `i`. */
function openingTagEnd(src: string, i: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if ((c === '"' || c === "'" || c === '`') && depth === 0) quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return j + 1;
  }
  return -1;
}

test('every form control has an accessible name (WCAG 1.3.1 / 3.3.2)', () => {
  const hits: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const htmlFors = new Set([...src.matchAll(/htmlFor=["{]`?([^"`}]+)/g)].map((m) => m[1]));
    for (const m of src.matchAll(/<(input|select|textarea)\b/g)) {
      const start = m.index!;
      const head = src.slice(start, openingTagEnd(src, start + m[0].length));
      if (/type="(hidden|submit|button)"/.test(head)) continue;
      if (/aria-label(ledby)?=/.test(head)) continue;
      const id = head.match(/\bid=["{]`?([^"`}]+)/)?.[1];
      if (id && htmlFors.has(id)) continue;
      const before = src.slice(0, start);
      if (before.lastIndexOf('<label') > before.lastIndexOf('</label>')) continue;
      hits.push(`${relative(ROOT, f)}:${before.split('\n').length}  <${m[1]}>`);
    }
  }
  assert.deepEqual(hits, [], `unlabeled form controls (add a <label htmlFor> or aria-label):\n${hits.join('\n')}`);
});

test('demo SVG placeholders are treated as missing media', () => {
  assert.equal(isPlaceholderMedia('/images/demo/moment-4x5.svg'), true);
  assert.equal(isPlaceholderMedia(null), true);
  assert.equal(isPlaceholderMedia(''), true);
  assert.equal(isPlaceholderMedia('/images/examples/coffee-roast-4x5.webp'), false);
  assert.equal(realMediaUrl('/images/demo/cover.svg'), null);
  assert.equal(realMediaUrl('https://cdn.example/a.webp'), 'https://cdn.example/a.webp');
});
