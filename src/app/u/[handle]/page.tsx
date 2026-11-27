import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Award, CalendarCheck, Layers, Lock } from 'lucide-react';
import { db, isDatabaseConfigured } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { LEARNING_HOURS_LABELS } from '@/lib/constants';
import { buildUserPortfolio } from '@/lib/services/portfolio';
import { Badge, ButtonLink, ClubMark, EmptyState, Section } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { handle } = await params;

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle.toLowerCase()))
    .limit(1);

  if (!targetUser) notFound();

  const viewer = await getCurrentUser().catch(() => null);
  const { accessDenied, portfolio } = await buildUserPortfolio({
    targetUserId: targetUser.id,
    viewer,
  });

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg py-8">
        <EmptyState
          icon={<Lock aria-hidden="true" />}
          title="此社團成長軌跡目前不公開"
          description="對方設定為「僅同校查閱」或「完全私密」，請登入並完成同校 .edu.tw 驗證後再查看。"
          action={<ButtonLink href="/me">返回個人中心</ButtonLink>}
        />
      </div>
    );
  }

  if (!portfolio) notFound();

  const metaLine = `${portfolio.university_short_name || '大專校院'} · @${portfolio.handle}`;

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-10 pb-12">
      <header className="flex items-start gap-4">
        <ClubMark name={portfolio.display_name} seed={portfolio.handle ?? undefined} size="lg" round />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="break-words text-2xl font-bold text-ink-900">{portfolio.display_name}</h1>
          <p className="break-words text-sm text-ink-600">{metaLine}</p>
          {portfolio.alumni_expertise_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {portfolio.alumni_expertise_tags.map((tag) => (
                <Badge key={tag}>#{tag}</Badge>
              ))}
            </div>
          )}
        </div>
      </header>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <Award className="h-5 w-5 text-accent-600" aria-hidden="true" />
            已驗證學習時數
          </span>
        }
        description={`合計 ${portfolio.learning_hours_total} 小時`}
      >
        <dl className="grid grid-cols-3 gap-3">
          {(['art', 'life', 'service'] as const).map((cat) => (
            <div key={cat} className="min-w-0 rounded-xl border border-line bg-surface px-3 py-3">
              <dt className="text-sm text-ink-600">{LEARNING_HOURS_LABELS[cat]}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink-900">
                {portfolio.learning_hours_by_category[cat]} h
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <Layers className="h-5 w-5 text-accent-600" aria-hidden="true" />
            社團參與與幹部經歷
          </span>
        }
      >
        {portfolio.clubs.length === 0 ? (
          <EmptyState
            title="還沒有公開的社團經歷"
            description="完成校園驗證並加入社團後，系統會自動整理為公開履歷證據。"
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {portfolio.clubs.map((c, idx) => (
              <li key={`${c.club_id}-${idx}`}>
                <Link
                  href={`/clubs/${c.slug}`}
                  className="flex min-h-14 items-center gap-3 py-3 hover:bg-ink-50"
                >
                  <ClubMark name={c.name} seed={c.slug} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold text-ink-900">{c.name}</span>
                    <span className="block break-words text-sm text-ink-600">
                      {c.university_short_name} · {c.role.toUpperCase()}
                      {c.title ? `（${c.title}）` : ''} · {c.is_active ? '現任' : '歷屆'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-accent-600" aria-hidden="true" />
            參與活動與公開成果
          </span>
        }
      >
        {portfolio.works_and_moments.length === 0 ? (
          <EmptyState
            title="還沒有公開的活動或成果"
            description="到「別的聚」報名體驗活動並現場簽到，就會記錄在這裡。"
            action={
              <ButtonLink href="/" variant="secondary">
                去探索活動
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {portfolio.works_and_moments.map((w) => (
              <li key={`${w.source}-${w.id}`}>
                <Link
                  href={w.url}
                  className="flex min-h-14 flex-col justify-center gap-0.5 py-3 hover:bg-ink-50"
                >
                  <span className="break-words font-semibold text-ink-900">{w.title}</span>
                  <span className="break-words text-sm text-ink-600">
                    {w.kind_label} · {w.club_name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
