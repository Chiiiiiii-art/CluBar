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

export function recipePath(parts: RecipePart[], food: Food): string {
  return `/mix?r=${encodeURIComponent(encodeRecipe(parts))}&f=${food}`;
}

export function recipeImagePath(parts: RecipePart[], food: Food): string {
  return `/api/og/mix?r=${encodeURIComponent(encodeRecipe(parts))}&f=${food}`;
}
