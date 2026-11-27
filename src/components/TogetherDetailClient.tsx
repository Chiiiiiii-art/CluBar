'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MessageSquare, Repeat2 } from 'lucide-react';
import { TOGETHER_ITEM_TYPE_LABELS } from '@/lib/constants';
import type { PublicTogetherItemDTO } from '@/lib/serializers';
import { isAllowedEmbedUrl } from '@/lib/validators';

function toSafeIframeSrc(rawUrl: string): string | null {
  if (!isAllowedEmbedUrl(rawUrl)) return null;
  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (u.hostname === 'youtube.com' || u.hostname === 'www.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      if (u.pathname.startsWith('/embed/')) return rawUrl;
    }
    if (
      u.hostname === 'player.vimeo.com' ||
      u.hostname === 'w.soundcloud.com' ||
      u.hostname === 'itch.io' ||
      u.hostname.endsWith('.itch.io')
    ) {
      return rawUrl;
    }
    return null;
  } catch {
    return null;
  }
}

export function TogetherDetailClient({
  item,
  parentItem,
  initialReplies,
  rebounds,
  myClubs,
}: {
  item: PublicTogetherItemDTO;
  parentItem: { id: string; title: string; club_name: string } | null;
  initialReplies: {
    id: string;
    content_md: string;
    created_at: string;
    club: { slug: string; name: string; university_short_name: string };
  }[];
  rebounds: { id: string; title: string; club_name: string; created_at: string }[];
  myClubs: { clubId: string; name: string }[];
}) {
  const [replies, setReplies] = useState(initialReplies);
  const [replyText, setReplyText] = useState('');
  const [replyClubId, setReplyClubId] = useState(myClubs[0]?.clubId ?? '');
  const [showRebound, setShowRebound] = useState(false);
  const [rebTitle, setRebTitle] = useState(`Re: ${item.title}`);
  const [rebContent, setRebContent] = useState('');
  const [rebEmbed, setRebEmbed] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const iframeSrc = item.embed_url ? toSafeIframeSrc(item.embed_url) : null;

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setBusy('reply');
    setErr(null);
    try {
      const res = await fetch(`/api/together/items/${item.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: replyClubId || undefined,
          content_md: replyText.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '送出回覆失敗');
      setReplyText('');
      const refreshed = await fetch(`/api/together/items/${item.id}/replies`);
      if (refreshed.ok) {
        const j = await refreshed.json();
        setReplies(j.replies ?? []);
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '回覆失敗');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateRebound(e: React.FormEvent) {
    e.preventDefault();
    if (!replyClubId) return;
    setBusy('rebound');
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch('/api/together/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: replyClubId,
          domain_id: item.domain_id,
          item_type: 'rebound',
          parent_item_id: item.id,
          title: rebTitle.trim(),
          content_md: rebContent.trim(),
          embed_url: rebEmbed.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '發起 Rebound 失敗');
      setShowRebound(false);
      setRebContent('');
      setMsg(`Rebound 接力已發布！`);
      window.location.href = `/together/${json.item.id}`;
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '發起失敗');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl min-w-0 space-y-6 overflow-hidden pb-12">
      <Link
        href="/together"
        className="inline-flex min-h-[44px] items-center text-xs font-bold text-slate-600 hover:underline"
      >
        ← 返回一起聚
      </Link>

      {parentItem && (
        <div className="break-words rounded-2xl border border-orange-200 bg-[var(--surface-warm)] px-4 py-3 text-xs">
          <Repeat2 className="mr-1.5 inline h-3.5 w-3.5 text-[var(--brand)]" aria-hidden="true" />
          接力回應自{' '}
          <Link
            href={`/together/${parentItem.id}`}
            className="break-words font-bold text-[var(--brand)] underline"
          >
            {parentItem.club_name}｜{parentItem.title}
          </Link>
        </div>
      )}

      <article className="space-y-4 rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-orange-100 px-3 py-0.5 font-bold text-orange-900">
            #{item.domain_name}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-0.5 font-semibold text-slate-700">
            {TOGETHER_ITEM_TYPE_LABELS[item.item_type]}
          </span>
          <Link href={`/clubs/${item.club.slug}`} className="font-bold text-blue-700 hover:underline">
            {item.club.university_short_name} · {item.club.name}
          </Link>
        </div>

        <h1 className="text-2xl font-black text-slate-900">{item.title}</h1>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {item.content_md}
        </p>

        {iframeSrc && (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black/5">
            <iframe
              src={iframeSrc}
              title={item.title}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              className="aspect-video w-full"
            />
          </div>
        )}

        {item.embed_url && isAllowedEmbedUrl(item.embed_url) && (
          <a
            href={item.embed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
          >
            開啟作品連結
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}

        {myClubs.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setShowRebound((v) => !v)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white"
            >
              <Repeat2 className="h-3.5 w-3.5" aria-hidden="true" />
              接力回應此作品
            </button>
          </div>
        )}
      </article>

      {msg && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-800">{err}</div>
      )}

      {showRebound && myClubs.length > 0 && (
        <form
          onSubmit={handleCreateRebound}
          className="space-y-3 rounded-3xl border border-orange-200 bg-[var(--surface-warm)] p-6 text-xs"
        >
          <p className="font-bold text-slate-900">代表社團發布接力回應</p>
          <select
            value={replyClubId}
            onChange={(e) => setReplyClubId(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
          >
            {myClubs.map((c) => (
              <option key={c.clubId} value={c.clubId}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            required
            value={rebTitle}
            onChange={(e) => setRebTitle(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
          />
          <textarea
            required
            minLength={10}
            rows={3}
            value={rebContent}
            onChange={(e) => setRebContent(e.target.value)}
            placeholder="寫下你們社團基於原作延伸的玩法、二創音效或新設計..."
            className="w-full rounded-xl border border-[var(--border)] bg-white p-3"
          />
          <input
            type="url"
            value={rebEmbed}
            onChange={(e) => setRebEmbed(e.target.value)}
            placeholder="選填安全預覽連結（itch.io / YouTube / SoundCloud / GitHub 等）"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2"
          />
          <button
            type="submit"
            disabled={busy === 'rebound'}
            className="min-h-[44px] rounded-full bg-[var(--brand)] px-4 py-2 font-bold text-white"
          >
            送出接力作品
          </button>
        </form>
      )}

      {rebounds.length > 0 && (
        <section className="space-y-2 rounded-3xl border border-[var(--border)] bg-white p-6">
          <h2 className="text-sm font-extrabold text-slate-900">
            接力回應作品 ({rebounds.length})
          </h2>
          {rebounds.map((rb) => (
            <Link
              key={rb.id}
              href={`/together/${rb.id}`}
              className="block rounded-2xl bg-[var(--surface-warm)] p-3 text-xs hover:bg-orange-100/60"
            >
              <span className="font-bold text-slate-900">
                {rb.club_name}：{rb.title}
              </span>
            </Link>
          ))}
        </section>
      )}

      <section className="space-y-4 rounded-3xl border border-[var(--border)] bg-white p-6">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <MessageSquare className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />
          跨校交流討論串 ({replies.length})
        </h2>

        {myClubs.length > 0 ? (
          <form onSubmit={handleReply} className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <select
                value={replyClubId}
                onChange={(e) => setReplyClubId(e.target.value)}
                className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs"
              >
                {myClubs.map((c) => (
                  <option key={c.clubId} value={c.clubId}>
                    代表：{c.name}
                  </option>
                ))}
              </select>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="分享回饋、技術問題或邀約聯合測試..."
                className="min-w-0 flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy === 'reply' || replyText.trim().length < 2}
                className="rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                回覆
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-slate-500">
            認證社員或幹部登入並從「我的聚」代表社團後即可參與交流。
          </p>
        )}

        <div className="space-y-2.5">
          {replies.map((r) => (
            <div key={r.id} className="rounded-2xl bg-slate-50 p-3.5 text-xs">
              <Link
                href={`/clubs/${r.club.slug}`}
                className="font-bold text-blue-700 hover:underline"
              >
                {r.club.university_short_name} · {r.club.name}
              </Link>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.content_md}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
