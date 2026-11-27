'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MessageSquare, Repeat2 } from 'lucide-react';
import { TOGETHER_ITEM_TYPE_LABELS } from '@/lib/constants';
import type { PublicTogetherItemDTO } from '@/lib/serializers';
import { isAllowedEmbedUrl } from '@/lib/validators';

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Notice,
  Section,
  Select,
  Textarea,
  buttonClasses,
} from '@/components/ui';

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

  const clubLine = `${item.club.university_short_name} · ${item.club.name}`;

  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-8 pb-12">
      <ButtonLink href="/together" variant="ghost" size="sm" className="-ml-3">
        ← 返回一起聚
      </ButtonLink>

      {parentItem && (
        <Notice tone="info">
          <span className="inline-flex flex-wrap items-center gap-x-1 break-words">
            <Repeat2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            接力回應自
            <Link
              href={`/together/${parentItem.id}`}
              className="min-w-0 break-words font-semibold underline [overflow-wrap:anywhere]"
            >
              {parentItem.club_name}｜{parentItem.title}
            </Link>
          </span>
        </Notice>
      )}

      <article className="min-w-0 space-y-5">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">#{item.domain_name}</Badge>
            <Badge>{TOGETHER_ITEM_TYPE_LABELS[item.item_type]}</Badge>
          </div>
          <h1 className="break-words text-2xl font-bold leading-snug text-ink-900 sm:text-3xl">
            {item.title}
          </h1>
          <p className="text-sm text-ink-600">
            <Link
              href={`/clubs/${item.club.slug}`}
              className="inline-flex min-h-11 items-center break-words font-medium text-ink-800 hover:text-accent-700 hover:underline"
            >
              {clubLine}
            </Link>
          </p>
        </header>

        <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-ink-800">
          {item.content_md}
        </p>

        {iframeSrc && (
          <div className="overflow-hidden rounded-xl border border-line bg-ink-100">
            <iframe
              src={iframeSrc}
              title={item.title}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              className="aspect-video w-full"
            />
          </div>
        )}

        {(myClubs.length > 0 || (item.embed_url && isAllowedEmbedUrl(item.embed_url))) && (
          <div className="flex flex-wrap items-center gap-2">
            {myClubs.length > 0 && (
              <Button
                variant="primary"
                aria-expanded={showRebound}
                onClick={() => setShowRebound((v) => !v)}
                icon={<Repeat2 className="h-4 w-4" aria-hidden="true" />}
              >
                接力回應此作品
              </Button>
            )}
            {item.embed_url && isAllowedEmbedUrl(item.embed_url) && (
              <a
                href={item.embed_url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses({ variant: 'secondary', size: 'md' })}
              >
                開啟作品連結
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </article>

      {msg && <Notice tone="success">{msg}</Notice>}
      {err && <Notice tone="danger">{err}</Notice>}

      {showRebound && myClubs.length > 0 && (
        <Card>
          <form onSubmit={handleCreateRebound} className="space-y-4">
            <h2 className="text-lg font-semibold text-ink-900">代表社團發布接力回應</h2>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="together-detail-replyclubid" className="block text-sm font-medium text-ink-800">
                代表社團
              </label>
              <Select
                id="together-detail-replyclubid"
                value={replyClubId}
                onChange={(e) => setReplyClubId(e.target.value)}
              >
                {myClubs.map((c) => (
                  <option key={c.clubId} value={c.clubId}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="together-detail-rebtitle" className="block text-sm font-medium text-ink-800">
                標題
              </label>
              <Input
                id="together-detail-rebtitle"
                required
                value={rebTitle}
                onChange={(e) => setRebTitle(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="together-detail-rebcontent" className="block text-sm font-medium text-ink-800">
                延伸內容
              </label>
              <Textarea
                id="together-detail-rebcontent"
                required
                minLength={10}
                rows={3}
                value={rebContent}
                onChange={(e) => setRebContent(e.target.value)}
                placeholder="寫下你們社團基於原作延伸的玩法、二創音效或新設計..."
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="together-detail-rebembed" className="block text-sm font-medium text-ink-800">
                預覽連結（選填）
              </label>
              <Input
                id="together-detail-rebembed"
                type="url"
                value={rebEmbed}
                onChange={(e) => setRebEmbed(e.target.value)}
                placeholder="選填安全預覽連結（itch.io / YouTube / SoundCloud / GitHub 等）"
              />
            </div>
            <Button type="submit" loading={busy === 'rebound'}>
              送出接力作品
            </Button>
          </form>
        </Card>
      )}

      {rebounds.length > 0 && (
        <Section title={`接力回應作品 (${rebounds.length})`}>
          <ul className="divide-y divide-line border-y border-line">
            {rebounds.map((rb) => (
              <li key={rb.id}>
                <Link
                  href={`/together/${rb.id}`}
                  className="flex min-h-11 items-center break-words py-3 text-sm hover:bg-ink-50"
                >
                  <span className="font-semibold text-ink-900">
                    {rb.club_name}：{rb.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-accent-600" aria-hidden="true" />
            跨校交流討論串 ({replies.length})
          </span>
        }
      >
        {myClubs.length > 0 ? (
          <Card>
            <form onSubmit={handleReply} className="space-y-4">
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="together-detail-replyclubid-2" className="block text-sm font-medium text-ink-800">
                  代表社團
                </label>
                <Select
                  id="together-detail-replyclubid-2"
                  value={replyClubId}
                  onChange={(e) => setReplyClubId(e.target.value)}
                >
                  {myClubs.map((c) => (
                    <option key={c.clubId} value={c.clubId}>
                      代表：{c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="together-detail-replytext" className="block text-sm font-medium text-ink-800">
                  回覆
                </label>
                <Input
                  id="together-detail-replytext"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="分享回饋、技術問題或邀約聯合測試..."
                />
              </div>
              <Button
                type="submit"
                loading={busy === 'reply'}
                disabled={replyText.trim().length < 2}
              >
                回覆
              </Button>
            </form>
          </Card>
        ) : (
          <Notice tone="info">認證社員或幹部登入並從「我的聚」代表社團後即可參與交流。</Notice>
        )}

        {replies.length === 0 ? (
          <EmptyState
            title="還沒有人回覆"
            description="成為第一個分享回饋或邀約聯合測試的社團。"
          />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {replies.map((r) => (
              <li key={r.id} className="min-w-0 space-y-1 py-4">
                <Link
                  href={`/clubs/${r.club.slug}`}
                  className="inline-flex min-h-8 items-center break-words text-sm font-semibold text-accent-700 hover:underline"
                >
                  {r.club.university_short_name} · {r.club.name}
                </Link>
                <p className="whitespace-pre-wrap break-words text-base text-ink-800">{r.content_md}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
