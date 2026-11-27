import type { ComponentProps } from 'react';
import { cn } from './cn';

/**
 * Flat surface with a hairline border. Do not nest Cards: inside a card,
 * separate groups with spacing or a divider instead.
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
        'rounded-xl border border-line bg-surface',
        padded && 'p-5 sm:p-6',
        interactive && 'transition-shadow hover:border-border-strong hover:shadow-sm',
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
          <h2 className="text-lg font-semibold text-fg">{title}</h2>
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
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="text-sm font-medium text-fg-muted">{eyebrow}</div>}
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-base text-fg-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}
