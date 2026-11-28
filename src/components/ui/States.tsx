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
        'flex flex-col items-center rounded-2xl border-2 border-dashed border-border-ink bg-surface/85 px-6 py-12 text-center',
        className
      )}
    >
      {icon ? (
        <div className="mb-3 text-fg-muted [&_svg]:h-8 [&_svg]:w-8">{icon}</div>
      ) : (
        <EmptyStickerIllustration className="mb-4 h-20 w-24" />
      )}
      <p className="font-display text-lg font-black text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}

/**
 * Non-circular die-cut sticker pad + folded corner & star mark for empty states.
 */
export function EmptyStickerIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 92 84" fill="none" aria-hidden="true" className={className}>
      <path
        d="M14 14h46l14 14v42H14V14z"
        className="fill-surface stroke-border-ink"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="M60 14v14h14"
        className="fill-spark stroke-border-ink"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="M24 34h32M24 46h22"
        className="stroke-fg-muted"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeDasharray="5 5"
      />
      <path
        d="M68 42l4 7.5 8.2 1.2-6 5.8 1.4 8.2L68 60.8l-7.4 3.9 1.4-8.2-6-5.8 8.2-1.2z"
        className="fill-brand stroke-border-ink"
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** @deprecated Alias kept for external imports; renders EmptyStickerIllustration. */
export const EmptyCupIllustration = EmptyStickerIllustration;

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl border border-line bg-surface-sunken', className)}
      style={style}
    />
  );
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
      className={cn(
        'tactile-shadow-sm flex items-start gap-3 rounded-xl border-2 px-4 py-3 text-sm',
        styles,
        className
      )}
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
