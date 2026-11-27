/**
 * Seed data and some fallbacks point at decorative SVGs under /images/demo/.
 * The UI treats those as "no image" and renders a text-first or monogram
 * layout instead of showing fake art as if it were content.
 */
export function isPlaceholderMedia(url: string | null | undefined): boolean {
  return !url || url.startsWith('/images/demo/');
}

export function realMediaUrl(url: string | null | undefined): string | null {
  return isPlaceholderMedia(url) ? null : (url as string);
}
