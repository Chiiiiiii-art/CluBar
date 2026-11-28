import type { ClubCategory } from '@/db/schema';
import { cn } from './cn';

const DOMAINS: ClubCategory[] = ['academic', 'arts', 'recreation', 'sports', 'service', 'social'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SCALLOP_PATH =
  'M32 3l6.8 5.2L47 6.5l3.1 7.9 8.2 2.4-1.1 8.5 5.8 6.4-5.8 6.4 1.1 8.5-8.2 2.4L47 57.5l-8.2-1.7L32 61l-6.8-5.2L17 57.5l-3.1-7.9-8.2-2.4 1.1-8.5L1 32l5.8-6.4-1.1-8.5 8.2-2.4L17 6.5l8.2 1.7z';

/**
 * Monogram used when a club or person has no image.
 * Clubs render as a non-circular scalloped die-cut sticker (docs/design/02-tokens.md §3)
 * in the club's domain colour with an ink outline and hard shadow.
 * `round` marks a person: a crisp circle with an ink ring to distinguish people from clubs.
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
  const cleanName = round
    ? name.trim()
    : name
        .replace(
          /^(?:國立|私立)?(?:臺灣|台灣)?[\u4e00-\u9fff]{1,6}(?:科技大學|師範大學|政治大學|教育大學|商業大學|海洋大學|藝術大學|體育大學|大學|科大|學院|專校)\s*/u,
          ''
        )
        .replace(/^(?:國立|私立|中大|中央|台大|臺大|政大|清大|交大|成大|師大)\s*/, '')
        .trim();
  const ch = Array.from(cleanName || name.trim())[0] ?? '?';
  const dims = {
    sm: 'h-9 w-9 text-sm',
    md: 'h-11 w-11 text-base',
    lg: 'h-16 w-16 text-2xl',
    xl: 'h-20 w-20 text-3xl',
  }[size];

  if (round) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border-2 border-border-ink bg-spark font-display font-bold text-fg',
          dims,
          className
        )}
      >
        {ch}
      </span>
    );
  }

  const domain = category ?? DOMAINS[hash(seed ?? name) % DOMAINS.length];
  const ink = `var(--color-domain-${domain})`;
  const soft = `var(--color-domain-${domain}-soft)`;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'scallop-shadow relative inline-flex shrink-0 items-center justify-center font-display font-black',
        dims,
        className
      )}
      style={{ color: ink }}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d={SCALLOP_PATH} fill={soft} stroke="var(--color-border-ink)" strokeWidth={3.2} />
      </svg>
      <span className="relative">{ch}</span>
    </span>
  );
}
