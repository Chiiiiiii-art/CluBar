import type { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from './cn';

/** Empty / zero-result state: say what is missing and offer the next step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-border-strong px-6 py-12 text-center',
        className
      )}
    >
      {icon ? (
        <div className="mb-3 text-fg-faint [&_svg]:h-8 [&_svg]:w-8">{icon}</div>
      ) : (
        <EmptyCupIllustration className="mb-4 h-20 w-20 text-fg-muted" />
      )}
      <p className="font-display text-lg font-bold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Brand line-art for empty states: an empty coffee mug on the bar counter, in the
 * logo's thick rounded stroke (docs/design/01-brand.md — no drink imagery beyond cups).
 */
export function EmptyCupIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="42" cy="30" rx="20" ry="6" />
        <path d="M22 30v30c0 9 9 15 20 15s20-6 20-15V30" />
        <path d="M62 40h5a9 9 0 0 1 0 18h-5" />
        <path d="M12 84h72" />
      </g>
      <path d="M32 58q10 6 20 0" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeDasharray="1 6" />
    </svg>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-surface-sunken', className)} style={style} />;
}

/** Inline banner for errors, warnings and notices. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles = {
    info: 'border-notice-info-border bg-brand-soft text-notice-info-fg',
    warning: 'border-notice-warning-border bg-warning-soft text-warning-fg',
    danger: 'border-notice-danger-border bg-danger-soft text-notice-danger-fg',
    success: 'border-notice-success-border bg-success-soft text-notice-success-fg',
  }[tone];
  const Icon = tone === 'info' || tone === 'success' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', styles, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
