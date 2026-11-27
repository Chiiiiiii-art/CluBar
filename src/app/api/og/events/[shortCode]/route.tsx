import { ImageResponse } from 'next/og';
import { eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { clubEvents, clubs, universities } from '@/db/schema';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import { EVENT_THEME_PRESETS, LEARNING_HOURS_LABELS } from '@/lib/constants';
import { loadTraditionalChineseFont } from '@/lib/og/font';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ shortCode: string }> }
) {
  const { shortCode } = await context.params;
  const url = new URL(req.url);
  const isStory = url.searchParams.get('format') === 'story';
  const width = isStory ? 1080 : 1200;
  const height = isStory ? 1920 : 630;

  let title = 'CluBar 校園社團活動';
  let clubName = '精選社團';
  let uniName = '大專校院';
  let timeText = '時間即將公布';
  let locationText = '校內場地';
  let badges: string[] = ['零基礎友善', '歡迎非社員'];
  let accentHex = '#C2410C';
  let bgHex = '#FFF7ED';
  let isDark = false;

  if (isDatabaseConfigured()) {
    try {
      const [row] = await db
        .select({
          event: clubEvents,
          club: clubs,
          uniShortName: universities.shortName,
        })
        .from(clubEvents)
        .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
        .innerJoin(universities, eq(clubs.universityId, universities.id))
        .where(eq(clubEvents.shortCode, shortCode))
        .limit(1);

      if (row) {
        title = row.event.title;
        clubName = row.club.name;
        uniName = row.uniShortName;
        locationText = row.event.locationText;
        timeText = row.event.startsAt
          ? formatTaipeiDateTime(row.event.startsAt)
          : row.event.scheduleMode === 'voting'
            ? '時段投票中（點擊參與喬時間）'
            : '時間待定（TBD）';

        const theme = EVENT_THEME_PRESETS[row.event.themePreset] ?? EVENT_THEME_PRESETS.warm_paper;
        accentHex = theme.accentHex;
        bgHex = theme.bgHex;
        isDark = row.event.themePreset === 'midnight_jam';

        const nextBadges: string[] = [];
        if (row.event.beginnerFriendly) nextBadges.push('零基礎友善');
        if (row.event.nonMembersWelcome) nextBadges.push('非社員歡迎');
        nextBadges.push(row.event.feeNtd > 0 ? `NT$ ${row.event.feeNtd}` : '免費參加');
        if (
          row.event.learningHoursCategory !== 'none' &&
          Number(row.event.learningHoursCount || 0) > 0
        ) {
          nextBadges.push(
            `${LEARNING_HOURS_LABELS[row.event.learningHoursCategory]} ${Number(
              row.event.learningHoursCount
            )}h`
          );
        }
        badges = nextBadges;
      }
    } catch {
      // Render graceful fallback OG card
    }
  }

  const fontData = await loadTraditionalChineseFont();
  const fg = isDark ? '#F8FAFC' : '#0F172A';
  const muted = isDark ? '#CBD5E1' : '#475569';
  const cardBg = isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.92)';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: bgHex,
          padding: isStory ? '88px 72px' : '52px 64px',
          color: fg,
          fontFamily: fontData ? 'NotoSansTC, sans-serif' : 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              padding: isStory ? '14px 28px' : '10px 22px',
              borderRadius: '999px',
              backgroundColor: accentHex,
              color: '#FFFFFF',
              fontSize: isStory ? '28px' : '22px',
              fontWeight: 700,
            }}
          >
            {`${uniName} ${clubName}`}
          </div>
          <div style={{ display: 'flex', fontSize: isStory ? '26px' : '20px', color: muted, fontWeight: 700 }}>
            CluBar 社團聚
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: isStory ? '28px' : '18px' }}>
          <div
            style={{
              display: 'flex',
              fontSize: isStory ? '72px' : '50px',
              lineHeight: 1.2,
              fontWeight: 700,
              color: fg,
            }}
          >
            {title}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {badges.slice(0, 4).map((b) => (
              <div
                key={b}
                style={{
                  display: 'flex',
                  padding: isStory ? '12px 24px' : '8px 18px',
                  borderRadius: '999px',
                  backgroundColor: cardBg,
                  border: `2px solid ${accentHex}`,
                  fontSize: isStory ? '26px' : '20px',
                  fontWeight: 700,
                  color: isDark ? '#FDE68A' : accentHex,
                }}
              >
                {b}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: isStory ? '36px 40px' : '24px 32px',
            borderRadius: '28px',
            backgroundColor: cardBg,
            border: `2px solid ${accentHex}`,
          }}
        >
          <div style={{ display: 'flex', fontSize: isStory ? '30px' : '24px', fontWeight: 700, color: fg }}>
            {`時間：${timeText}`}
          </div>
          <div style={{ display: 'flex', fontSize: isStory ? '28px' : '22px', color: muted }}>
            {`地點：${locationText}`}
          </div>
          <div style={{ display: 'flex', fontSize: isStory ? '24px' : '18px', color: accentHex, fontWeight: 700 }}>
            {`/e/${shortCode}`}
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
      ...(fontData
        ? {
            fonts: [{ name: 'NotoSansTC', data: fontData, weight: 700, style: 'normal' as const }],
          }
        : {}),
    }
  );
}
