'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckCircle2, Download, ShieldAlert, XCircle } from 'lucide-react';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import { REPORT_REASONS } from '@/lib/constants';

export interface AdminPageData {
  applications: {
    id: string;
    type: string;
    applicantName: string;
    applicantCampusEmail: string | null;
    targetClubName: string | null;
    proposedUniversityName: string | null;
    proposedName: string | null;
    proposedSlug: string | null;
    evidenceText: string;
    evidenceUrls: string[];
    createdAt: string;
  }[];
  reports: {
    id: string;
    targetType: string;
    targetId: string;
    reason: keyof typeof REPORT_REASONS;
    detail: string | null;
    reporterName: string;
    createdAt: string;
  }[];
  suspendedClubs: {
    id: string;
    name: string;
    slug: string;
    universityShortName: string;
  }[];
  removedPosts: {
    id: string;
    title: string;
    status: string;
    clubName: string;
  }[];
  analyticsSummary: {
    eventType: string;
    count: number;
  }[];
}

const REPORT_TARGET_LABELS: Record<string, string> = {
  post: '現場流／日常貼文',
  event: '社團體驗活動',
  event_comment: '活動留言',
  album_photo: '活動共編相簿照片',
  club_question: '社團公開問答',
  together_item: '一起聚跨校貼文',
  club: '社團專頁',
};

export function AdminClient({ data }: { data: AdminPageData }) {
  const router = useRouter();
  const [tab, setTab] = useState<'applications' | 'reports' | 'restore' | 'analytics'>(
    'applications'
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const reviewApp = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, review_note: notes[id] || '' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json?.error?.message || '審核操作失敗。');
        return;
      }
      setMsg(action === 'approve' ? '已核准該社團申請！' : '已駁回申請並通知申請人。');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const resolveReport = async (
    id: string,
    resolution: 'keep' | 'takedown' | 'suspend_club'
  ) => {
    setBusyId(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/reports/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, resolution_note: notes[id] || '' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json?.error?.message || '處置失敗。');
        return;
      }
      setMsg('檢舉案件已處置並記錄稽核軌跡。');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const unsuspendClub = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/clubs/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unsuspend', note: '管理員解除停權' }),
      });
      if (res.ok) {
        setMsg('已解除該社團停權狀態。');
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const restorePost = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/posts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', note: '管理員復原貼文' }),
      });
      if (res.ok) {
        setMsg('已將該篇貼文復原為公開狀態。');
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const csvQs = new URLSearchParams({ format: 'csv' });
  if (fromDate) csvQs.set('from', fromDate);
  if (toDate) csvQs.set('to', toDate);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-blue-700">Platform Governance Console</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">平台治理與數據匯出後台</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-900">
              待審社團：{data.applications.length}
            </span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-900">
              待處理檢舉：{data.reports.length}
            </span>
          </div>
        </div>
      </section>

      {msg && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900">
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('applications')}
          className={`rounded-xl px-4 py-2 text-xs font-bold ${
            tab === 'applications'
              ? 'bg-[var(--primary)] text-white'
              : 'border border-[var(--border-strong)] bg-white text-slate-700'
          }`}
        >
          社團申請審核 ({data.applications.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`rounded-xl px-4 py-2 text-xs font-bold ${
            tab === 'reports'
              ? 'bg-[var(--primary)] text-white'
              : 'border border-[var(--border-strong)] bg-white text-slate-700'
          }`}
        >
          檢舉處置佇列 ({data.reports.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('restore')}
          className={`rounded-xl px-4 py-2 text-xs font-bold ${
            tab === 'restore'
              ? 'bg-[var(--primary)] text-white'
              : 'border border-[var(--border-strong)] bg-white text-slate-700'
          }`}
        >
          停權解除與貼文復原
        </button>
        <button
          type="button"
          onClick={() => setTab('analytics')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold ${
            tab === 'analytics'
              ? 'bg-[#2563EB] text-white'
              : 'border border-[var(--border-strong)] bg-white text-slate-700'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Power BI 匿名轉換指標</span>
        </button>
      </div>

      {tab === 'applications' && (
        <div className="space-y-4">
          {data.applications.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500">
              目前沒有待審核的社團申請。
            </div>
          ) : (
            data.applications.map((app) => (
              <div
                key={app.id}
                className="space-y-3 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-800">
                    {app.type === 'directory_claim'
                      ? '名錄認領'
                      : app.type === 'new_club'
                        ? '新設／他校社團'
                        : '社長失聯接管申訴'}
                  </span>
                  <span className="text-xs text-slate-500">
                    申請時間：{formatTaipeiDateTime(app.createdAt)}
                  </span>
                </div>

                <div className="text-sm">
                  <p className="font-bold text-slate-900">
                    申請社團：
                    {app.targetClubName ||
                      `${app.proposedUniversityName ?? ''} ${app.proposedName ?? ''} (${app.proposedSlug ?? ''})`}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    申請人：{app.applicantName}（{app.applicantCampusEmail || '未記錄校園信箱'}）
                  </p>
                  <p className="mt-2 rounded-xl bg-[var(--muted)] p-3 text-xs text-slate-800">
                    佐證說明：{app.evidenceText}
                  </p>
                  {app.evidenceUrls.length > 0 && (
                    <p className="mt-1 text-xs text-blue-700">
                      佐證連結：{app.evidenceUrls.join(' ｜ ')}
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="審核意見／駁回原因（選填）"
                  value={notes[app.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [app.id]: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === app.id}
                    onClick={() => void reviewApp(app.id, 'approve')}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>核准開通</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === app.id}
                    onClick={() => void reviewApp(app.id, 'reject')}
                    className="inline-flex items-center gap-1 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>駁回</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          {data.reports.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500">
              目前沒有待處理的檢舉案件。
            </div>
          ) : (
            data.reports.map((rep) => (
              <div
                key={rep.id}
                className="space-y-3 rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-0.5 font-bold text-red-800">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    {REPORT_REASONS[rep.reason].label}
                  </span>
                  <span className="text-slate-500">
                    對象：{REPORT_TARGET_LABELS[rep.targetType] ?? rep.targetType} (<code>{rep.targetType}</code>) / <code>{rep.targetId}</code>
                  </span>
                </div>
                {rep.detail && (
                  <p className="rounded-xl bg-[var(--muted)] p-3 text-xs text-slate-800">
                    檢舉說明：{rep.detail}
                  </p>
                )}
                <input
                  type="text"
                  placeholder="處置說明（若下架或停權將通知該社團社長）"
                  value={notes[rep.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [rep.id]: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === rep.id}
                    onClick={() => void resolveReport(rep.id, 'keep')}
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700"
                  >
                    判定保留
                  </button>
                  <button
                    type="button"
                    disabled={busyId === rep.id}
                    onClick={() => void resolveReport(rep.id, 'takedown')}
                    className="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white"
                  >
                    下架此項目內容
                  </button>
                  <button
                    type="button"
                    disabled={busyId === rep.id}
                    onClick={() => void resolveReport(rep.id, 'suspend_club')}
                    className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white"
                  >
                    暫停社團發文權限
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'restore' && (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs">
            <h2 className="mb-3 text-base font-extrabold text-slate-900">
              停權中社團（{data.suspendedClubs.length}）
            </h2>
            {data.suspendedClubs.length === 0 ? (
              <p className="text-xs text-slate-500">目前沒有停權中社團。</p>
            ) : (
              <div className="space-y-2.5">
                {data.suspendedClubs.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-xs"
                  >
                    <span className="font-bold text-slate-900">
                      {c.universityShortName} · {c.name}
                    </span>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void unsuspendClub(c.id)}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 font-bold text-white"
                    >
                      解除停權
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs">
            <h2 className="mb-3 text-base font-extrabold text-slate-900">
              已下架／隱藏貼文復原（{data.removedPosts.length}）
            </h2>
            {data.removedPosts.length === 0 ? (
              <p className="text-xs text-slate-500">目前沒有可復原的已下架貼文。</p>
            ) : (
              <div className="space-y-2.5">
                {data.removedPosts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{p.title}</p>
                      <p className="text-slate-500">
                        {p.clubName} ｜ {p.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void restorePost(p.id)}
                      className="shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 font-bold text-white"
                    >
                      復原公開
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'analytics' && (
        <section className="space-y-5 rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                匿名轉換事件彙總（Power BI 匯出就緒）
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                完全不含 PII（無學號、無信箱、無使用者 ID），欄位對齊 Power BI 報表匯入規格。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="起始日期"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <span className="text-xs text-slate-500">至</span>
              <input
                type="date"
                aria-label="結束日期"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <a
                href={`/api/admin/analytics/export?${csvQs.toString()}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>匯出 Power BI CSV</span>
              </a>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.analyticsSummary.map((row) => (
              <div
                key={row.eventType}
                className="rounded-2xl border border-[var(--border)] bg-[var(--muted)]/50 p-4"
              >
                <p className="font-mono text-xs text-slate-600">{row.eventType}</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{row.count}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
