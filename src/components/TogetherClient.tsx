'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquarePlus, MessageSquareText, Lock, X } from 'lucide-react';
import type { ClubCategory, ForumTag } from '@/db/schema';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import { CLUB_CATEGORIES, CLUB_CATEGORY_LIST, FORUM_TAGS } from '@/lib/constants';
import type { PublicForumThreadDTO } from '@/lib/serializers';

export interface OfficerClubOption {
  club_id: string;
  club_name: string;
  university_short_name: string;
  default_title: string | null;
}

export function TogetherClient({
  initialThreads,
  initialNextCursor,
  officerClubs,
  isLoggedIn,
}: {
  initialThreads: PublicForumThreadDTO[];
  initialNextCursor: string | null;
  officerClubs: OfficerClubOption[];
  isLoggedIn: boolean;
}) {
  const [threads, setThreads] = useState<PublicForumThreadDTO[]>(initialThreads);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [category, setCategory] = useState<ClubCategory | ''>('');
  const [tag, setTag] = useState<ForumTag | ''>('');
  const [loading, setLoading] = useState(false);

  // Composer Modal state
  const [composerOpen, setComposerOpen] = useState(false);
  const [actingClubId, setActingClubId] = useState(officerClubs[0]?.club_id ?? '');
  const [newCategory, setNewCategory] = useState<ClubCategory>('academic');
  const [newTag, setNewTag] = useState<ForumTag>('event_exp');
  const [authorTitle, setAuthorTitle] = useState(officerClubs[0]?.default_title ?? '');
  const [title, setTitle] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadThreads = async (opts: {
    nextCategory?: ClubCategory | '';
    nextTag?: ForumTag | '';
    cursor?: string | null;
    append?: boolean;
  }) => {
    const cat = opts.nextCategory !== undefined ? opts.nextCategory : category;
    const t = opts.nextTag !== undefined ? opts.nextTag : tag;
    setCategory(cat);
    setTag(t);
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (cat) sp.set('category', cat);
      if (t) sp.set('tag', t);
      if (opts.cursor) sp.set('cursor', opts.cursor);
      const res = await fetch(`/api/forum/threads?${sp.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setThreads((prev) => (opts.append ? [...prev, ...(json.threads ?? [])] : json.threads ?? []));
        setNextCursor(json.next_cursor ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/forum/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acting_club_id: actingClubId,
          category: newCategory,
          discussion_tag: newTag,
          title,
          content_md: contentMd,
          author_title: authorTitle.trim() || undefined,
          external_url: externalUrl.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json?.error?.message || '發起討論失敗，請檢查欄位內容。');
        return;
      }
      setComposerOpen(false);
      setTitle('');
      setContentMd('');
      setExternalUrl('');
      await loadThreads({ nextCategory: category, nextTag: tag });
    } catch {
      setFormError('網路連線異常，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-7">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>一起聚｜跨校同領域社團經驗交流</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">跨校社團實務討論流</h1>
          <p className="text-sm text-slate-600">
            公開唯讀分享活動規劃、器材採購、場地與幹部經營經驗；由認證社團幹部以「校名＋社團名」實名交流。
          </p>
        </div>

        {officerClubs.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (category) setNewCategory(category);
              setComposerOpen(true);
            }}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-xs hover:bg-[var(--primary-hover)]"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            <span>代表社團發起討論</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-[var(--muted)] px-4 py-2.5 text-xs font-medium text-slate-700">
            <Lock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span>
              僅認證社團幹部可代表社團發言與回覆（
              <Link href={isLoggedIn ? '/clubs/apply' : '/login'} className="font-bold text-blue-700 underline">
                {isLoggedIn ? '申請認領社團' : '登入／驗證'}
              </Link>
              ）
            </span>
          </div>
        )}
      </section>

      {/* Filters */}
      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => void loadThreads({ nextCategory: '' })}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold ${
              category === ''
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--muted)] text-slate-700 hover:bg-orange-100'
            }`}
          >
            全部分類板
          </button>
          {CLUB_CATEGORY_LIST.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => void loadThreads({ nextCategory: cat.value })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold ${
                category === cat.value
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--muted)] text-slate-700 hover:bg-orange-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">討論屬性：</span>
          <button
            type="button"
            onClick={() => void loadThreads({ nextTag: '' })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              tag === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            全部
          </button>
          {Object.entries(FORUM_TAGS).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                void loadThreads({ nextTag: tag === key ? '' : (key as ForumTag) })
              }
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                tag === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-blue-50'
              }`}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </section>

      {/* Thread List */}
      {loading && threads.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-white p-10 text-center">
          <p className="text-sm font-bold text-slate-900">此分類板目前尚無討論串</p>
          <p className="mt-1 text-xs text-slate-600">
            歡迎認證社團幹部發起第一個實務交流討論，累積跨校社團經驗庫。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((t) => {
            const catMeta = CLUB_CATEGORIES[t.category];
            const tagMeta = FORUM_TAGS[t.discussion_tag];
            return (
              <article
                key={t.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xs transition-colors hover:border-[var(--border-strong)] sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full border px-2.5 py-0.5 font-bold ${catMeta.badgeClass}`}>
                    {catMeta.label}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                    {tagMeta.label}
                  </span>
                  <Link
                    href={`/clubs/${t.club.slug}`}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    {t.club.university_short_name} · {t.club.name}
                  </Link>
                  {t.author_title && <span className="text-slate-500">（{t.author_title}）</span>}
                  {t.club.is_demo && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Demo
                    </span>
                  )}
                </div>

                <Link href={`/together/${t.id}`} className="mt-2 block space-y-1">
                  <h2 className="text-base font-bold text-slate-900 hover:text-[var(--primary)] sm:text-lg">
                    {t.title}
                  </h2>
                  <p className="line-clamp-2 text-sm text-slate-600">{t.content_md}</p>
                </Link>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{t.reply_count} 則社團回覆</span>
                  <span>最後更新：{formatTaipeiDateTime(t.last_activity_at)}</span>
                </div>
              </article>
            );
          })}

          {nextCursor && (
            <div className="pt-2 text-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadThreads({ cursor: nextCursor, append: true })}
                className="rounded-xl border border-[var(--border-strong)] bg-white px-5 py-2 text-xs font-bold text-slate-800 hover:bg-orange-50"
              >
                {loading ? '載入中...' : '載入更早的討論'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Composer Modal */}
      {composerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="代表社團發起討論"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-lg font-extrabold text-slate-900">代表社團發起討論</h2>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  本次代表發言社團
                </label>
                <select
                  value={actingClubId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setActingClubId(id);
                    const found = officerClubs.find((c) => c.club_id === id);
                    if (found?.default_title) setAuthorTitle(found.default_title);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {officerClubs.map((c) => (
                    <option key={c.club_id} value={c.club_id}>
                      {c.university_short_name} · {c.club_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">分類板</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ClubCategory)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {CLUB_CATEGORY_LIST.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">討論屬性</label>
                  <select
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value as ForumTag)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {Object.entries(FORUM_TAGS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  幹部職稱（選填，公開顯示於社團旁）
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={authorTitle}
                  onChange={(e) => setAuthorTitle(e.target.value)}
                  placeholder="例如：社長、器材長、活動組長"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">討論標題</label>
                <input
                  type="text"
                  required
                  minLength={4}
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：跨校聯合影展的場地燈光與預算控制經驗分享"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  討論內容（支援 Markdown）
                </label>
                <textarea
                  rows={6}
                  required
                  minLength={10}
                  value={contentMd}
                  onChange={(e) => setContentMd(e.target.value)}
                  placeholder="請分享具體作法、遇到的問題或希望交流的方向（勿揭露私人電話或個資）。"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  參考連結（選填）
                </label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {formError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                >
                  {submitting ? '發布中...' : '發布討論'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
