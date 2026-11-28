// Client-side share helpers shared by the student invite button and the officer publish panel.
// See docs/one-stop-publish-solution.md §3.5 and §4.

export type ShareOutcome = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'failed';

export type AnalyticsEventType =
  | 'event_share'
  | 'event_publish_started'
  | 'event_publish_channel'
  | 'event_promo_copy';

/** LINE "share with" link: opens LINE and lets the user pick a chat or group, text prefilled. */
export function lineShareUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/** Text plus URL in one string; some share targets (and LINE) drop a separate url field. */
export function joinShareText(text: string, url: string): string {
  const t = text.trim();
  return t.includes(url) ? t : t ? `${t}\n${url}` : url;
}

// iOS Safari drops the tap's user activation across a slow await, so share() must not wait
// on a network fetch. Image files are preloaded (on hover/focus/mount) and only used if ready.
const imageCache = new Map<string, File | null>();
const pending = new Set<string>();

/** Start loading an image for a later share; safe to call repeatedly. */
export function preloadShareImage(imageUrl: string, fileName = 'clubar-invite.png'): void {
  if (typeof window === 'undefined' || imageCache.has(imageUrl) || pending.has(imageUrl)) return;
  pending.add(imageUrl);
  fetch(imageUrl)
    .then(async (res) => {
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], fileName, { type: blob.type || 'image/png' });
    })
    .catch(() => null)
    .then((file) => {
      imageCache.set(imageUrl, file);
      pending.delete(imageUrl);
    });
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Share an invite through the OS share sheet.
 * Order: preloaded image file + text (mobile, lets the user pick Instagram/LINE) → text + url → copy link.
 * Call preloadShareImage(imageUrl) beforehand, or the first tap shares text only.
 * Must be called from a click handler (Web Share needs a user gesture).
 */
export async function shareInvite(opts: {
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
  fileName?: string;
}): Promise<ShareOutcome> {
  const fullText = joinShareText(opts.text, opts.url);
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  if (nav?.share) {
    if (opts.imageUrl && nav.canShare) {
      const file = imageCache.get(opts.imageUrl);
      // Not preloaded yet: start it for next time, share text+url now without awaiting.
      if (file === undefined) preloadShareImage(opts.imageUrl, opts.fileName);
      if (file && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: opts.title, text: fullText });
          return 'shared';
        } catch (err) {
          if (isAbort(err)) return 'cancelled';
          // fall through to text-only share
        }
      }
    }
    try {
      await nav.share({ title: opts.title, text: opts.text, url: opts.url });
      return 'shared';
    } catch (err) {
      if (isAbort(err)) return 'cancelled';
    }
  }

  try {
    await nav?.clipboard.writeText(fullText);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Share only an image (IG story card). Image + text shares make chat apps drop the link, so the
 * clickable invite is shared separately via shareInvite without an image; this one is for stories,
 * where the card carries a QR code and short link. Falls back to download.
 */
export async function shareImage(opts: {
  imageUrl: string;
  fileName: string;
  title: string;
}): Promise<ShareOutcome> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const file = imageCache.get(opts.imageUrl);
  if (file === undefined) preloadShareImage(opts.imageUrl, opts.fileName);
  if (file && nav?.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: opts.title });
      return 'shared';
    } catch (err) {
      if (isAbort(err)) return 'cancelled';
    }
  }
  return downloadImage(opts.imageUrl, opts.fileName);
}

/** Save an image (e.g. generated story card) for manual posting on desktop. */
export async function downloadImage(imageUrl: string, fileName: string): Promise<ShareOutcome> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return 'failed';
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/** Fire-and-forget analytics; never blocks the UI. */
export function trackShareEvent(opts: {
  type: AnalyticsEventType;
  clubId?: string | null;
  targetId?: string | null;
  surface: string;
}): void {
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: opts.type,
      club_id: opts.clubId ?? null,
      target_id: opts.targetId ?? null,
      source_surface: opts.surface.slice(0, 40),
    }),
  }).catch(() => {});
}
