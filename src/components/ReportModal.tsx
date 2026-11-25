'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, X } from 'lucide-react';
import type { ReportReason, ReportTargetType } from '@/db/schema';
import { REPORT_REASONS } from '@/lib/constants';

export function ReportModal({
  targetType,
  targetId,
  isLoggedIn,
  buttonLabel = '檢舉',
}: {
  targetType: ReportTargetType;
  targetId: string;
  isLoggedIn: boolean;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setOpen(true);
    setDone(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          detail: detail.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '檢舉送出失敗，請稍後再試。');
      } else {
        setDone(true);
        setDetail('');
      }
    } catch {
      setError('網路連線異常，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{buttonLabel}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="檢舉違規內容"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-slate-900">回報違規或侵權內容</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="關閉視窗"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {done ? (
              <div className="mt-4 space-y-4">
                <p className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
                  已收到您的檢舉回報，平台管理員將會儘速檢視並依法規與社群守則處置。
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
                >
                  完成
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    檢舉原因
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReportReason)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                  >
                    {Object.entries(REPORT_REASONS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    補充說明（選填）
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="請簡述問題所在或佐證連結，利於管理員快速判讀。"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {submitting ? '送出中...' : '送出檢舉'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
