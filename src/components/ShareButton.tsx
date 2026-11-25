'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

export function ShareButton({ label = '分享連結' }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-orange-50"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <span className="text-emerald-700">已複製連結</span>
        </>
      ) : (
        <>
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
