'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

import { Button } from '@/components/ui';

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
    <Button variant="secondary" onClick={handleCopy} aria-live="polite">
      {copied ? (
        <>
          <Check className="h-4 w-4 text-success-fg" aria-hidden="true" />
          <span className="text-success-fg">已複製連結</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}
