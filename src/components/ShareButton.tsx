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
      className="inline-flex items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-accent-50"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-success-700" aria-hidden="true" />
          <span className="text-success-700">已複製連結</span>
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
