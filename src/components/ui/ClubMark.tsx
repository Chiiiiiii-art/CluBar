import { cn } from './cn';

// Muted, white-text-safe backgrounds (all >= 4.5:1 with white).
const SWATCHES = ['#4338ca', '#0f766e', '#b45309', '#be123c', '#6d28d9', '#1d4ed8', '#047857', '#52525b'];

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
  className,
}: {
  name: string;
  seed?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const ch = Array.from(name.replace(/^(國立|私立)?/, '').trim())[0] ?? '?';
  const bg = SWATCHES[hash(seed ?? name) % SWATCHES.length];
  const dims = { sm: 'h-8 w-8 text-sm', md: 'h-11 w-11 text-base', lg: 'h-16 w-16 text-2xl', xl: 'h-20 w-20 text-3xl' }[size];
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-xl font-bold text-white', dims, className)}
      style={{ backgroundColor: bg }}
    >
      {ch}
    </span>
  );
}
