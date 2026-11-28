import { ImageResponse } from 'next/og';
import { RecipeFood } from '@/components/RecipeFood';
import { cardTitle, encodeRecipe, parseFood, parseMaker, parsePalette, parseRecipe, partColor } from '@/lib/recipe';
import { loadTraditionalChineseFont } from '@/lib/og/font';
import { BRAND, INK, INK_MUTED, SPARK, WHITE, clip, dotPaper } from '@/lib/og/card-parts';

export const runtime = 'nodejs';

/** Stable 4-digit order number from the recipe, so the same card always prints the same No. */
function orderNo(seed: string): string {
  let h = 7;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 10000;
  return String(h).padStart(4, '0');
}

/** Four-point sparkle sticker. */
function Sparkle({ size, color, style }: { size: number; color: string; style: Record<string, string | number> }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ position: 'absolute', ...style }}>
      <path d="M20 2 L25 15 L38 20 L25 25 L20 38 L15 25 L2 20 L15 15 Z" fill={color} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 1200×630 quiz-result card: the maker's food with a "main ingredient" sticker on the left,
 * the recipe printed as a drink-order receipt on the right. Built to make a friend tap it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parts = parseRecipe(url.searchParams.get('r'));
  const food = parseFood(url.searchParams.get('f'));
  const palette = parsePalette(url.searchParams.get('p'));
  const maker = parseMaker(url.searchParams.get('n'));
  const title = cardTitle(maker, food);
  const fontData = await loadTraditionalChineseFont();
  const shown = parts.slice(0, 4);
  const rest = parts.length - shown.length;
  const total = parts.reduce((s, p) => s + p.count, 0);
  const top = parts[0];
  const dashed = `3px dashed ${INK}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          position: 'relative',
          width: '100%',
          height: '100%',
          padding: '40px 56px',
          gap: 48,
          alignItems: 'center',
          fontFamily: fontData ? 'NotoSansTC, sans-serif' : 'sans-serif',
          ...dotPaper,
        }}
      >
        <Sparkle size={54} color={SPARK} style={{ left: 40, top: 36 }} />
        <Sparkle size={34} color={BRAND} style={{ left: 470, top: 90 }} />
        <Sparkle size={40} color={SPARK} style={{ left: 420, bottom: 40 }} />

        {/* Food with its main-ingredient sticker */}
        <div style={{ display: 'flex', position: 'relative', width: 470, height: 550, alignItems: 'center', justifyContent: 'center' }}>
          {parts.length > 0 ? (
            <RecipeFood
              food={food}
              parts={parts.map((p, i) => ({ color: partColor(palette, i), count: p.count }))}
              palette={{ ink: INK, paper: WHITE, accent: BRAND, spark: SPARK }}
              width={food === 'pizza' ? 440 : 380}
              label={title}
            />
          ) : null}
          {top ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'absolute',
                right: 0,
                bottom: 30,
                padding: '10px 20px',
                backgroundColor: SPARK,
                border: `4px solid ${INK}`,
                borderRadius: 18,
                boxShadow: `5px 5px 0 ${INK}`,
                transform: 'rotate(-6deg)',
                color: INK,
              }}
            >
              <div style={{ display: 'flex', fontSize: 20 }}>主成分</div>
              <div style={{ display: 'flex', fontSize: 34 }}>{top.name}</div>
            </div>
          ) : null}
        </div>

        {/* Order receipt */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: 560,
            padding: '26px 32px',
            backgroundColor: WHITE,
            border: `4px solid ${INK}`,
            borderRadius: 20,
            boxShadow: `10px 10px 0 ${INK}`,
            transform: 'rotate(1.5deg)',
            color: INK,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: INK_MUTED }}>
            <div style={{ display: 'flex' }}>社團聚 CluBar・調配單</div>
            <div style={{ display: 'flex' }}>No. {orderNo(encodeRecipe(parts) + maker)}</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 10, fontSize: title.length > 10 ? 40 : 48 }}>
            {clip(title, 18)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, paddingTop: 14, borderTop: dashed }}>
            {shown.map((p, i) => (
              <div key={p.slug} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28 }}>
                <div
                  style={{
                    display: 'flex',
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    border: `3px solid ${INK}`,
                    backgroundColor: partColor(palette, i),
                  }}
                />
                <div style={{ display: 'flex' }}>{p.name}</div>
                <div style={{ display: 'flex', flex: 1, height: 2, marginTop: 8, borderBottom: `3px dashed ${INK_MUTED}` }} />
                <div style={{ display: 'flex' }}>{p.count} 份</div>
              </div>
            ))}
            {rest > 0 ? <div style={{ display: 'flex', fontSize: 22, color: INK_MUTED }}>＋ 還有 {rest} 種配料</div> : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: dashed, fontSize: 24 }}>
            <div style={{ display: 'flex' }}>{parts.length} 種口味</div>
            <div style={{ display: 'flex' }}>共 {total} 份</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 }}>
            <div
              style={{
                display: 'flex',
                padding: '10px 22px',
                backgroundColor: BRAND,
                color: WHITE,
                border: `3px solid ${INK}`,
                borderRadius: 14,
                boxShadow: `4px 4px 0 ${INK}`,
                fontSize: 28,
              }}
            >
              我也來調一份 →
            </div>
            <div style={{ display: 'flex', fontSize: 20, color: INK_MUTED }}>點幾下就好・不用註冊</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400, immutable' },
      ...(fontData ? { fonts: [{ name: 'NotoSansTC', data: fontData, weight: 700, style: 'normal' as const }] } : {}),
    }
  );
}
