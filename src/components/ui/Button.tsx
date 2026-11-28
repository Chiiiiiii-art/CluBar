import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'border-2 border-border-ink bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-active tactile-press',
  secondary: 'border-2 border-border-ink bg-surface text-fg hover:bg-surface-subtle tactile-press',
  ghost: 'text-fg-secondary hover:bg-surface-sunken',
  soft: 'border-2 border-border-ink bg-spark text-spark-fg hover:bg-brand-soft tactile-press',
  danger: 'border-2 border-border-ink bg-danger text-on-brand hover:bg-danger-hover tactile-press',
};

// sm keeps a 44px hit area through padding on a 36px visual box.
const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5 relative after:absolute after:-inset-1 after:content-[""]',
  md: 'min-h-11 px-4 text-sm gap-2',
  lg: 'min-h-13 px-5 text-base gap-2',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-xl font-display font-bold',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
    className
  );
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant,
  size,
  block,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
};

export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

type IconButtonProps = Omit<ComponentProps<'button'>, 'aria-label'> & {
  'aria-label': string;
  variant?: Extract<ButtonVariant, 'ghost' | 'secondary'>;
};

/** Square 44px icon-only button; aria-label is required by type. */
export function IconButton({ variant = 'ghost', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
        VARIANT[variant],
        className
      )}
      {...rest}
    />
  );
}
