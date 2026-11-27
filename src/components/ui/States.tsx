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
      {icon && <div className="mb-3 text-fg-faint [&_svg]:h-8 [&_svg]:w-8">{icon}</div>}
      <p className="text-base font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
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
