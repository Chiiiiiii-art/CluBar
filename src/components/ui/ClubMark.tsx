import type { ClubCategory } from '@/db/schema';
import { cn } from './cn';

const DOMAINS: ClubCategory[] = ['academic', 'arts', 'recreation', 'sports', 'service', 'social'];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Monogram used when a club or person has no image, instead of fake art.
 * Clubs render as a coaster (docs/design/02-tokens.md §3): a circle in the club's
 * domain colour with an inner ring. Pass `category` when known; otherwise the
 * seed picks a stable domain colour. `round` marks a person: a plain espresso disc.
 */
export function ClubMark({
  name,
  seed,
  category,
  size = 'md',
  round = false,
  className,
}: {
  name: string;
  seed?: string;
  category?: ClubCategory;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  round?: boolean;
  className?: string;
}) {
  const ch = Array.from(name.replace(/^(國立|私立)?/, '').trim())[0] ?? '?';
  const dims = { sm: 'h-8 w-8 text-sm', md: 'h-11 w-11 text-base', lg: 'h-16 w-16 text-2xl', xl: 'h-20 w-20 text-3xl' }[size];

  if (round) {
    return (
      <span
        aria-hidden="true"
        className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-surface-subtle font-bold text-fg', dims, className)}
      >
        {ch}
      </span>
    );
  }

  const domain = category ?? DOMAINS[hash(seed ?? name) % DOMAINS.length];
  const ink = `var(--color-domain-${domain})`;
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold', dims, className)}
      style={{
        backgroundColor: `var(--color-domain-${domain}-soft)`,
        color: ink,
        boxShadow: `inset 0 0 0 3px var(--color-surface), inset 0 0 0 4.5px color-mix(in oklch, ${ink} 40%, transparent)`,
      }}
    >
      {ch}
    </span>
  );
}
