import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

type FilterChipProps = Omit<ComponentProps<'button'>, 'aria-pressed'> & {
  selected: boolean;
  icon?: ReactNode;
};

/** Toggle chip for filters. 44px tall touch target, exposes aria-pressed. */
export function FilterChip({ selected, icon, className, children, type = 'button', ...rest }: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors',
        selected
          ? 'border-fg bg-fg text-on-brand'
          : 'border-line bg-surface text-fg-secondary hover:border-border-strong hover:bg-surface-subtle',
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
        'no-scrollbar scroll-fade-x -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
