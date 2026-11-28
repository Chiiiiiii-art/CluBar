import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-subtle text-fg-secondary border-border-ink',
  accent: 'bg-spark text-spark-fg border-border-ink',
  success: 'bg-success-soft text-success-fg border-border-ink',
  warning: 'bg-warning-soft text-warning-fg border-border-ink',
  danger: 'bg-danger-soft text-danger-fg border-danger',
};

/**
 * Small status/category sticker label. Keep it to two per card.
 */
export function Badge({
  tone = 'neutral',
  icon,
  className,
  children,
  ...rest
}: ComponentProps<'span'> & { tone?: BadgeTone; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold leading-5',
        TONE[tone],
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
