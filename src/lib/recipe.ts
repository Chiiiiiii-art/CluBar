import { INTEREST_DOMAIN_SEEDS } from './constants';

/**
 * Quiz result as a recipe: how many taps each interest got. Serialised into the share link
 * (`?r=game-dev:3,software-ai:1&f=drink`) so the card renders without a database.
 */
export type Food = 'drink' | 'pizza';

export const FOODS: { id: Food; label: string }[] = [
  { id: 'drink', label: '特調' },
  { id: 'pizza', label: '披薩' },
];

/**
 * Colour sets the user picks for their card. Colours go by rank (biggest share gets the first),
 * and each set alternates dark/light or warm/cool so neighbouring layers never blend together.
 * Like event theme presets these are user-chosen content colours, so they live here as literals
 * (the OG card needs literals anyway).
 */
export const PALETTES = [
  { id: 'soda', label: '汽水', colors: ['#ff6b6b', '#4d96ff', '#ffd93d', '#9b5de5', '#6bcb77', '#ff8fab', '#2ec4b6', '#f9844a'] },
  { id: 'sunset', label: '夕陽', colors: ['#f94144', '#f9c74f', '#277da1', '#f8961e', '#577590', '#f3722c', '#90be6d', '#43aa8b'] },
  { id: 'berry', label: '莓果', colors: ['#c9184a', '#ffb3c6', '#7b2cbf', '#f4a6c1', '#e63946', '#cdb4db', '#5a189a', '#ff758f'] },
  { id: 'matcha', label: '抹茶', colors: ['#386641', '#dde5b6', '#a7c957', '#283618', '#f2e8cf', '#6a994e', '#bc4749', '#b5c99a'] },
  { id: 'ocean', label: '海洋', colors: ['#023e8a', '#90e0ef', '#0077b6', '#caf0f8', '#03045e', '#48cae4', '#ade8f4', '#00b4d8'] },
] as const;
export type PaletteId = (typeof PALETTES)[number]['id'];

export function parsePalette(raw: string | null | undefined): PaletteId {
  return PALETTES.find((p) => p.id === raw)?.id ?? 'soda';
}

/** Colour for the i-th ingredient (parts are sorted biggest first). */
export function partColor(palette: PaletteId, i: number): string {
  const colors = PALETTES.find((p) => p.id === palette)!.colors;
  return colors[i % colors.length]!;
}

/** Name printed on the card; plain text, short. */
export function parseMaker(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
}

export interface RecipeCardState {
  parts: RecipePart[];
  food: Food;
  palette: PaletteId;
  maker: string;
}

function cardQuery(c: RecipeCardState): string {
  const q = new URLSearchParams({ r: encodeRecipe(c.parts), f: c.food, p: c.palette });
  if (c.maker) q.set('n', c.maker);
  return q.toString();
}

export interface RecipePart {
  slug: string;
  name: string;
  count: number;
}

const NAMES = new Map<string, string>(INTEREST_DOMAIN_SEEDS.map((d) => [d.slug, d.nameZh]));
export const MAX_TAPS = 99;

/** Biggest share first; ties keep the domains' usual order. */
export function toRecipe(counts: Record<string, number>): RecipePart[] {
  return INTEREST_DOMAIN_SEEDS.filter((d) => (counts[d.slug] ?? 0) > 0)
    .map((d) => ({ slug: d.slug, name: d.nameZh, count: Math.min(MAX_TAPS, Math.floor(counts[d.slug]!)) }))
    .sort((a, b) => b.count - a.count);
}

export function encodeRecipe(parts: { slug: string; count: number }[]): string {
  return parts.map((p) => `${p.slug}:${p.count}`).join(',');
}

/** Untrusted query string: unknown slugs and bad counts are dropped. */
export function parseRecipe(raw: string | null | undefined): RecipePart[] {
  const counts: Record<string, number> = {};
  for (const pair of (raw ?? '').split(',').slice(0, NAMES.size)) {
    const [slug, n] = pair.split(':');
    const count = Number(n);
    if (slug && NAMES.has(slug) && Number.isInteger(count) && count > 0) counts[slug] = count;
  }
  return toRecipe(counts);
}

export function parseFood(raw: string | null | undefined): Food {
  return raw === 'pizza' ? 'pizza' : 'drink';
}

export function foodLabel(food: Food): string {
  return FOODS.find((f) => f.id === food)!.label;
}

export function recipePath(c: RecipeCardState): string {
  return `/mix?${cardQuery(c)}`;
}

export function recipeImagePath(c: RecipeCardState): string {
  return `/api/og/mix?${cardQuery(c)}`;
}

export function cardTitle(maker: string, food: Food): string {
  return `${maker || '我'}的社團${foodLabel(food)}`;
}
