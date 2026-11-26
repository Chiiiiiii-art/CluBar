import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, isNull, or } from 'drizzle-orm';
import { FolderHeart, Settings, ArrowRight } from 'lucide-react';
import { db, isDatabaseConfigured } from '@/db';
import { clubMemberships, clubs, universities } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export default async function MyClubsPage() {
  if (!isDatabaseConfigured()) redirect('/login?callbackUrl=/my-clubs');
  const user = await getCurrentUser();
  if (!user) redirect('/login?callbackUrl=/my-clubs');

  const memberships = await db
    .select({
      clubId: clubs.id,
      slug: clubs.slug,
      name: clubs.name,
      universityShortName: universities.shortName,
      role: clubMemberships.role,
      title: clubMemberships.title,
    })
    .from(clubMemberships)
    .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(
      and(
        eq(clubMemberships.userId, user.id),
        or(isNull(clubMemberships.endedAt), eq(clubMemberships.role, 'alumni'))
      )
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <FolderHeart className="h-5 w-5 text-[var(--primary)]" />
          <h1 className="text-xl font-extrabold text-slate-900">我的社團（我的聚快速切換）</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          認證社員可於此快速發送 NRC 日常微動態；幹部可進入管理後台發起活動、審核相簿與評鑑歸檔。
        </p>

        {memberships.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--muted)] p-6 text-center">
            <p className="text-sm font-bold text-slate-800">目前尚未加入任何認證社團</p>
            <p className="mt-1 text-xs text-slate-600">
              可從「別的聚」認識社團並申請加入社員，或前往「足跡與個人 → 認領／申請社團」。
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link
                href="/"
                className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white"
              >
                前往別的聚探索
              </Link>
              <Link
                href="/clubs/apply"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700"
              >
                認領／申請社團
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {memberships.map((m) => (
              <div
                key={`${m.clubId}-${m.role}`}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500">
                    {m.universityShortName} · {m.role.toUpperCase()}
                    {m.title ? `（${m.title}）` : ''}
                  </span>
                  <h2 className="text-base font-extrabold text-slate-900">{m.name}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/clubs/${m.slug}`}
                    className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-800"
                  >
                    社團門面
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {(m.role === 'owner' || m.role === 'editor' || m.role === 'alumni') && (
                    <Link
                      href={`/clubs/${m.slug}/manage`}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-[var(--primary)] px-3.5 text-xs font-bold text-white"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      管理後台
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
