import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '@/db';
import { clubs } from '@/db/schema';
import { getCurrentUser, requireClubArchiveAccess } from '@/lib/auth/guards';
import { LEARNING_HOURS_LABELS, POST_KIND_LABELS } from '@/lib/constants';
import { buildClubEvaluationPack } from '@/lib/services/evaluation';
import { PrintTriggerButton } from '@/components/PrintTriggerButton';

export const dynamic = 'force-dynamic';

export default async function ClubEvaluationPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { slug } = await params;
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/clubs/${slug}/evaluation/print`)}`);
  }

  const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
  if (!club) notFound();

  try {
    await requireClubArchiveAccess(club.id);
  } catch {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center">
        <h1 className="text-lg font-extrabold text-slate-900">無權檢視評鑑報告</h1>
        <p className="mt-2 text-sm text-slate-600">
          僅社團現任幹部、歷屆校友、所屬校方授權管理人可檢視與列印評鑑檔案。
        </p>
      </div>
    );
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const pack = await buildClubEvaluationPack({
    clubId: club.id,
    fromDate: sp.from && dateRe.test(sp.from) ? sp.from : undefined,
    toDate: sp.to && dateRe.test(sp.to) ? sp.to : undefined,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 bg-white p-6 sm:p-10 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 print:hidden">
        <Link
          href={`/clubs/${slug}/manage`}
          className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-700"
        >
          ← 返回管理後台
        </Link>
        <div className="flex gap-2">
          <a
            href={`/api/clubs/${slug}/evaluation/export?format=markdown&from=${pack.period.from_date}&to=${pack.period.to_date}`}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-800"
          >
            下載 Markdown (.md)
          </a>
          <PrintTriggerButton />
        </div>
      </div>

      <header className="space-y-2 border-b-2 border-slate-900 pb-4">
        <p className="text-xs font-bold text-slate-600">
          CluBar 社團評鑑暨學務歸檔彙整報告（正式列印版）
        </p>
        <h1 className="text-2xl font-black text-slate-900">
          {pack.club.university_name} {pack.club.name}
        </h1>
        <p className="text-sm text-slate-700">
          統計期間：{pack.period.from_date} ～ {pack.period.to_date}｜現任核心團隊：
          {pack.active_officers
            .map((o) => `${o.display_name}${o.title ? `（${o.title}）` : ''}`)
            .join('、') || '無紀錄'}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-slate-900">
          一、年度活動辦理與簽到實績（共 {pack.events.length} 場）
        </h2>
        {pack.events.length === 0 ? (
          <p className="text-sm text-slate-500">此時段內尚無勾選納入評鑑之活動。</p>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50">
                <th className="p-2">活動名稱</th>
                <th className="p-2">時間／地點</th>
                <th className="p-2">共辦社團</th>
                <th className="p-2">報名／出席</th>
                <th className="p-2">學習時數</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pack.events.map((ev) => (
                <tr key={ev.id}>
                  <td className="p-2 font-bold text-slate-900">{ev.title}</td>
                  <td className="p-2 text-slate-700">
                    {ev.starts_at ? ev.starts_at.slice(0, 10) : '未排定'} · {ev.location_text}
                  </td>
                  <td className="p-2 text-slate-700">
                    {ev.is_co_hosted ? ev.partner_or_host_club : '獨立主辦'}
                  </td>
                  <td className="p-2 text-slate-700">
                    {ev.going_count} / {ev.attended_count} 人
                  </td>
                  <td className="p-2 text-slate-700">
                    {ev.learning_hours_category !== 'none' && ev.learning_hours_count > 0
                      ? `${
                          LEARNING_HOURS_LABELS[
                            ev.learning_hours_category as keyof typeof LEARNING_HOURS_LABELS
                          ] ?? ev.learning_hours_category
                        } ${ev.learning_hours_count}h`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-extrabold text-slate-900">
          二、成果紀錄與日常瞬間精選（共 {pack.posts.length} 篇、相片 {pack.album_photos.length} 張）
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {pack.posts.map((p) => (
            <li key={p.id}>
              [{POST_KIND_LABELS[p.post_kind as keyof typeof POST_KIND_LABELS]?.label ?? p.post_kind}]
              {' '}{p.headline}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-extrabold text-slate-900">
          三、內部會議記錄與財產清冊（共 {pack.archive_files.length} 份）
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {pack.archive_files.map((f) => (
            <li key={f.id}>
              [{f.category}] {f.title}（{f.occurred_on}，{Math.round(f.size_bytes / 1024)} KB）
            </li>
          ))}
        </ul>
      </section>

      {pack.latest_pitfall_note && (
        <section className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <h2 className="font-extrabold text-slate-900">四、社團交接重要備忘錄</h2>
          <p>場地申請提示：{pack.latest_pitfall_note.venue_tips || '無'}</p>
          <p>時數／核銷死線：{pack.latest_pitfall_note.hours_and_deadlines || '無'}</p>
          <p>關鍵聯絡窗口：{pack.latest_pitfall_note.contacts_and_vendors || '無'}</p>
        </section>
      )}
    </div>
  );
}
