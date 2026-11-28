import { ImageResponse } from 'next/og';
import { RecipeFood } from '@/components/RecipeFood';
import { cardTitle, parseFood, parseMaker, parsePalette, parseRecipe, partColor } from '@/lib/recipe';
import { loadTraditionalChineseFont } from '@/lib/og/font';
import { BRAND, INK, SPARK, WHITE, Wordmark, clip, dotPaper } from '@/lib/og/card-parts';

export const runtime = 'nodejs';

/** 1200×630 quiz-result card: the maker's food on the left, its recipe in 份 on the right. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const parts = parseRecipe(url.searchParams.get('r'));
  const food = parseFood(url.searchParams.get('f'));
  const palette = parsePalette(url.searchParams.get('p'));
  const maker = parseMaker(url.searchParams.get('n'));
  const title = cardTitle(maker, food);
  const fontData = await loadTraditionalChineseFont();
  const shown = parts.slice(0, 6);
  const rest = parts.length - shown.length;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: 48,
          gap: 56,
          alignItems: 'center',
          fontFamily: fontData ? 'NotoSansTC, sans-serif' : 'sans-serif',
          ...dotPaper,
        }}
      >
        <div style={{ display: 'flex', width: 460, justifyContent: 'center' }}>
          {parts.length > 0 ? (
            <RecipeFood
              food={food}
              parts={parts.map((p, i) => ({ color: partColor(palette, i), count: p.count }))}
              palette={{ ink: INK, paper: WHITE, accent: BRAND, spark: SPARK }}
              width={food === 'pizza' ? 460 : 400}
              label={title}
            />
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 588, height: '100%', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Wordmark size={20} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', fontSize: title.length > 12 ? 44 : 56, color: INK }}>
              {clip(title, 22)}
            </div>
            {shown.map((p, i) => (
              <div key={p.slug} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, color: INK }}>
                <div
                  style={{
                    display: 'flex',
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    border: `3px solid ${INK}`,
                    backgroundColor: partColor(palette, i),
                  }}
                />
                <div style={{ display: 'flex', flex: 1 }}>{p.name}</div>
                <div style={{ display: 'flex' }}>{p.count} 份</div>
              </div>
            ))}
            {rest > 0 ? <div style={{ display: 'flex', fontSize: 24, color: INK }}>還有 {rest} 種配料</div> : null}
          </div>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '10px 24px',
              backgroundColor: BRAND,
              color: WHITE,
              border: `3px solid ${INK}`,
              borderRadius: 16,
              boxShadow: `5px 5px 0 ${INK}`,
              fontSize: 30,
            }}
          >
            我也來調一份 →
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
