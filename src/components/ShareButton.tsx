'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ImageDown, Share2 } from 'lucide-react';

import { Button, IconButton, type ButtonSize, type ButtonVariant } from '@/components/ui';
import { preloadShareImage, shareImage, shareInvite, trackShareEvent, type ShareOutcome } from '@/lib/share';

const STATUS_TEXT: Partial<Record<ShareOutcome, string>> = {
  shared: '已開啟分享',
  copied: '已複製連結',
  downloaded: '已存下限動圖',
  failed: '沒辦法分享，請直接複製網址列的連結',
};

type ShareButtonProps = {
  label?: string;
  /** Defaults to the current page URL. Relative paths resolve against the current origin. */
  url?: string;
  title?: string;
  text?: string;
  imageUrl?: string;
  fileName?: string;
  clubId?: string | null;
  /** When set, a successful share is tracked as `event_share`. */
  targetId?: string | null;
  surface?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
  /**
   * 'link' (default) shares the URL only, so chat apps unfurl it into a tappable invite card.
   * 'image' shares/downloads imageUrl alone (IG story card with QR code).
   */
  mode?: 'link' | 'image';
  /** Load the share image on mount (prominent buttons); others load it on hover/focus/touch. */
  preload?: boolean;
};

export function ShareButton({
  label = '分享連結',
  url,
  title,
  text = '',
  imageUrl,
  fileName,
  clubId,
  targetId,
  surface = 'share_button',
  variant = 'secondary',
  size,
  iconOnly = false,
  preload = false,
  mode = 'link',
  className,
}: ShareButtonProps) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warm = () => {
    if (imageUrl) preloadShareImage(imageUrl, fileName);
  };
  useEffect(() => {
    if (preload) warm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preload, imageUrl]);

  const handleShare = async () => {
    const result =
      mode === 'image' && imageUrl
        ? await shareImage({ imageUrl, fileName: fileName ?? 'clubar-invite.png', title: title ?? document.title })
        : await shareInvite({
            title: title ?? document.title,
            text,
            url: new URL(url ?? window.location.href, window.location.href).href,
          });
    if (targetId && (result === 'shared' || result === 'copied' || result === 'downloaded')) {
      trackShareEvent({ type: 'event_share', clubId, targetId, surface });
    }
    setOutcome(result === 'cancelled' ? null : result);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOutcome(null), 2500);
  };

  const done = outcome === 'shared' || outcome === 'copied' || outcome === 'downloaded';
  const status = outcome ? STATUS_TEXT[outcome] : undefined;
  const icon = done ? (
    <Check className="h-4 w-4 text-success-fg" aria-hidden="true" />
  ) : mode === 'image' ? (
    <ImageDown className="h-4 w-4" aria-hidden="true" />
  ) : (
    <Share2 className="h-4 w-4" aria-hidden="true" />
  );

  return (
    <>
      {iconOnly ? (
        <IconButton
          aria-label={label}
          title={label}
          variant={variant === 'ghost' ? 'ghost' : 'secondary'}
          onClick={handleShare}
          onPointerEnter={warm}
          onFocus={warm}
          onTouchStart={warm}
          className={className}
        >
          {icon}
        </IconButton>
      ) : (
        <Button
          variant={variant}
          size={size}
          onClick={handleShare}
          onPointerEnter={warm}
          onFocus={warm}
          onTouchStart={warm}
          className={className}
        >
          {icon}
          <span className={done ? 'text-success-fg' : undefined}>{status ?? label}</span>
        </Button>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {status ?? ''}
      </span>
    </>
  );
}
