'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';

/**
 * Modal built on native <dialog>.showModal(): the browser provides the focus
 * trap, Esc to close, inert background and focus return.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-white p-0 text-ink-900 shadow-xl',
        className
      )}
    >
      {open && (
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description && <p className="text-sm text-ink-600">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉"
              className="-mt-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Provides `useConfirm()`, the in-app replacement for window.confirm. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    []
  );

  const settle = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => settle(false)}
        title={state?.title ?? ''}
        description={state?.description}
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>
              {state?.cancelLabel ?? '取消'}
            </Button>
            <Button variant={state?.tone === 'primary' ? 'primary' : 'danger'} onClick={() => settle(true)} autoFocus>
              {state?.confirmLabel ?? '確定'}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
