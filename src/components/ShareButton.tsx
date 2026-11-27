'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

import { buttonClasses } from '@/components/ui';
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
      className={buttonClasses({ variant: 'secondary', size: 'md' })}
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
