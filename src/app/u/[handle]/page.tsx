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
      <div className="mx-auto max-w-lg rounded-3xl border border-[var(--border-strong)] bg-white p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-extrabold text-slate-900">
          此社團成長軌跡目前不公開
        </h1>
        <p className="mt-2 text-xs text-slate-600">
          對方設定為「僅同校查閱」或「完全私密」，請登入並完成同校 .edu.tw 驗證後再查看。
        </p>
        <Link
          href="/me"
          className="mt-4 inline-flex rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white"
        >
          返回個人中心
        </Link>
      </div>
    );
  }

  if (!portfolio) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-slate-500">
              {portfolio.university_short_name || '大專校院'} · @{portfolio.handle}
            </p>
            <h1 className="text-2xl font-black text-slate-900">{portfolio.display_name}</h1>
          </div>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">
            實質歷練 1D Portfolio
          </span>
        </div>

        {portfolio.alumni_expertise_tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {portfolio.alumni_expertise_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-warm)] px-3 py-1 text-xs font-bold text-slate-800"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <Award className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />
          已驗證學習時數統計（合計 {portfolio.learning_hours_total} 小時）
        </h2>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
          {(['art', 'life', 'service'] as const).map((cat) => (
            <span
              key={cat}
              className="rounded-xl bg-slate-50 px-3 py-2 text-slate-800"
            >
              {LEARNING_HOURS_LABELS[cat]}：{portfolio.learning_hours_by_category[cat]} h
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <Layers className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />
          社團參與與幹部經歷 ({portfolio.clubs.length})
        </h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {portfolio.clubs.map((c, idx) => (
            <Link
              key={`${c.club_id}-${idx}`}
              href={`/clubs/${c.slug}`}
              className="rounded-2xl bg-[var(--surface-warm)] p-3.5 text-xs hover:bg-orange-100/70"
            >
              <p className="font-bold text-slate-900">
                {c.university_short_name} · {c.name}
              </p>
              <p className="mt-1 text-slate-600">
                {c.role.toUpperCase()} {c.title ? `(${c.title})` : ''} · {c.is_active ? '現任' : '歷屆'}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <CalendarCheck className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />
          參與活動與公開成果 ({portfolio.works_and_moments.length})
        </h2>
        <div className="mt-3 space-y-2 text-xs">
          {portfolio.works_and_moments.map((w) => (
            <Link
              key={`${w.source}-${w.id}`}
              href={w.url}
              className="block rounded-2xl bg-slate-50 p-3.5 hover:bg-slate-100"
            >
              <span className="font-bold text-[var(--brand)]">[{w.kind_label}]</span>{' '}
              <span className="font-bold text-slate-900">{w.title}</span>
              <span className="ml-2 text-slate-500">· {w.club_name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
