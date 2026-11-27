'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, CheckCircle2, Search, ShieldAlert, Sparkles } from 'lucide-react';
import type { ClubCategory } from '@/db/schema';
import { CLUB_CATEGORIES, CLUB_CATEGORY_LIST } from '@/lib/constants';

export interface DirectoryClubOption {
  id: string;
  slug: string;
  name: string;
  category: ClubCategory;
  verification_status: 'unclaimed_directory' | 'verified' | 'suspended';
  university_id: string;
  university_short_name: string;
}

export function ClubApplyClient({
  universities,
  initialDirectory,
  preselectedClaimSlug,
  campusVerified,
}: {
  universities: { id: string; name: string; short_name: string }[];
  initialDirectory: DirectoryClubOption[];
  preselectedClaimSlug?: string;
  campusVerified: boolean;
}) {
  const preClaim = initialDirectory.find(
    (c) => c.slug === preselectedClaimSlug && c.verification_status === 'unclaimed_directory'
  );

  const [tab, setTab] = useState<'directory_claim' | 'new_club' | 'owner_takeover'>(
    'directory_claim'
  );
  const [searchText, setSearchText] = useState('');
  const [selectedClubId, setSelectedClubId] = useState(preClaim?.id ?? '');

  // new_club fields
  const [uniId, setUniId] = useState(universities[0]?.id ?? '');
  const [proposedName, setProposedName] = useState('');
  const [proposedSlug, setProposedSlug] = useState('');
  const [proposedCategory, setProposedCategory] = useState<ClubCategory>('academic');

  // shared evidence
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const filteredDirectory = initialDirectory.filter((c) => {
    const matchesStatus =
      tab === 'directory_claim'
        ? c.verification_status === 'unclaimed_directory'
        : c.verification_status !== 'unclaimed_directory';
    if (!matchesStatus) return false;
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.university_short_name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSubmittedId(null);

    try {
      const payload =
        tab === 'new_club'
          ? {
              type: 'new_club',
              proposed_university_id: uniId,
              proposed_name: proposedName,
              proposed_slug: proposedSlug.toLowerCase(),
              proposed_category: proposedCategory,
              evidence_text: evidenceText,
              evidence_urls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
            }
          : {
              type: tab,
              target_club_id: selectedClubId,
              evidence_text: evidenceText,
              evidence_urls: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
            };

      const res = await fetch('/api/club-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '提交申請失敗。');
        return;
      }
      setSubmittedId(json.application.id);
      setEvidenceText('');
      setEvidenceUrl('');
      setProposedName('');
      setProposedSlug('');
    } catch {
      setError('網路連線異常，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-xs">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>社團開頁與認證中心</span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
          認領校方名錄社團、申請新社團或接管申訴
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          防止冒名並保護跨屆資產歸屬，所有開頁與接管申請需由平台管理員核對幹部佐證後啟用。
        </p>

        {!campusVerified && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-bold">須先完成校園信箱（.edu.tw）驗證才可送出申請</p>
              <p className="mt-1">
                <Link
                  href="/me?returnTo=/clubs/apply"
                  className="inline-flex min-h-[44px] items-center font-bold text-blue-700 underline"
                >
                  前往個人中心驗證學校信箱 →
                </Link>
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setTab('directory_claim');
            setSelectedClubId('');
            setError(null);
          }}
          className={`min-h-[44px] rounded-2xl px-4 py-2 text-xs font-bold ${
            tab === 'directory_claim'
              ? 'bg-[var(--primary)] text-white'
              : 'border border-[var(--border-strong)] bg-white text-slate-700'
          }`}
        >
          1. 認領未開通之校方名錄社團
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('new_club');
            setError(null);
          }}
          className={`min-h-[44px] rounded-2xl px-4 py-2 text-xs font-bold ${
            tab === 'new_club'
              ? 'bg-[var(--primary)] text-white'
              : 'border border-[var(--border-strong)] bg-white text-slate-700'
          }`}
        >
          2. 申請建立新社團／他校社團
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('owner_takeover');
            setSelectedClubId('');
            setError(null);
          }}
          className={`min-h-[44px] rounded-2xl px-4 py-2 text-xs font-bold ${
            tab === 'owner_takeover'
              ? 'bg-[var(--primary)] text-white'
              : 'border border-[var(--border-strong)] bg-white text-slate-700'
          }`}
        >
          3. 前任社長失聯接管申訴
        </button>
      </div>

      {submittedId && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-sm text-emerald-950">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <p className="font-bold">已送出社團申請！</p>
            <p className="mt-1 text-xs">
              申請單編號：<code>{submittedId}</code>。審核結果將發送至您的個人中心站內通知。
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-xs"
      >
        <fieldset disabled={!campusVerified} className="space-y-5 disabled:opacity-60">
        {tab === 'new_club' ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">所屬大專校院</label>
                <select
                  value={uniId}
                  onChange={(e) => setUniId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  台灣大專六大社團分類
                </label>
                <select
                  value={proposedCategory}
                  onChange={(e) => setProposedCategory(e.target.value as ClubCategory)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {CLUB_CATEGORY_LIST.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">社團正式名稱</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={proposedName}
                onChange={(e) => setProposedName(e.target.value)}
                placeholder="例如：中央大學數位創作研習社"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                公開網址代碼（Slug）
              </label>
              <input
                type="text"
                required
                pattern="^[a-z0-9][a-z0-9-]{2,48}[a-z0-9]$"
                value={proposedSlug}
                onChange={(e) => setProposedSlug(e.target.value.toLowerCase())}
                placeholder="例如：ncu-digital-art（4–50 字小寫英文、數字或連字號）"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                公開主頁網址將為：<code>/clubs/{proposedSlug || 'your-club-slug'}</code>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700">
              {tab === 'directory_claim'
                ? '搜尋並選擇欲認領之未開通名錄社團'
                : '搜尋並選擇欲申訴接管之社團'}
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="輸入校名或社團名稱篩選..."
                className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm"
              />
            </div>

            {filteredDirectory.length === 0 ? (
              <p className="rounded-xl bg-[var(--muted)] p-4 text-xs text-slate-600">
                找不到符合的名錄社團。若貴社團不在名錄中，請切換至「2. 申請建立新社團／他校社團」。
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {filteredDirectory.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition-colors ${
                      selectedClubId === c.id
                        ? 'border-[var(--primary)] bg-orange-50'
                        : 'border-transparent hover:bg-[var(--muted)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="target_club_id"
                        value={c.id}
                        checked={selectedClubId === c.id}
                        onChange={() => setSelectedClubId(c.id)}
                        required
                      />
                      <div>
                        <p className="font-bold text-slate-900">
                          {c.university_short_name} · {c.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {CLUB_CATEGORIES[c.category].label} ｜ <code>/clubs/{c.slug}</code>
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">
            幹部身分或交接佐證說明（必填，至少 10 字）
          </label>
          <textarea
            rows={4}
            required
            minLength={10}
            maxLength={2000}
            value={evidenceText}
            onChange={(e) => setEvidenceText(e.target.value)}
            placeholder="請說明您的幹部職稱、本屆幹部名單、課外活動組核備資訊，或接管原因。"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">
            佐證參考連結（選填，如學校名錄頁面、官方粉專或雲端證明文件網址）
          </label>
          <input
            type="url"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !campusVerified}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>{submitting ? '提交中...' : '送出社團申請'}</span>
        </button>
        </fieldset>
      </form>
    </div>
  );
}
