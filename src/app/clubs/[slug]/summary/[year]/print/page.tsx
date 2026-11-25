import { notFound, redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { clubs, posts, universities } from '@/db/schema';
import { formatTaipeiDate } from '@/lib/academic-year';
import { getCurrentUser, requireClubSummaryAccess } from '@/lib/auth/guards';
import { CLUB_CATEGORIES, POST_TYPES } from '@/lib/constants';
import { PrintToolbar } from '@/components/PrintToolbar';

export const dynamic = 'force-dynamic';

export default async function ClubSummaryPrintPage({
  params,
}: {
  params: Promise<{ slug: string; year: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { slug, year } = await params;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/clubs/${slug}/summary/${year}/print`)}`);
  }

  const academicYear = Number(year);
  if (!Number.isInteger(academicYear) || academicYear < 100 || academicYear > 150) {
    notFound();
  }

  const [clubRow] = await db
    .select({
      club: clubs,
      universityName: universities.name,
    })
    .from(clubs)
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(eq(clubs.slug, slug))
    .limit(1);

  if (!clubRow) notFound();

  try {
    await requireClubSummaryAccess(clubRow.club.id);
  } catch {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center">
        <h1 className="text-lg font-extrabold text-slate-900">沒有檢視權限</h1>
        <p className="mt-2 text-sm text-slate-600">
          僅該社團現任幹部、歷屆校友或平台管理員可檢視與匯出學年度成果彙整。
        </p>
      </div>
    );
  }

  const postRows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.clubId, clubRow.club.id),
        eq(posts.academicYear, academicYear),
        eq(posts.status, 'published')
      )
    )
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt));

  return (
    <div className="mx-auto max-w-4xl">
      <PrintToolbar slug={clubRow.club.slug} year={academicYear} clubName={clubRow.club.name} />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs print:border-0 print:p-0 print:shadow-none sm:p-10">
        <header className="border-b-2 border-slate-900 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600">
            <span>社團聚 CluBar｜社團數位化成果彙整報告</span>
            <span>列印日期：{formatTaipeiDate(new Date())}</span>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
            {clubRow.universityName} {clubRow.club.name} — {academicYear} 學年度成果彙整
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            社團分類：{CLUB_CATEGORIES[clubRow.club.category].label} ｜ 公開專頁：/clubs/
            {clubRow.club.slug}
          </p>
        </header>

        {/* Summary Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-[11px] font-semibold text-slate-600">總公開紀錄</p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">{postRows.length}</p>
          </div>
          {Object.entries(POST_TYPES).map(([key, meta]) => (
            <div key={key} className="rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-[11px] font-semibold text-slate-600">{meta.label}</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">
                {postRows.filter((p) => p.postType === key).length}
              </p>
            </div>
          ))}
        </section>

        {/* Grouped Sections */}
        <div className="mt-8 space-y-8">
          {Object.entries(POST_TYPES).map(([typeKey, typeMeta]) => {
            const group = postRows.filter((p) => p.postType === typeKey);
            return (
              <section key={typeKey} className="space-y-3">
                <h2 className="border-b border-slate-200 pb-1.5 text-lg font-extrabold text-slate-900">
                  {typeMeta.label}（{group.length} 篇）
                </h2>

                {group.length === 0 ? (
                  <p className="text-xs text-slate-500">本學年度尚無此類別成果紀錄。</p>
                ) : (
                  <div className="space-y-4">
                    {group.map((item) => (
                      <article
                        key={item.id}
                        className="print-break-avoid rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                          <span className="text-xs text-slate-500">
                            {formatTaipeiDate(item.publishedAt ?? item.createdAt)}
                          </span>
                        </div>
                        {item.collaborators && (
                          <p className="mt-1 text-xs text-slate-600">
                            合作單位：{item.collaborators}
                          </p>
                        )}
                        <p className="mt-2 text-sm leading-relaxed text-slate-700">
                          {item.summary}
                        </p>
                        {item.tags.length > 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            標籤：{item.tags.map((t) => `#${t}`).join(' ')}
                          </p>
                        )}
                        {item.externalLinks.length > 0 && (
                          <p className="mt-1 text-xs text-blue-700">
                            相關連結：{item.externalLinks.map((l) => `${l.label} (${l.url})`).join(' ｜ ')}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
