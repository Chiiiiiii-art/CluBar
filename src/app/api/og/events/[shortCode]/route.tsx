import { ImageResponse } from 'next/og';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db, isDatabaseConfigured } from '@/db';
import { clubEvents, clubs, universities } from '@/db/schema';
import { EVENT_THEME_PRESETS, LEARNING_HOURS_LABELS } from '@/lib/constants';
import { loadTraditionalChineseFont } from '@/lib/og/font';
import { isAllowedMediaUrl } from '@/lib/validators';

export const runtime = 'nodejs';

// Brand palette (docs/design/02-tokens.md) as hex: Satori cannot read CSS variables.
const INK = '#0e141e';
const INK_MUTED = '#454c57';
const PAPER = '#f9f6f0';
const WHITE = '#ffffff';
const SPARK = '#fce575';
const COBALT = '#155cbb';
const BRAND = '#ce1a1f';

type Format = 'link' | 'story' | 'feed';

interface Cover {
  src: string;
  width: number;
  height: number;
}

interface CardData {
  title: string;
  clubName: string;
  uniName: string;
  dateBig: string; // 11/29
  weekday: string; // 週六
  timeLine: string; // 19:00 開始 / 時段投票中
  locationText: string | null;
  tags: string[];
  accent: string;
  cover: Cover | null;
  shortUrl: string; // clubar.app/e/abc
  fullUrl: string;
}

const TAIPEI_PARTS = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function dateParts(d: Date) {
  const p = Object.fromEntries(TAIPEI_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    dateBig: `${p.month}/${p.day}`,
    weekday: p.weekday ?? '',
    time: `${p.hour}:${p.minute}`,
  };
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Fit (w, h) inside (maxW, maxH) keeping the original ratio: posters are never cropped. */
function contain(w: number, h: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / w, maxH / h);
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/** Load the event cover as PNG (Satori cannot decode WebP). Only allowed media hosts are fetched. */
async function loadCover(coverUrl: string | undefined, origin: string): Promise<Cover | null> {
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

async function loadData(shortCode: string, origin: string): Promise<CardData> {
  const host = new URL(origin).host;
  const fallback: CardData = {
    title: 'CluBar 校園社團活動',
    clubName: '社團聚',
    uniName: '',
    dateBig: '即將公布',
    weekday: '',
    timeLine: '時間即將公布',
    locationText: null,
    tags: ['零基礎可', '非社員可'],
    accent: BRAND,
    cover: null,
    shortUrl: `${host}/e/${shortCode}`,
    fullUrl: `${origin}/e/${shortCode}`,
  };
  if (!isDatabaseConfigured()) return fallback;

  try {
    const [row] = await db
      .select({
        title: clubEvents.title,
        startsAt: clubEvents.startsAt,
        scheduleMode: clubEvents.scheduleMode,
        locationText: clubEvents.locationText,
        shareHideLocation: clubEvents.shareHideLocation,
        themePreset: clubEvents.themePreset,
        beginnerFriendly: clubEvents.beginnerFriendly,
        nonMembersWelcome: clubEvents.nonMembersWelcome,
        feeNtd: clubEvents.feeNtd,
        learningHoursCategory: clubEvents.learningHoursCategory,
        learningHoursCount: clubEvents.learningHoursCount,
        coverMedia: clubEvents.coverMedia,
        clubName: clubs.name,
        uniShortName: universities.shortName,
      })
      .from(clubEvents)
      .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      .where(eq(clubEvents.shortCode, shortCode))
      .limit(1);
    if (!row) return fallback;

    let dateBig = '待定';
    let weekday = '';
    let timeLine = '時間待定';
    if (row.startsAt) {
      const p = dateParts(row.startsAt);
      dateBig = p.dateBig;
      weekday = p.weekday;
      timeLine = `${p.time} 開始`;
    } else if (row.scheduleMode === 'voting') {
      dateBig = '投票中';
      timeLine = '一起投票喬時間';
    }

    const tags: string[] = [];
    if (row.beginnerFriendly) tags.push('零基礎可');
    if (row.nonMembersWelcome) tags.push('非社員可');
    tags.push(row.feeNtd > 0 ? `NT$ ${row.feeNtd}` : '免費');
    if (row.learningHoursCategory !== 'none' && Number(row.learningHoursCount || 0) > 0) {
      tags.push(`${LEARNING_HOURS_LABELS[row.learningHoursCategory]} ${Number(row.learningHoursCount)}h`);
    }

    const theme = EVENT_THEME_PRESETS[row.themePreset] ?? EVENT_THEME_PRESETS.warm_paper!;

    return {
      ...fallback,
      title: row.title,
      clubName: row.clubName,
      uniName: row.uniShortName,
      dateBig,
      weekday,
      timeLine,
      locationText: row.shareHideLocation ? null : row.locationText,
      tags: tags.slice(0, 3),
      accent: theme.accentHex,
      cover: await loadCover(row.coverMedia?.url, origin),
    };
  } catch {
    return fallback;
  }
}

// ── Building blocks (inline styles only; Satori needs display:flex on every container) ──

const dotPaper = {
  backgroundColor: PAPER,
  backgroundImage: 'radial-gradient(circle, rgba(14,20,30,0.13) 2px, transparent 2.5px)',
  backgroundSize: '30px 30px',
};

function ClubPill({ d, size }: { d: CardData; size: number }) {
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

function Wordmark({ size }: { size: number }) {
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

function CoverFrame({ cover, maxW, maxH }: { cover: Cover; maxW: number; maxH: number }) {
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

/** Ticket stub: accent date block + time/location, with notch circles on the seam. */
function Ticket({ d, scale }: { d: CardData; scale: number }) {
  const s = (n: number) => Math.round(n * scale);
  return (
    <div
      style={{
        display: 'flex',
        backgroundColor: WHITE,
        border: `3px solid ${INK}`,
        borderRadius: s(20),
        boxShadow: `${s(7)}px ${s(7)}px 0 ${INK}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${s(14)}px ${s(24)}px`,
          backgroundColor: d.accent,
          color: WHITE,
          borderRight: `3px dashed ${INK}`,
          minWidth: s(170),
        }}
      >
        <div style={{ display: 'flex', fontSize: s(d.dateBig.length > 5 ? 34 : 52), lineHeight: 1.05 }}>{d.dateBig}</div>
        {d.weekday ? <div style={{ display: 'flex', fontSize: s(24) }}>{d.weekday}</div> : null}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: s(6),
          padding: `${s(14)}px ${s(26)}px`,
          flexGrow: 1,
        }}
      >
        <div style={{ display: 'flex', fontSize: s(32), color: INK }}>{d.timeLine}</div>
        <div style={{ display: 'flex', fontSize: s(24), color: INK_MUTED }}>
          {d.locationText ? clip(d.locationText, 22) : '報名後看地點'}
        </div>
      </div>
    </div>
  );
}

const TAG_STYLES = [
  { backgroundColor: SPARK, color: INK, rotate: '-3deg' },
  { backgroundColor: COBALT, color: WHITE, rotate: '2deg' },
  { backgroundColor: WHITE, color: INK, rotate: '-1deg' },
];

function Tags({ tags, size }: { tags: string[]; size: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: size * 0.55 }}>
      {tags.map((t, i) => {
        const st = TAG_STYLES[i % TAG_STYLES.length]!;
        return (
          <div
            key={t}
            style={{
              display: 'flex',
              padding: `${size * 0.3}px ${size * 0.75}px`,
              borderRadius: i === 1 ? size * 0.4 : 999,
              border: `3px solid ${INK}`,
              boxShadow: `4px 4px 0 ${INK}`,
              backgroundColor: st.backgroundColor,
              color: st.color,
              fontSize: size,
              transform: `rotate(${st.rotate})`,
            }}
          >
            {t}
          </div>
        );
      })}
    </div>
  );
}

/** Big date sticker used when the event has no cover image. */
function DateSticker({ d, w, h }: { d: CardData; w: number; h: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: w,
        height: h,
        backgroundColor: SPARK,
        border: `3px solid ${INK}`,
        borderRadius: 28,
        boxShadow: `10px 10px 0 ${INK}`,
        transform: 'rotate(-2deg)',
        color: INK,
      }}
    >
      <div style={{ display: 'flex', fontSize: Math.round(h * 0.26), lineHeight: 1 }}>{d.dateBig}</div>
      {d.weekday ? <div style={{ display: 'flex', fontSize: Math.round(h * 0.1) }}>{d.weekday}</div> : null}
      <div
        style={{
          display: 'flex',
          marginTop: Math.round(h * 0.05),
          padding: '8px 22px',
          backgroundColor: d.accent,
          color: WHITE,
          borderRadius: 999,
          border: `3px solid ${INK}`,
          fontSize: Math.round(h * 0.07),
        }}
      >
        {d.timeLine}
      </div>
    </div>
  );
}

function QrBlock({ d, qr, size }: { d: CardData; qr: string; size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: 22,
        backgroundColor: WHITE,
        border: `3px solid ${INK}`,
        borderRadius: 24,
        boxShadow: `8px 8px 0 ${INK}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} width={size} height={size} alt="" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 1 }}>
        <div style={{ display: 'flex', fontSize: 36, color: INK }}>掃描看活動、報名</div>
        <div style={{ display: 'flex', fontSize: 24, color: INK_MUTED }}>不用下載 App，手機就能留位子</div>
        <div
          style={{
            display: 'flex',
            marginTop: 6,
            padding: '6px 16px',
            backgroundColor: SPARK,
            border: `3px solid ${INK}`,
            borderRadius: 12,
            fontSize: 24,
            color: INK,
          }}
        >
          {d.shortUrl}
        </div>
      </div>
    </div>
  );
}

// ── Layouts ──

function LinkCard({ d }: { d: CardData }) {
  // 1200×630 chat/link preview: the image people tap in LINE, Messenger, Discord.
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', padding: 44, gap: 44, alignItems: 'center', ...dotPaper }}>
      <div style={{ display: 'flex', width: 420, height: 542, alignItems: 'center', justifyContent: 'center' }}>
        {d.cover ? <CoverFrame cover={d.cover} maxW={420} maxH={530} /> : <DateSticker d={d} w={380} h={400} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 648, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ClubPill d={d} size={24} />
          <Wordmark size={18} />
        </div>
        <div style={{ display: 'flex', fontSize: d.title.length > 18 ? 42 : 52, lineHeight: 1.25, color: INK }}>
          {clip(d.title, 34)}
        </div>
        {d.cover ? <Ticket d={d} scale={0.92} /> : null}
        <Tags tags={d.tags} size={24} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, color: BRAND }}>
          點開看活動・手機就能報名 →
        </div>
      </div>
    </div>
  );
}

function TallCard({ d, qr, format }: { d: CardData; qr: string; format: 'story' | 'feed' }) {
  const story = format === 'story';
  const pad = story ? 72 : 60;
  const coverMaxH = story ? 820 : 460;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: pad, gap: story ? 48 : 30, ...dotPaper }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ClubPill d={d} size={story ? 34 : 30} />
        <Wordmark size={story ? 26 : 22} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', height: coverMaxH, flexShrink: 1, minHeight: 0, alignItems: 'center' }}>
        {d.cover ? (
          <CoverFrame cover={d.cover} maxW={1080 - pad * 2} maxH={coverMaxH} />
        ) : (
          <DateSticker d={d} w={story ? 760 : 640} h={story ? 560 : 400} />
        )}
      </div>
      <div style={{ display: 'flex', flexShrink: 0, fontSize: story ? (d.title.length > 20 ? 64 : 76) : d.title.length > 16 ? 46 : 54, lineHeight: 1.22, color: INK }}>
        {clip(d.title, story ? 44 : 36)}
      </div>
      {d.cover ? <Ticket d={d} scale={story ? 1.25 : 1.05} /> : null}
      <Tags tags={d.tags} size={story ? 34 : 28} />
      <div style={{ display: 'flex', flexGrow: 1 }} />
      <QrBlock d={d} qr={qr} size={story ? 220 : 170} />
    </div>
  );
}

export async function GET(req: Request, context: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await context.params;
  const url = new URL(req.url);
  const f = url.searchParams.get('format');
  const format: Format = f === 'story' || f === 'feed' ? f : 'link';
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || url.origin;

  const [d, fontData] = await Promise.all([loadData(shortCode, origin), loadTraditionalChineseFont()]);
  const qr =
    format === 'link'
      ? ''
      : await QRCode.toDataURL(d.fullUrl, { margin: 1, width: 440, color: { dark: INK, light: WHITE } });

  const width = format === 'link' ? 1200 : 1080;
  const height = format === 'story' ? 1920 : format === 'feed' ? 1350 : 630;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          fontFamily: fontData ? 'NotoSansTC, sans-serif' : 'sans-serif',
        }}
      >
        {format === 'link' ? <LinkCard d={d} /> : <TallCard d={d} qr={qr} format={format} />}
      </div>
    ),
    {
      width,
      height,
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
      ...(fontData ? { fonts: [{ name: 'NotoSansTC', data: fontData, weight: 700, style: 'normal' as const }] } : {}),
    }
  );
}
