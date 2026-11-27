'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}

/**
 * WAI-ARIA tabs (automatic activation). `variant="segmented"` is a pill
 * switcher for 2–3 peer views; `"underline"` suits longer tab sets.
 * Pair each panel with `tabPanelProps(idPrefix, id)`.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  variant = 'segmented',
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  idPrefix: string;
  variant?: 'segmented' | 'underline';
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const hasSelection = items.some((t) => t.id === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = items.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        variant === 'segmented'
          ? 'inline-flex rounded-xl bg-surface-sunken p-1'
          : 'no-scrollbar flex gap-1 overflow-x-auto border-b border-line',
        className
      )}
    >
      {items.map((t, i) => {
        const selected = t.id === value;
        // Roving tabindex: keep one tab reachable by keyboard even when the
        // set is collapsed and no tab is selected (e.g. an optional panel).
        const focusable = selected || (!hasSelection && i === 0);
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={focusable ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors',
              variant === 'segmented'
                ? cn(
                    'rounded-lg px-4',
                    selected ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
                  )
                : cn(
                    '-mb-px border-b-2 px-3',
                    selected
                      ? 'border-fg text-fg'
                      : 'border-transparent text-fg-muted hover:text-fg'
                  )
            )}
          >
            {t.icon}
            {t.label}
            {t.badge}
          </button>
        );
      })}
    </div>
  );
}

export function tabPanelProps(idPrefix: string, id: string) {
  return {
    role: 'tabpanel' as const,
    id: `${idPrefix}-panel-${id}`,
    'aria-labelledby': `${idPrefix}-tab-${id}`,
  };
}
