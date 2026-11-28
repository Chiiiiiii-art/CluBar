import { isAllowedMediaUrl } from '@/lib/validators';

/** Shared pieces of the share/link-preview cards (events and posts). Inline styles only: Satori. */

// Brand palette (docs/design/02-tokens.md) as hex: Satori cannot read CSS variables.
export const INK = '#0e141e';
export const INK_MUTED = '#454c57';
export const PAPER = '#f9f6f0';
export const WHITE = '#ffffff';
export const SPARK = '#fce575';
export const COBALT = '#155cbb';
export const BRAND = '#ce1a1f';

export interface Cover {
  src: string;
  width: number;
  height: number;
}

export function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Fit (w, h) inside (maxW, maxH) keeping the original ratio: posters are never cropped. */
export function contain(w: number, h: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/** Load the event cover as PNG (Satori cannot decode WebP). Only allowed media hosts are fetched. */
export async function loadCover(coverUrl: string | undefined, origin: string): Promise<Cover | null> {
  if (!coverUrl || !isAllowedMediaUrl(coverUrl)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(new URL(coverUrl, origin), { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 12 * 1024 * 1024) return null;
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(buf)
      .rotate()
      .resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { src: `data:image/png;base64,${data.toString('base64')}`, width: info.width, height: info.height };
  } catch {
    return null;
  }
}

export const dotPaper = {
  backgroundColor: PAPER,
  backgroundImage: 'radial-gradient(circle, rgba(14,20,30,0.13) 2px, transparent 2.5px)',
  backgroundSize: '30px 30px',
};

export function ClubPill({ d, size }: { d: ClubPillData; size: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.4, maxWidth: size * 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size * 1.9,
          height: size * 1.9,
          borderRadius: 999,
          backgroundColor: d.accent,
          border: `3px solid ${INK}`,
          color: WHITE,
          fontSize: size * 0.95,
        }}
      >
        {d.clubName.slice(0, 1)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: size, color: INK }}>{clip(d.clubName, 14)}</div>
        {d.uniName ? <div style={{ display: 'flex', fontSize: size * 0.75, color: INK_MUTED }}>{d.uniName}</div> : null}
      </div>
    </div>
  );
}

export function Wordmark({ size }: { size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        padding: `${size * 0.3}px ${size * 0.7}px`,
        backgroundColor: INK,
        color: SPARK,
        borderRadius: size * 0.5,
        fontSize: size,
        transform: 'rotate(2deg)',
      }}
    >
      社團聚 CluBar
    </div>
  );
}

export function CoverFrame({ cover, maxW, maxH }: { cover: Cover; maxW: number; maxH: number }) {
  const pad = 14;
  const { width, height } = contain(cover.width, cover.height, maxW - pad * 2, maxH - pad * 2);
  return (
    <div
      style={{
        display: 'flex',
        padding: pad,
        backgroundColor: WHITE,
        border: `3px solid ${INK}`,
        borderRadius: 22,
        boxShadow: `10px 10px 0 ${INK}`,
        transform: 'rotate(-1.5deg)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover.src} width={width} height={height} style={{ borderRadius: 10 }} alt="" />
    </div>
  );
}


export interface ClubPillData {
  clubName: string;
  uniName: string;
  accent: string;
}

