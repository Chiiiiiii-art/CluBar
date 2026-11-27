import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Award, CalendarCheck, Layers, Lock } from 'lucide-react';
import { db, isDatabaseConfigured } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';
import { LEARNING_HOURS_LABELS } from '@/lib/constants';
import { buildUserPortfolio } from '@/lib/services/portfolio';

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
      <div className="mx-auto max-w-lg rounded-xl border border-ink-300 bg-white p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-ink-500" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-ink-900">
          此社團成長軌跡目前不公開
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          對方設定為「僅同校查閱」或「完全私密」，請登入並完成同校 .edu.tw 驗證後再查看。
        </p>
        <Link
          href="/me"
          className="mt-4 inline-flex rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white"
        >
          返回個人中心
        </Link>
      </div>
    );
  }

  if (!portfolio) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <section className="rounded-xl border border-ink-300 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink-500">
              {portfolio.university_short_name || '大專校院'} · @{portfolio.handle}
            </p>
            <h1 className="text-2xl font-bold text-ink-900">{portfolio.display_name}</h1>
          </div>
          <span className="rounded-full bg-accent-100 px-3 py-1 text-sm font-semibold text-accent-900">
            公開社團成長頁
          </span>
        </div>

        {portfolio.alumni_expertise_tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {portfolio.alumni_expertise_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line bg-ink-50 px-3 py-1 text-sm font-semibold text-ink-800"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
          <Award className="h-4 w-4 text-accent-600" aria-hidden="true" />
          已驗證學習時數統計（合計 {portfolio.learning_hours_total} 小時）
        </h2>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          {(['art', 'life', 'service'] as const).map((cat) => (
            <span
              key={cat}
              className="rounded-xl bg-ink-50 px-3 py-2 text-ink-800"
            >
              {LEARNING_HOURS_LABELS[cat]}：{portfolio.learning_hours_by_category[cat]} h
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
          <Layers className="h-4 w-4 text-accent-600" aria-hidden="true" />
          社團參與與幹部經歷 ({portfolio.clubs.length})
        </h2>
        {portfolio.clubs.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            目前尚未公開社團職務或歷屆經歷。完成校園驗證並加入社團後，系統會自動整理為公開履歷證據。
          </p>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {portfolio.clubs.map((c, idx) => (
              <Link
                key={`${c.club_id}-${idx}`}
                href={`/clubs/${c.slug}`}
                className="flex min-h-[44px] flex-col justify-center rounded-xl bg-ink-50 p-3.5 text-sm hover:bg-accent-100/70"
              >
                <p className="font-bold text-ink-900">
                  {c.university_short_name} · {c.name}
                </p>
                <p className="mt-1 text-ink-600">
                  {c.role.toUpperCase()} {c.title ? `(${c.title})` : ''} · {c.is_active ? '現任' : '歷屆'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
          <CalendarCheck className="h-4 w-4 text-accent-600" aria-hidden="true" />
          參與活動與公開成果 ({portfolio.works_and_moments.length})
        </h2>
        {portfolio.works_and_moments.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-600">
            尚未累積公開活動簽到或成果作品。到「別的聚」報名體驗活動並現場簽到，就會記錄在這裡。
          </p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {portfolio.works_and_moments.map((w) => (
              <Link
                key={`${w.source}-${w.id}`}
                href={w.url}
                className="flex min-h-[44px] items-center rounded-xl bg-ink-50 p-3.5 hover:bg-ink-100"
              >
                <span className="font-bold text-accent-600">[{w.kind_label}]</span>{' '}
                <span className="ml-1 font-bold text-ink-900">{w.title}</span>
                <span className="ml-2 text-ink-500">· {w.club_name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
