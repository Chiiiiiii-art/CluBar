'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Lock, ThumbsUp } from 'lucide-react';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import { CLUB_CATEGORIES, FORUM_TAGS } from '@/lib/constants';
import type { PublicForumReplyDTO, PublicForumThreadDTO } from '@/lib/serializers';
import { MarkdownView } from './MarkdownView';
import { ReportModal } from './ReportModal';
import type { OfficerClubOption } from './TogetherClient';

export function ThreadDetailClient({
  thread,
  initialReplies,
  officerClubs,
  isLoggedIn,
}: {
  thread: PublicForumThreadDTO;
  initialReplies: PublicForumReplyDTO[];
  officerClubs: OfficerClubOption[];
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [replies, setReplies] = useState<PublicForumReplyDTO[]>(initialReplies);
  const [actingClubId, setActingClubId] = useState(officerClubs[0]?.club_id ?? '');
  const [authorTitle, setAuthorTitle] = useState(officerClubs[0]?.default_title ?? '');
  const [contentMd, setContentMd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catMeta = CLUB_CATEGORIES[thread.category];
  const tagMeta = FORUM_TAGS[thread.discussion_tag];

  const toggleHelpful = async (replyId: string, currentMarked: boolean) => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !currentMarked;
    const prevHasMarks =
      replies.find((r) => r.id === replyId)?.has_helpful_marks ?? false;
    setReplies((prev) =>
      prev.map((r) =>
        r.id === replyId
          ? {
              ...r,
              marked_helpful_by_me: next,
              has_helpful_marks: next ? true : r.has_helpful_marks,
            }
          : r
      )
    );
    const res = await fetch(`/api/forum/replies/${replyId}/helpful`, {
      method: next ? 'POST' : 'DELETE',
    });
    if (!res.ok) {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? {
                ...r,
                marked_helpful_by_me: currentMarked,
                has_helpful_marks: prevHasMarks,
              }
            : r
        )
      );
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/forum/threads/${thread.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acting_club_id: actingClubId,
          content_md: contentMd,
          author_title: authorTitle.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '送出回覆失敗。');
        return;
      }
      setReplies((prev) => [...prev, json.reply]);
      setContentMd('');
    } catch {
      setError('網路連線異常，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/together"
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[var(--primary)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>回到一起聚討論流</span>
      </Link>

      {/* Main Thread */}
      <article className="rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-7">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-2.5 py-0.5 font-bold ${catMeta.badgeClass}`}>
            {catMeta.label}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
            {tagMeta.label}
          </span>
          <Link
            href={`/clubs/${thread.club.slug}`}
            className="font-bold text-blue-700 hover:underline"
          >
            {thread.club.university_short_name} · {thread.club.name}
          </Link>
          {thread.author_title && <span className="text-slate-500">（{thread.author_title}）</span>}
        </div>

        <h1 className="mt-3 text-xl font-extrabold text-slate-900 sm:text-2xl">
          {thread.title}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          發布於 {formatTaipeiDateTime(thread.created_at)}
        </p>

        <div className="mt-5">
          <MarkdownView content={thread.content_md} />
        </div>

        {thread.external_url && (
          <div className="mt-4">
            <a
              href={thread.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--muted)] px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              <span>參考外部連結</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
          <span className="text-xs text-slate-500">
            想與「{thread.club.name}」進一步合作？點擊上方社團名稱進入主頁聯絡。
          </span>
          <ReportModal
            targetType="forum_thread"
            targetId={thread.id}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </article>

      {/* Replies */}
      <section className="space-y-3">
        <h2 className="text-base font-extrabold text-slate-900">
          跨校經驗回覆（{replies.length} 則）
        </h2>

        {replies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-white p-6 text-center text-xs text-slate-600">
            目前尚無其他社團回覆，歡迎有相關經驗的認證社團分享作法。
          </div>
        ) : (
          replies.map((reply) => (
            <div
              key={reply.id}
              className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xs sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Link
                    href={`/clubs/${reply.club.slug}`}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    {reply.club.university_short_name} · {reply.club.name}
                  </Link>
                  {reply.author_title && (
                    <span className="text-slate-500">（{reply.author_title}）</span>
                  )}
                  <span className="text-slate-400">
                    {formatTaipeiDateTime(reply.created_at)}
                  </span>
                </div>
                <ReportModal
                  targetType="forum_reply"
                  targetId={reply.id}
                  isLoggedIn={isLoggedIn}
                />
              </div>

              <div className="mt-3">
                <MarkdownView content={reply.content_md} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void toggleHelpful(reply.id, reply.marked_helpful_by_me)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    reply.marked_helpful_by_me
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {reply.marked_helpful_by_me ? '已標記為有幫助的經驗' : '有幫助的經驗'}
                  </span>
                </button>
                {reply.has_helpful_marks && (
                  <span className="text-xs font-medium text-emerald-700">
                    有社團夥伴覺得這則經驗有幫助
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Reply Composer */}
      <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs">
        {officerClubs.length > 0 ? (
          <form onSubmit={handleReply} className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">代表社團回覆交流</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">代表社團</label>
                <select
                  value={actingClubId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setActingClubId(id);
                    const found = officerClubs.find((c) => c.club_id === id);
                    if (found?.default_title) setAuthorTitle(found.default_title);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                >
                  {officerClubs.map((c) => (
                    <option key={c.club_id} value={c.club_id}>
                      {c.university_short_name} · {c.club_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  職稱（選填）
                </label>
                <input
                  type="text"
                  maxLength={30}
                  value={authorTitle}
                  onChange={(e) => setAuthorTitle(e.target.value)}
                  placeholder="例如：社長、器材長"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <textarea
              rows={4}
              required
              minLength={4}
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              placeholder="分享貴社的實務經驗、注意事項或合作建議（支援 Markdown）。"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
              >
                {submitting ? '送出中...' : '送出社團回覆'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Lock className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>僅認證社團幹部可代表社團參與交流與回覆討論串。</span>
          </div>
        )}
      </section>
    </div>
  );
}
