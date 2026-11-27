import { ImageResponse } from 'next/og';
import { eq, inArray } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import {
  blendSessions,
  interestDomains,
  universities,
  userOnboardingProfiles,
  users,
} from '@/db/schema';
import { loadTraditionalChineseFont } from '@/lib/og/font';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const url = new URL(req.url);
  const format = url.searchParams.get('format') === 'post' ? 'post' : 'story';
  const width = 1080;
  const height = format === 'story' ? 1920 : 1350;

  let creatorName = '校園探索者';
  let partnerName: string | null = null;
  let uniName = '大專校院';
  let archetype = '跨界實作探索派';
  let domainNames: string[] = ['遊戲開發', '影像攝影', '戶外探索'];

  if (isDatabaseConfigured()) {
    try {
      const [session] = await db
        .select()
        .from(blendSessions)
        .where(eq(blendSessions.shortCode, code))
        .limit(1);

      if (session) {
        const [uniRow, creatorRow, profileRow] = await Promise.all([
          db
            .select({ shortName: universities.shortName })
            .from(universities)
            .where(eq(universities.id, session.universityId))
            .limit(1),
          db
            .select({ displayName: users.displayName })
            .from(users)
            .where(eq(users.id, session.creatorUserId))
            .limit(1),
          db
            .select({ personaArchetype: userOnboardingProfiles.personaArchetype })
            .from(userOnboardingProfiles)
            .where(eq(userOnboardingProfiles.userId, session.creatorUserId))
            .limit(1),
        ]);

        if (uniRow[0]) uniName = uniRow[0].shortName;
        if (creatorRow[0]) creatorName = creatorRow[0].displayName.split('（')[0] || '校園探索者';
        if (profileRow[0]?.personaArchetype) archetype = profileRow[0].personaArchetype;

        if (session.partnerUserId) {
          const [partnerRow] = await db
            .select({ displayName: users.displayName })
            .from(users)
            .where(eq(users.id, session.partnerUserId))
            .limit(1);
          if (partnerRow) partnerName = partnerRow.displayName.split('（')[0] || '合拍夥伴';
        }

        if (session.sharedDomainIds.length > 0) {
          const domains = await db
            .select({ nameZh: interestDomains.nameZh })
            .from(interestDomains)
            .where(inArray(interestDomains.id, session.sharedDomainIds));
          if (domains.length > 0) domainNames = domains.map((d) => d.nameZh);
        }
      }
    } catch {
      // Fallback to generic personal taste visual
    }
  }

  const fontData = await loadTraditionalChineseFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(155deg, #f8f5ee 0%, #fae8d1 100%)',
          padding: '84px 72px',
          color: '#261a12',
          fontFamily: fontData ? 'NotoSansTC, sans-serif' : 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              padding: '14px 28px',
              borderRadius: '999px',
              backgroundColor: '#EA580C',
              color: '#FFFFFF',
              fontSize: '28px',
              fontWeight: 700,
            }}
          >
            CluBar 社團聚 · 校園興趣 Blend
          </div>
          <div style={{ display: 'flex', fontSize: '28px', color: '#6a5e56', fontWeight: 700 }}>
            {uniName}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{ display: 'flex', fontSize: '34px', color: '#9e5c11', fontWeight: 700 }}>
            {partnerName ? `${creatorName} × ${partnerName} 的雙人興趣頻率` : `${creatorName} 的個人校園品味卡`}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '70px',
              lineHeight: 1.15,
              fontWeight: 700,
              color: '#261a12',
            }}
          >
            {partnerName ? '我們的興趣交集' : archetype}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px' }}>
            {domainNames.slice(0, 4).map((name) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  padding: '16px 32px',
                  borderRadius: '999px',
                  backgroundColor: '#FFFFFF',
                  border: '3px solid #dcd7cd',
                  fontSize: '30px',
                  fontWeight: 700,
                  color: '#7b470b',
                }}
              >
                #{name}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            padding: '36px 40px',
            borderRadius: '36px',
            backgroundColor: 'rgba(255,255,255,0.88)',
            border: '2px solid #dcd7cd',
          }}
        >
          <div style={{ display: 'flex', fontSize: '30px', fontWeight: 700, color: '#261a12' }}>
            {partnerName
              ? '點進連結，看看適合我們一起去的社團與近期體驗活動'
              : '來看看我們有哪些共同興趣，週末一起去體驗看看！'}
          </div>
          <div style={{ display: 'flex', fontSize: '24px', color: '#6a5e56' }}>
            {`/blend/${code}`}
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
