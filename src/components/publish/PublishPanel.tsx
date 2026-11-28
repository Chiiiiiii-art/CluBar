'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Globe,
  MessageCircle,
  MessagesSquare,
  Send,
} from 'lucide-react';
import { Badge, Button, Notice, Skeleton, controlClasses } from '@/components/ui';
import { completeFlow } from '@/lib/flow';
import { downloadImage, lineShareUrl, preloadShareImage, shareImage, trackShareEvent } from '@/lib/share';

// Officer "publish complete" panel (docs/one-stop-publish-solution.md §3.5, phase 1).

interface PromoPack {
  event_url: string;
  og_story_image_url: string;
  og_feed_image_url: string;
  line_message: string;
  discord_markdown: string;
  ig_caption: string;
}

type ChannelId = 'clubar' | 'discord' | 'line' | 'ig';
type RowState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

function StatusLine({ state, idleText }: { state: RowState; idleText: string }) {
  if (state.kind === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-fg">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {state.text}
      </span>
    );
  }
  if (state.kind === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-danger-fg">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        沒發出去
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm text-fg-muted">
      <Circle className="h-4 w-4" aria-hidden="true" />
      {state.kind === 'busy' ? '處理中…' : idleText}
    </span>
  );
}

function ChannelRow({
  icon,
  name,
  state,
  idleText,
  actions,
  children,
}: {
  icon: ReactNode;
  name: string;
  state: RowState;
  idleText: string;
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="space-y-3 rounded-xl bg-surface-subtle p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-fg-secondary">{icon}</span>
          <span className="font-display text-sm font-bold text-fg">{name}</span>
          <StatusLine state={state} idleText={idleText} />
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {state.kind === 'error' && <p className="text-sm text-danger-fg">{state.text}</p>}
      {children}
    </li>
  );
}

function EditableText({
  label,
  value,
  edited,
  onChange,
}: {
  label: string;
  value: string;
  edited: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-fg-secondary">
        修改 {label}
        {edited && <Badge tone="accent">已自訂</Badge>}
      </summary>
      <textarea
        aria-label={`${label}（可直接修改）`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className={`${controlClasses} mt-2 w-full py-2 text-sm leading-relaxed`}
      />
    </details>
  );
}

export function PublishPanel({
  shortCode,
  clubId,
  eventId,
  title,
  discordConfigured,
  onOpenSettings,
}: {
  shortCode: string;
  clubId: string;
  clubSlug: string;
  eventId: string;
  title: string;
  discordConfigured: boolean;
  onOpenSettings?: () => void;
}) {
  const [pack, setPack] = useState<PromoPack | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Partial<Record<'discord' | 'line' | 'ig', string>>>({});
  const [rows, setRows] = useState<Record<ChannelId, RowState>>({
    clubar: { kind: 'idle' },
    discord: { kind: 'idle' },
    line: { kind: 'idle' },
    ig: { kind: 'idle' },
  });
  const [isMobile, setIsMobile] = useState(false);
  const tracked = useRef(false);

  useEffect(() => {
    setIsMobile(window.matchMedia('(pointer: coarse)').matches && typeof navigator.share === 'function');
    if (!tracked.current) {
      tracked.current = true;
      trackShareEvent({ type: 'event_publish_started', clubId, targetId: eventId, surface: 'publish_panel' });
    }
    let alive = true;
    fetch(`/api/events/${shortCode}/promo-pack`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || '讀不到宣傳素材');
        if (alive) {
          setPack(json);
          preloadShareImage(json.og_story_image_url, `${shortCode}-story.png`);
        }
      })
      .catch((err) => alive && setLoadError(err instanceof Error ? err.message : '讀不到宣傳素材'));
    return () => {
      alive = false;
    };
  }, [shortCode, clubId, eventId]);

  const setRow = (id: ChannelId, state: RowState) => {
    setRows((prev) => ({ ...prev, [id]: state }));
    // Timing baseline (audit P0-2): the first channel that goes out ends the officer task; later calls no-op.
    if (state.kind === 'done') completeFlow('officer_publish', { surface: `publish_${id === 'clubar' ? 'link' : id}`, clubId, targetId: eventId });
  };
  const track = (surface: string) =>
    trackShareEvent({ type: 'event_publish_channel', clubId, targetId: eventId, surface });

  if (loadError) return <Notice tone="danger">{loadError}</Notice>;
  if (!pack) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  const text = {
    discord: edits.discord ?? pack.discord_markdown,
    line: edits.line ?? pack.line_message,
    ig: edits.ig ?? pack.ig_caption,
  };
  const edit = (id: keyof typeof text) => (v: string) => setEdits((prev) => ({ ...prev, [id]: v }));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pack!.event_url);
      setRow('clubar', { kind: 'done', text: '連結已複製' });
    } catch {
      setRow('clubar', { kind: 'error', text: '複製失敗，請手動選取上面的連結。' });
    }
    track('publish_copy_link');
  }

  async function sendDiscord() {
    setRow('discord', { kind: 'busy' });
    track('publish_discord');
    try {
      const res = await fetch(`/api/events/${shortCode}/publish/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.discord.slice(0, 2000) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || '發到 Discord 失敗，請稍後再試。');
      setRow('discord', { kind: 'done', text: '已發出' });
    } catch (err) {
      setRow('discord', { kind: 'error', text: err instanceof Error ? err.message : '發到 Discord 失敗，請稍後再試。' });
    }
  }

  function openLine() {
    window.open(lineShareUrl(text.line), '_blank', 'noopener,noreferrer');
    setRow('line', { kind: 'done', text: '已開啟 LINE，選群組後送出' });
    track('publish_line');
  }

  async function shareIg() {
    setRow('ig', { kind: 'busy' });
    track('publish_ig');
    // Not awaited before share(): iOS loses the tap's activation across awaits.
    const copy = navigator.clipboard.writeText(text.ig).then(
      () => true,
      () => false
    );
    if (isMobile) {
      const outcome = await shareImage({
        title,
        imageUrl: pack!.og_story_image_url,
        fileName: `${shortCode}-story.png`,
      });
      const copied = await copy;
      if (outcome === 'failed') {
        setRow('ig', { kind: 'error', text: '手機不支援直接分享，請改用下載圖片。' });
        return;
      }
      setRow(
        'ig',
        outcome === 'cancelled'
          ? { kind: 'idle' }
          : { kind: 'done', text: copied ? '文案已複製，貼到 IG' : '已開啟分享，文案請手動複製' }
      );
      return;
    }
    const copied = await copy;
    const [feed, story] = await Promise.all([
      downloadImage(pack!.og_feed_image_url, `${shortCode}-post.png`),
      downloadImage(pack!.og_story_image_url, `${shortCode}-story.png`),
    ]);
    if (feed === 'failed' && story === 'failed') {
      setRow('ig', { kind: 'error', text: '圖片下載失敗，請稍後再試。' });
      return;
    }
    setRow('ig', {
      kind: 'done',
      text: copied ? '圖片已下載、文案已複製，用手機貼到 IG' : '圖片已下載，文案請手動複製',
    });
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        <ChannelRow
          icon={<Globe className="h-4 w-4" aria-hidden="true" />}
          name="CluBar 活動頁"
          state={rows.clubar.kind === 'idle' ? { kind: 'done', text: '已上線' } : rows.clubar}
          idleText=""
          actions={
            <Button variant="secondary" size="sm" icon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />} onClick={copyLink}>
              複製連結
            </Button>
          }
        >
          <a href={pack.event_url} target="_blank" rel="noopener noreferrer" className="block break-all text-sm font-semibold text-fg underline">
            {pack.event_url}
          </a>
        </ChannelRow>

        <ChannelRow
          icon={<MessagesSquare className="h-4 w-4" aria-hidden="true" />}
          name="Discord"
          state={rows.discord}
          idleText={discordConfigured ? '還沒發' : '還沒設定頻道'}
          actions={
            discordConfigured ? (
              <Button
                size="sm"
                loading={rows.discord.kind === 'busy'}
                disabled={!text.discord.trim()}
                icon={<Send className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={sendDiscord}
              >
                發到 Discord
              </Button>
            ) : onOpenSettings ? (
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                設定 Discord 頻道
              </Button>
            ) : null
          }
        >
          {discordConfigured ? (
            <EditableText label="Discord 公告" value={text.discord} edited={edits.discord !== undefined} onChange={edit('discord')} />
          ) : (
            <p className="text-sm text-fg-muted">在「發布管道」貼一次頻道 Webhook 網址，之後就能一鍵發到 Discord。</p>
          )}
        </ChannelRow>

        <ChannelRow
          icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
          name="LINE 群組"
          state={rows.line}
          idleText="還沒分享"
          actions={
            <Button variant="secondary" size="sm" disabled={!text.line.trim()} onClick={openLine}>
              開啟 LINE 選群組
            </Button>
          }
        >
          <EditableText label="LINE 公告" value={text.line} edited={edits.line !== undefined} onChange={edit('line')} />
        </ChannelRow>

        <ChannelRow
          icon={<Camera className="h-4 w-4" aria-hidden="true" />}
          name="Instagram"
          state={rows.ig}
          idleText="還沒分享"
          actions={
            <Button
              variant="secondary"
              size="sm"
              loading={rows.ig.kind === 'busy'}
              icon={isMobile ? undefined : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
              onClick={shareIg}
            >
              {isMobile ? '開啟 IG 分享' : '下載圖片並複製文案'}
            </Button>
          }
        >
          <p className="text-sm text-fg-muted">
            {isMobile
              ? '會先複製文案，再跳出分享選單，選 Instagram 發限動。'
              : '會下載貼文圖（4:5）與限動圖（9:16），並複製文案，傳到手機後發 IG。'}
          </p>
          <EditableText label="IG 文案" value={text.ig} edited={edits.ig !== undefined} onChange={edit('ig')} />
        </ChannelRow>
      </ul>
    </div>
  );
}
