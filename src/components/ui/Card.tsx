import type { ComponentProps } from 'react';
import { cn } from './cn';

/**
 * Tactile card with 2px ink frame and crisp hard shadow. Do not nest Cards:
 * inside a card, separate groups with spacing or a divider instead.
 */
export function Card({
  interactive = false,
  padded = true,
  className,
  ...rest
}: ComponentProps<'div'> & { interactive?: boolean; padded?: boolean }) {
  return (
    <div
      className={cn(
        'tactile-card rounded-2xl bg-surface',
        padded && 'p-5 sm:p-6',
        interactive && 'tactile-card-interactive',
        className
      )}
      {...rest}
    />
  );
}

/** Page-level section with a heading row and optional action. */
export function Section({
  title,
  description,
  action,
  className,
  children,
  ...rest
}: Omit<ComponentProps<'section'>, 'title'> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn('space-y-4', className)} {...rest}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && (
          <div className="inline-flex items-center rounded-md border-2 border-border-ink bg-spark px-2.5 py-0.5 text-xs font-bold text-fg">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl font-black text-fg sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-base text-fg-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}
