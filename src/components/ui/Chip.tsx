import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

type FilterChipProps = Omit<ComponentProps<'button'>, 'aria-pressed'> & {
  selected: boolean;
  icon?: ReactNode;
  shapeIndex?: number;
  tintClass?: string;
};

const SHAPES = [
  'sticker-shape-0',
  'sticker-shape-1',
  'sticker-shape-2',
  'sticker-shape-3',
  'sticker-shape-4',
  'sticker-shape-5',
];

/**
 * Toggle sticker chip for filters. 44px tall touch target, non-uniform sticker
 * silhouette when `shapeIndex` is passed, exposes aria-pressed.
 */
export function FilterChip({
  selected,
  icon,
  shapeIndex,
  tintClass,
  className,
  children,
  type = 'button',
  ...rest
}: FilterChipProps) {
  const shapeClass = typeof shapeIndex === 'number' ? SHAPES[Math.abs(shapeIndex) % SHAPES.length] : 'rounded-full';
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'tactile-press inline-flex min-h-11 shrink-0 items-center gap-1.5 border-2 border-border-ink px-3.5 font-display text-sm font-bold',
        shapeClass,
        selected ? 'bg-fg text-spark' : cn(tintClass ?? 'bg-surface hover:bg-surface-subtle', 'text-fg'),
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Row of chips: scrolls horizontally with a fade on small screens, wraps on
 * desktop so nothing is clipped when there is room.
 */
export function ChipRow({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'no-scrollbar scroll-fade-x -mx-4 flex items-center gap-2.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
