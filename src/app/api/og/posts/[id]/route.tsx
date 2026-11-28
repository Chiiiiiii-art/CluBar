import { ImageResponse } from 'next/og';
import { and, eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { clubs, posts, universities } from '@/db/schema';
import { POST_KIND_LABELS } from '@/lib/constants';
import { loadTraditionalChineseFont } from '@/lib/og/font';
import {
  BRAND,
  ClubPill,
  CoverFrame,
  INK,
  SPARK,
  Wordmark,
  clip,
  dotPaper,
  loadCover,
  type Cover,
} from '@/lib/og/card-parts';

export const runtime = 'nodejs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PostCardData {
  headline: string;
  kindLabel: string;
  clubName: string;
  uniName: string;
  accent: string;
  cover: Cover | null;
}

async function loadData(id: string, origin: string): Promise<PostCardData> {
  const fallback: PostCardData = {
    headline: '來看看這個社團在做什麼',
    kindLabel: '社團日常',
    clubName: '社團聚',
    uniName: '',
    accent: BRAND,
    cover: null,
  };
  if (!isDatabaseConfigured() || !UUID.test(id)) return fallback;
  try {
    const [row] = await db
      .select({
        headline: posts.headline,
        postKind: posts.postKind,
        mediaItems: posts.mediaItems,
        clubName: clubs.name,
        uniShortName: universities.shortName,
      })
      .from(posts)
      .innerJoin(clubs, eq(posts.clubId, clubs.id))
      .innerJoin(universities, eq(clubs.universityId, universities.id))
      // Only published posts get a card; drafts fall back to the generic one.
      .where(and(eq(posts.id, id), eq(posts.status, 'published')))
      .limit(1);
    if (!row) return fallback;
    const first = row.mediaItems.find((m) => m.kind !== 'video' || m.poster_url);
    const coverUrl = first ? (first.kind === 'video' ? first.poster_url : first.url) : undefined;
    return {
      headline: row.headline,
      kindLabel: POST_KIND_LABELS[row.postKind]?.label ?? '社團日常',
      clubName: row.clubName,
      uniName: row.uniShortName,
      accent: BRAND,
      cover: await loadCover(coverUrl, origin),
    };
  } catch {
    return fallback;
  }
}

/** 1200×630 link preview for a club post: the work itself, never cropped, with the club as the byline. */
function PostLinkCard({ d }: { d: PostCardData }) {
  const title = (
    <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: d.headline.length > 18 ? 44 : 54, lineHeight: 1.25, color: INK }}>
      {clip(d.headline, d.cover ? 34 : 48)}
    </div>
  );
  const kind = (
    <div
      style={{
        display: 'flex',
        alignSelf: 'flex-start',
        padding: '6px 18px',
        backgroundColor: SPARK,
        border: `3px solid ${INK}`,
        borderRadius: 999,
        boxShadow: `4px 4px 0 ${INK}`,
        fontSize: 24,
        color: INK,
        transform: 'rotate(-2deg)',
      }}
    >
      {d.kindLabel}
    </div>
  );
  const cta = <div style={{ display: 'flex', fontSize: 24, color: BRAND }}>點開看作品・認識這個社團 →</div>;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', padding: 44, gap: 44, alignItems: 'center', ...dotPaper }}>
      {d.cover ? (
        <div style={{ display: 'flex', width: 520, height: 542, alignItems: 'center', justifyContent: 'center' }}>
          <CoverFrame cover={d.cover} maxW={520} maxH={530} />
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          // Fixed width so Satori wraps long headlines instead of running off the card.
          width: d.cover ? 548 : 1112,
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ClubPill d={d} size={24} />
          <Wordmark size={18} />
        </div>
        {kind}
        {title}
        {cta}
      </div>
    </div>
  );
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') || url.origin;
  const [d, fontData] = await Promise.all([loadData(id, origin), loadTraditionalChineseFont()]);

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
        <PostLinkCard d={d} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
      ...(fontData ? { fonts: [{ name: 'NotoSansTC', data: fontData, weight: 700, style: 'normal' as const }] } : {}),
    }
  );
}
