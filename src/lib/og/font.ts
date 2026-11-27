let cachedNotoFont: ArrayBuffer | null | undefined;

/**
 * Loads Noto Sans TC TTF once with a short timeout and safe offline fallback
 * so `next/og` never throws HTTP 500 when offline.
 */
export async function loadTraditionalChineseFont(): Promise<ArrayBuffer | undefined> {
  if (cachedNotoFont !== undefined) {
    return cachedNotoFont ?? undefined;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const cssRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@700&display=swap',
      {
        headers: {
          // Request TTF format required by Satori (not woff2)
          'User-Agent': 'Mozilla/5.0 (Linux; U; Android 2.2; en-us) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (!cssRes.ok) {
      cachedNotoFont = null;
      return undefined;
    }

    const css = await cssRes.text();
    const match = css.match(/src:\s*url\(([^)]+\.(?:ttf|otf))\)/i);
    if (!match?.[1]) {
      cachedNotoFont = null;
      return undefined;
    }

    const fontController = new AbortController();
    const fontTimer = setTimeout(() => fontController.abort(), 2500);
    const fontRes = await fetch(match[1], { signal: fontController.signal });
    clearTimeout(fontTimer);

    if (!fontRes.ok) {
      cachedNotoFont = null;
      return undefined;
    }

    cachedNotoFont = await fontRes.arrayBuffer();
    return cachedNotoFont;
  } catch {
    cachedNotoFont = null;
    return undefined;
  }
}
