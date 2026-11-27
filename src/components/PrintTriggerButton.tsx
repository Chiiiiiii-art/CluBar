'use client';

import { Printer } from 'lucide-react';

export function PrintTriggerButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-ink-800"
    >
      <Printer className="h-3.5 w-3.5" aria-hidden="true" />
      列印或另存 PDF
    </button>
  );
}
