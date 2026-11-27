import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  accent: 'bg-accent-50 text-accent-700',
  success: 'bg-success-50 text-success-800',
  warning: 'bg-warning-50 text-warning-900',
  danger: 'bg-danger-50 text-danger-700',
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
