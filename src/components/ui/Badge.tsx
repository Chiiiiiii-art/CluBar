import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-fg-secondary',
  accent: 'bg-brand-soft text-brand-soft-fg',
  success: 'bg-success-soft text-success-fg',
  warning: 'bg-warning-soft text-warning-fg',
  danger: 'bg-danger-soft text-danger-fg',
};

/**
 * Small status label. Keep it to two per card: more than that stops reading
 * as a signal and turns into noise.
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
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium leading-5',
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
