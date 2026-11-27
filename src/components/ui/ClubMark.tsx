import { cn } from './cn';

// Muted, white-text-safe backgrounds (all >= 4.5:1 with white), defined in globals.css.
const SWATCHES = [
  'var(--color-mark-1)',
  'var(--color-mark-2)',
  'var(--color-mark-3)',
  'var(--color-mark-4)',
  'var(--color-mark-5)',
  'var(--color-mark-6)',
  'var(--color-mark-7)',
  'var(--color-mark-8)',
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Monogram used when a club or user has no image, instead of fake art. */
export function ClubMark({
  name,
  seed,
  size = 'md',
  round = false,
  className,
}: {
  name: string;
  seed?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  round?: boolean;
  className?: string;
}) {
  const ch = Array.from(name.replace(/^(國立|私立)?/, '').trim())[0] ?? '?';
  const bg = SWATCHES[hash(seed ?? name) % SWATCHES.length];
  const dims = { sm: 'h-8 w-8 text-sm', md: 'h-11 w-11 text-base', lg: 'h-16 w-16 text-2xl', xl: 'h-20 w-20 text-3xl' }[size];
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center font-bold text-on-brand', round ? 'rounded-full' : 'rounded-xl', dims, className)}
      style={{ backgroundColor: bg }}
    >
      {ch}
    </span>
  );
}
