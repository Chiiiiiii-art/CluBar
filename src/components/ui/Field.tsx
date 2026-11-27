'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from './cn';

export const controlClasses =
  'w-full rounded-lg border border-line-input bg-white px-3 text-base text-ink-900 placeholder:text-ink-500 transition-colors focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/20 disabled:bg-ink-100 disabled:text-ink-500 aria-[invalid=true]:border-danger-600';

/**
 * Label + control + hint/error wired with aria-describedby. Render the
 * control through the children function so ids stay in sync.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">
        {label}
        {required && (
          <span className="ml-0.5 text-danger-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(controlClasses, 'min-h-11', className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<'select'>) {
  return <select className={cn(controlClasses, 'min-h-11 pr-8', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(controlClasses, 'min-h-24 py-2.5 leading-relaxed', className)} {...rest} />;
}
