'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  Lock,
  MapPin,
  MessageSquare,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type { MediaItem, RsvpPrivacyMode, RsvpStatus } from '@/db/schema';
import { EVENT_THEME_PRESETS, LEARNING_HOURS_LABELS } from '@/lib/constants';
import { uploadDualAlbumPhoto } from '@/lib/media/client-upload';
import type { EventFullViewDTO } from '@/lib/services/events';
import { ImageUploader } from '@/components/ImageUploader';
import { MarkdownView } from '@/components/MarkdownView';
import { Badge, Button, ButtonLink, ClubMark, Notice, buttonClasses, controlClasses, useConfirm } from '@/components/ui';
import { realMediaUrl } from '@/lib/media/placeholder';

function formatUtcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function formatDisplayTime(iso: string | null): string {
  if (!iso) return '時間待定（TBD）';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

function buildGoogleCalendarHref(detail: EventFullViewDTO['detail']): string | null {
  if (!detail.starts_at) return null;
  const start = new Date(detail.starts_at);
  const end = detail.ends_at
    ? new Date(detail.ends_at)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', detail.title);
  url.searchParams.set('dates', `${formatUtcStamp(start.toISOString())}/${formatUtcStamp(end.toISOString())}`);
  url.searchParams.set('location', detail.location_text);
  url.searchParams.set('details', detail.summary || detail.title);
  return url.toString();
}

function buildOutlookCalendarHref(detail: EventFullViewDTO['detail']): string | null {
  if (!detail.starts_at) return null;
  const start = new Date(detail.starts_at);
  const end = detail.ends_at
    ? new Date(detail.ends_at)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  url.searchParams.set('path', '/calendar/action/compose');
  url.searchParams.set('rru', 'addevent');
  url.searchParams.set('subject', detail.title);
  url.searchParams.set('startdt', start.toISOString());
  url.searchParams.set('enddt', end.toISOString());
  url.searchParams.set('location', detail.location_text);
  url.searchParams.set('body', detail.summary || detail.title);
  return url.toString();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function EventPageClient({
  initialData,
  viewer,
  authProviders = { hasEntra: true, hasGoogle: false, enableDevLogin: false },
}: {
  initialData: EventFullViewDTO;
  viewer: {
    isLoggedIn: boolean;
    isCampusVerified: boolean;
    universityId: string | null;
  };
  authProviders?: {
    hasEntra: boolean;
    hasGoogle: boolean;
    enableDevLogin: boolean;
  };
}) {
  const confirm = useConfirm();
  const [data, setData] = useState<EventFullViewDTO>(initialData);
  const [privacyMode, setPrivacyMode] = useState<RsvpPrivacyMode>(
    initialData.viewer_rsvp?.privacy_mode ?? 'public_to_attendees'
  );
  const [displayAlias, setDisplayAlias] = useState(
    initialData.viewer_rsvp?.display_alias ?? ''
  );
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [commentText, setCommentText] = useState('');
  const [albumCaption, setAlbumCaption] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  // Officer panel states
  const [officerTab, setOfficerTab] = useState<
    'none' | 'curation' | 'promo' | 'broadcast' | 'attendance' | 'edit'
  >('none');
  const [promoPack, setPromoPack] = useState<{
    event_url: string;
    og_story_image_url: string;
    line_message: string;
    discord_markdown: string;
    ig_caption: string;
  } | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [attendanceList, setAttendanceList] = useState<
    {
      user_id: string;
      display_name: string;
      privacy_mode: string;
      attended: boolean;
    }[]
  >([]);
  const [coverItems, setCoverItems] = useState<MediaItem[]>(
    initialData.detail.cover_media
      ? [
          {
            kind: 'image',
            url: initialData.detail.cover_media.url,
            width: initialData.detail.cover_media.width,
            height: initialData.detail.cover_media.height,
            alt: initialData.detail.cover_media.alt,
          },
        ]
      : []
  );

  const { detail, poll_options, comments, album_photos, pending_album_photos, viewer_rsvp, permissions } =
    data;
  const theme = EVENT_THEME_PRESETS[detail.theme_preset] ?? EVENT_THEME_PRESETS.warm_paper;

  const campusRestricted =
    detail.campus_only &&
    (!viewer.isCampusVerified || viewer.universityId !== detail.club.university_id);

  const hiddenGoingCount = Math.max(0, detail.going_count - detail.public_attendees.length);
  const featuredCount = album_photos.filter((p) => p.status === 'featured_stream').length;
  const googleUrl = buildGoogleCalendarHref(detail);
  const outlookUrl = buildOutlookCalendarHref(detail);

  async function refreshEvent() {
    const res = await fetch(`/api/events/${detail.short_code}`, { cache: 'no-store' });
    if (res.ok) {
      const next = (await res.json()) as EventFullViewDTO;
      setData(next);
    }
  }

  async function handleRsvp(nextStatus: RsvpStatus) {
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyAction(`rsvp-${nextStatus}`);
    try {
      const res = await fetch(`/api/events/${detail.short_code}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          privacy_mode: privacyMode,
          display_alias: displayAlias.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '更新報名狀態失敗');
      await refreshEvent();
      setStatusMessage(
        nextStatus === 'going'
          ? '已確認報名參加！記得加入行事曆並查看行前提醒。'
          : nextStatus === 'interested'
            ? '已標記為有興趣。'
            : '已取消報名。'
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '操作失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePollVote(optionId: string) {
    if (!viewer.isLoggedIn) return;
    setErrorMessage(null);
    setBusyAction(`vote-${optionId}`);
    try {
      const res = await fetch(`/api/events/${detail.short_code}/poll-vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_id: optionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '投票失敗');
      await refreshEvent();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '投票失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLockPollOption(optionId: string) {
    setErrorMessage(null);
    setBusyAction(`lock-${optionId}`);
    try {
      const res = await fetch(`/api/events/${detail.short_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lock_poll_option_id: optionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '鎖定時段失敗');
      await refreshEvent();
      setStatusMessage('已鎖定活動時段並更新行事曆版本！');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '鎖定時段失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setErrorMessage(null);
    setBusyAction('comment');
    try {
      const res = await fetch(`/api/events/${detail.short_code}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '發布留言失敗');
      setCommentText('');
      await refreshEvent();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '留言失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteComment(commentId: string) {
    setErrorMessage(null);
    setBusyAction(`del-comment-${commentId}`);
    try {
      const res = await fetch(`/api/events/${detail.short_code}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || '刪除留言失敗');
      }
      await refreshEvent();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '刪除失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAlbumFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!consentConfirmed) {
      setErrorMessage('請先勾選確認未侵犯他人肖像權並同意社團收錄相簿。');
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setBusyAction('album-upload');
    try {
      const uploaded = await uploadDualAlbumPhoto(detail.id, file);
      const res = await fetch(`/api/events/${detail.short_code}/album`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploaded,
          caption: albumCaption.trim() || null,
          consent_confirmed: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '相簿記錄儲存失敗');
      setAlbumCaption('');
      await refreshEvent();
      setStatusMessage('原圖與預覽圖已上傳！等待主辦幹部審核確認後即公開於活動相簿。');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '上傳失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCuratePhoto(
    photoId: string,
    action: 'approve' | 'feature' | 'reject'
  ) {
    setErrorMessage(null);
    setBusyAction(`curate-${photoId}`);
    try {
      const res = await fetch(`/api/events/${detail.short_code}/album/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '策展審核失敗');
      await refreshEvent();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '策展審核失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyWebcal() {
    setErrorMessage(null);
    setBusyAction('webcal');
    try {
      const res = await fetch('/api/me/calendar-token');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '無法取得個人行事曆連結');
      await navigator.clipboard.writeText(json.webcal_url);
      setStatusMessage('已複製你的專屬 webcal:// 行事曆訂閱網址！可直接加入 Apple／Google 日曆。');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '複製失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEnableWebPush() {
    setErrorMessage(null);
    setBusyAction('web-push');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('目前瀏覽器不支援 Web Push 通知，系統將改以站內通知與 Email 寄送提醒。');
      }
      const keyRes = await fetch('/api/me/push-subscriptions');
      const keyJson = await keyRes.json();
      if (!keyJson?.vapid_public_key) {
        setStatusMessage('已開啟站內與 Email 行前提醒（瀏覽器推播金鑰未於本環境啟用）。');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('你未允許瀏覽器推播權限，系統仍會以站內與 Email 通知你。');
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.vapid_public_key) as BufferSource,
      });
      const subJson = sub.toJSON();
      const saveRes = await fetch('/api/me/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });
      if (!saveRes.ok) throw new Error('儲存推播訂閱失敗');
      setStatusMessage('已啟用瀏覽器即時通知！異動時將第一時間推送提醒。');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '無法啟用推播');
    } finally {
      setBusyAction(null);
    }
  }

  async function openOfficerTab(tab: typeof officerTab) {
    const next = officerTab === tab ? 'none' : tab;
    setOfficerTab(next);
    if (next === 'promo' && !promoPack) {
      const res = await fetch(`/api/events/${detail.short_code}/promo-pack`);
      if (res.ok) setPromoPack(await res.json());
    }
    if (next === 'attendance') {
      const res = await fetch(`/api/events/${detail.short_code}/attendance`);
      if (res.ok) {
        const json = await res.json();
        setAttendanceList(json.attendees ?? []);
      }
    }
  }

  async function handleCopyPromoText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setStatusMessage(`已複製「${label}」宣傳文案！`);
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'event_promo_copy',
        club_id: detail.club.id,
        target_id: detail.id,
        source_surface: 'event_promo_pack',
      }),
    }).catch(() => {});
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setErrorMessage(null);
    setBusyAction('broadcast');
    try {
      const res = await fetch(`/api/events/${detail.short_code}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '發送通知失敗');
      setBroadcastMessage('');
      setStatusMessage(
        `已發送至 ${json.recipient_count} 位報名者（推播 ${json.push_sent} 筆、Email 備援 ${json.email_fallback_sent} 筆）。`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : '發送通知失敗');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleAttendance(userId: string, attended: boolean) {
    setBusyAction(`att-${userId}`);
    try {
      const res = await fetch(`/api/events/${detail.short_code}/attendance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, attended }),
      });
      if (res.ok) {
        setAttendanceList((prev) =>
          prev.map((row) => (row.user_id === userId ? { ...row, attended } : row))
        );
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveCover(items: MediaItem[]) {
    setCoverItems(items);
    const first = items[0];
    setBusyAction('save-cover');
    try {
      const res = await fetch(`/api/events/${detail.short_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cover_media: first
            ? {
                url: first.url,
                width: first.width ?? 1280,
                height: first.height ?? 720,
                alt: first.alt ?? detail.title,
              }
            : null,
        }),
      });
      if (res.ok) {
        await refreshEvent();
        setStatusMessage('活動單圖封面已更新。');
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCancelEvent() {
    if (
      !(await confirm({
        title: '取消這場活動？',
        description: '已報名的人會在行事曆看到活動被取消。',
        confirmLabel: '取消活動',
        cancelLabel: '先不要',
      }))
    ) {
      return;
    }
    setBusyAction('cancel-event');
    try {
      const res = await fetch(`/api/events/${detail.short_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        await refreshEvent();
        setStatusMessage('活動已標記為取消，行事曆版次已更新。');
      }
    } finally {
      setBusyAction(null);
    }
  }

  const coverRatio =
    detail.cover_media && detail.cover_media.width > 0 && detail.cover_media.height > 0
      ? Math.max(0.7, Math.min(2.2, detail.cover_media.width / detail.cover_media.height))
      : 16 / 9;

  const loginCtaLabel = authProviders.hasGoogle && authProviders.hasEntra
    ? '使用 Google／微軟登入即可報名'
    : authProviders.hasEntra
      ? '使用微軟／校園帳號登入報名'
      : '登入帳號即可一鍵報名';

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 md:pb-12">
      {detail.status === 'cancelled' && (
        <Notice tone="danger" title="此活動已取消">
          行事曆版次 v.{detail.ics_sequence} 已標記取消。
        </Notice>
      )}
      {statusMessage && <Notice tone="success">{statusMessage}</Notice>}
      {errorMessage && <Notice tone="danger">{errorMessage}</Notice>}

      {/* Hero: cover first on mobile, title + key facts beside it on desktop */}
      <section className="grid gap-6 md:grid-cols-12 md:items-start md:gap-8">
        <div className="md:order-2 md:col-span-5">
          {realMediaUrl(detail.cover_media?.url) ? (
            <div
              className="overflow-hidden rounded-xl bg-ink-100"
              style={{ aspectRatio: String(coverRatio) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detail.cover_media!.url}
                alt={detail.cover_media!.alt || detail.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`flex aspect-video items-end rounded-xl bg-gradient-to-br p-5 ${theme.gradientClass}`}
            >
              <ClubMark name={detail.club.name} seed={detail.club.id} size="lg" />
            </div>
          )}
        </div>

        <div className="space-y-5 md:order-1 md:col-span-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <Link
                href={`/clubs/${detail.club.slug}`}
                className="inline-flex min-h-8 items-center font-medium text-ink-700 hover:text-ink-900 hover:underline"
              >
                {detail.club.name}
                <span className="ml-1 font-normal text-ink-500">· {detail.club.university_short_name}</span>
              </Link>
              {detail.co_host_clubs.map((co) => (
                <Link
                  key={co.id}
                  href={`/clubs/${co.slug}`}
                  className="inline-flex min-h-8 items-center text-ink-600 hover:text-ink-900 hover:underline"
                >
                  × {co.name}
                </Link>
              ))}
            </div>
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{detail.title}</h1>
            {detail.summary && <p className="text-base text-ink-600">{detail.summary}</p>}
          </div>

          <dl className="divide-y divide-line rounded-xl border border-line bg-white">
            <div className="flex items-start gap-3 px-4 py-3">
              <dt className="mt-0.5">
                <Clock className="h-5 w-5 text-ink-500" aria-hidden="true" />
                <span className="sr-only">時間</span>
              </dt>
              <dd className="text-base font-medium text-ink-900">
                {formatDisplayTime(detail.starts_at)}
                {detail.ics_sequence > 0 && (
                  <span className="ml-2 align-middle">
                    <Badge tone="warning">時間已更新</Badge>
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <dt className="mt-0.5">
                <MapPin className="h-5 w-5 text-ink-500" aria-hidden="true" />
                <span className="sr-only">地點</span>
              </dt>
              <dd className="text-base font-medium text-ink-900">{detail.location_text}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Main Grid: Left (Checklist, Poll, Description) & Right (RSVP, Attendees, Calendar) */}
      <div className="grid gap-6 md:grid-cols-12">
        <div className="space-y-6 md:col-span-7">
          {/* Beginner Checklist */}
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink-900">參加條件</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`rounded-md px-2.5 py-1 text-sm font-medium ${
                  detail.beginner_friendly
                    ? 'bg-success-50 text-success-800 border border-success-200'
                    : 'bg-ink-100 text-ink-700'
                }`}
              >
                {detail.beginner_friendly ? '零基礎可' : '建議有基礎'}
              </span>
              <span
                className={`rounded-md px-2.5 py-1 text-sm font-medium ${
                  detail.non_members_welcome
                    ? 'bg-accent-50 text-accent-800 border border-accent-200'
                    : 'bg-ink-100 text-ink-700'
                }`}
              >
                {detail.non_members_welcome ? '非社員可參加' : '限社員'}
              </span>
              <span className="rounded-md border border-accent-200 bg-accent-50 px-2.5 py-1 text-sm font-medium text-accent-800">
                {detail.fee_ntd > 0 ? `NT$ ${detail.fee_ntd}` : '免費'}
              </span>
              {detail.learning_hours_category !== 'none' && detail.learning_hours_count > 0 && (
                <span className="rounded-md border border-warning-200 bg-warning-50 px-2.5 py-1 text-sm font-medium text-warning-900">
                  {LEARNING_HOURS_LABELS[detail.learning_hours_category]} {detail.learning_hours_count} 小時
                </span>
              )}
              {detail.campus_only && (
                <span className="rounded-md border border-ink-300 bg-ink-100 px-2.5 py-1 text-sm font-medium text-ink-800">
                  校內限定（須驗證 {detail.club.university_short_name} .edu.tw）
                </span>
              )}
            </div>
            {detail.fee_note && (
              <p className="mt-3 text-sm text-ink-600">費用說明：{detail.fee_note}</p>
            )}
            {detail.pre_event_notes && (
              <div className="mt-4 rounded-xl bg-ink-50 p-3.5 text-sm leading-relaxed text-ink-700">
                <span className="font-bold text-ink-900">行前提醒：</span>
                {detail.pre_event_notes}
              </div>
            )}
          </section>

          {/* Find a Time / Poll Section */}
          {(detail.schedule_mode !== 'scheduled' || poll_options.length > 0) && (
            <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink-900">
                  {detail.schedule_mode === 'voting' ? '一起喬時間／選主題投票' : '活動時段／主題投票'}
                </h2>
                <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-sm font-semibold text-accent-600">
                  {detail.schedule_mode === 'scheduled' ? '已定案' : '投票進行中'}
                </span>
              </div>

              {poll_options.length === 0 ? (
                <p className="mt-3 text-sm text-ink-600">
                  目前為 TBD 時間待定，建議先按右方「有興趣」並開啟通知，幹部確定時段後會推播通知。
                </p>
              ) : (
                <div className="mt-4 space-y-2.5">
                  {poll_options.map((opt) => (
                    <div
                      key={opt.id}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5 ${
                        opt.is_selected
                          ? 'border-success-400 bg-success-50/70'
                          : 'border-line bg-ink-50/50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink-900">
                          {opt.label}
                          {opt.is_selected && (
                            <span className="ml-2 text-sm font-semibold text-success-700">
                              ✓ 已鎖定
                            </span>
                          )}
                        </p>
                        {opt.starts_at && (
                          <p className="text-sm text-ink-600">{formatDisplayTime(opt.starts_at)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!viewer.isLoggedIn || busyAction === `vote-${opt.id}`}
                          onClick={() => handlePollVote(opt.id)}
                          className={`min-h-[44px] rounded-full px-4 text-sm font-bold transition ${
                            opt.viewer_voted
                              ? 'bg-accent-600 text-white'
                              : 'border border-ink-300 bg-white text-ink-700 hover:bg-ink-50'
                          } disabled:opacity-50`}
                        >
                          {opt.viewer_voted ? '已投' : '投票'} ({opt.vote_count})
                        </button>
                        {permissions.is_officer && !opt.is_selected && (
                          <button
                            type="button"
                            disabled={busyAction === `lock-${opt.id}`}
                            onClick={() => handleLockPollOption(opt.id)}
                            className="min-h-[44px] rounded-full border border-success-600 bg-white px-3.5 text-sm font-semibold text-success-700 hover:bg-success-50"
                          >
                            鎖定此時段
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!viewer.isLoggedIn && (
                    <p className="text-sm text-ink-500">
                      <Link
                        href={`/login?callbackUrl=${encodeURIComponent(`/e/${detail.short_code}`)}`}
                        className="inline-flex min-h-[44px] items-center font-bold text-accent-600 underline"
                      >
                        登入帳號
                      </Link>{' '}
                      即可參與喬時間投票。
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Description */}
          {detail.description_md && (
            <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-ink-900">活動詳細介紹</h2>
              <div className="mt-3">
                <MarkdownView content={detail.description_md} />
              </div>
            </section>
          )}
        </div>

        {/* Right Column: RSVP, Attendees, Calendar Sync */}
        <div id="rsvp-section" className="space-y-6 md:col-span-5">
          {/* RSVP Card */}
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink-900">報名這場活動</h2>
            <p className="mt-1 text-sm text-ink-600">
              {detail.capacity
                ? `目前 ${detail.going_count} / ${detail.capacity} 人報名`
                : `目前已有 ${detail.going_count} 人確定參加・${detail.interested_count} 人有興趣`}
            </p>

            {!viewer.isLoggedIn ? (
              <div className="mt-4 space-y-3">
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/e/${detail.short_code}`)}`}
                  className={buttonClasses({ variant: 'primary', size: 'lg', className: 'w-full' })}
                >
                  {loginCtaLabel}
                </Link>
                {detail.campus_only && (
                  <p className="text-center text-xs text-ink-500">
                    此活動限 {detail.club.university_short_name} 學生，登入後須驗證 .edu.tw 信箱。
                  </p>
                )}
              </div>
            ) : campusRestricted ? (
              <div className="mt-4 rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-900">
                <p className="font-bold">此活動限 {detail.club.university_short_name} 學生報名</p>
                <p className="mt-1">完成同校 .edu.tw 信箱驗證後，即可一鍵回到這場活動報名。</p>
                <Link
                  href={`/me?returnTo=${encodeURIComponent(`/e/${detail.short_code}`)}`}
                  className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-warning-900 px-4 text-sm font-semibold text-white hover:bg-warning-950"
                >
                  前往完成校園認證
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* 2-Tier Privacy Selector */}
                <div className="space-y-2 rounded-xl bg-ink-50 p-3.5 text-sm">
                  <p className="font-bold text-ink-800">你的名單顯示偏好（隨時可改）：</p>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="privacy_mode"
                      checked={privacyMode === 'public_to_attendees'}
                      onChange={() => setPrivacyMode('public_to_attendees')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="text-ink-900">公開於同場名單</strong>（與參加者互相認識，可自訂顯示暱稱）
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="privacy_mode"
                      checked={privacyMode === 'private_count_only'}
                      onChange={() => setPrivacyMode('private_count_only')}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="flex items-center gap-1 text-ink-900">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        僅計入總人數（完全匿名）
                      </strong>
                      公開頁面絕不顯示你的姓名與頭像
                    </span>
                  </label>

                  {privacyMode === 'public_to_attendees' && (
                    <input
                      type="text"
                      maxLength={40}
                      value={displayAlias}
                      onChange={(e) => setDisplayAlias(e.target.value)}
                      placeholder="自訂此場顯示暱稱（留空則用帳號名稱）"
                      className={`${controlClasses} min-h-11 mt-1 w-full`}
                    />
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyAction !== null || detail.status === 'cancelled'}
                    onClick={() => handleRsvp('going')}
                    className={`min-h-[44px] flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition ${
                      viewer_rsvp?.status === 'going'
                        ? 'bg-success-600 text-white'
                        : 'bg-accent-600 text-white hover:bg-accent-700'
                    } disabled:opacity-50`}
                  >
                    {viewer_rsvp?.status === 'going' ? '✓ 我已報名參加' : '我要參加'}
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null || detail.status === 'cancelled'}
                    onClick={() => handleRsvp('interested')}
                    className={`min-h-[44px] rounded-full px-4 py-2.5 text-sm font-bold transition ${
                      viewer_rsvp?.status === 'interested'
                        ? 'bg-warning-500 text-white'
                        : 'border border-ink-300 bg-white text-ink-800 hover:bg-ink-50'
                    }`}
                  >
                    有興趣
                  </button>
                </div>

                {viewer_rsvp && viewer_rsvp.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => handleRsvp('cancelled')}
                    className="min-h-[44px] w-full text-center text-sm font-medium text-ink-500 hover:text-danger-600"
                  >
                    取消本次報名
                  </button>
                )}
              </div>
            )}

            {detail.external_registration_url && (
              <a
                href={detail.external_registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-ink-300 bg-ink-50 px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-100"
              >
                社團指定外部報名表單
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </section>

          {/* Public Attendees (strictly hiding private_count_only) */}
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <Users className="h-4 w-4 text-accent-600" aria-hidden="true" />
              同行夥伴名單（{detail.going_count}）
            </h2>

            {detail.public_attendees.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">
                {detail.going_count > 0
                  ? `共有 ${detail.going_count} 位參加者已報名（皆選擇不公開名單顯示）。`
                  : '成為第一位報名的夥伴吧！'}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.public_attendees.map((person, idx) => (
                  <span
                    key={`${person.display_name}-${idx}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line bg-ink-50 px-2.5 py-1 text-sm font-medium text-ink-800"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-200 text-xs font-bold text-accent-950">
                      {person.display_name.slice(0, 1)}
                    </span>
                    {person.display_name}
                  </span>
                ))}
              </div>
            )}
            {hiddenGoingCount > 0 && detail.public_attendees.length > 0 && (
              <p className="mt-2 text-xs text-ink-500">
                另有 {hiddenGoingCount} 位選擇「僅計入總人數」匿名參與。
              </p>
            )}
          </section>

          {/* Calendar Sync & Push */}
          <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
              <CalendarPlus className="h-4 w-4 text-accent-600" aria-hidden="true" />
              加入行事曆與行前通知
            </h2>
            {detail.starts_at ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {googleUrl && (
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center rounded-full border border-line px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    Google 日曆
                  </a>
                )}
                {outlookUrl && (
                  <a
                    href={outlookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center rounded-full border border-line px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    Outlook
                  </a>
                )}
                <a
                  href={`/api/calendar/events/${detail.short_code}.ics`}
                  download={`${detail.short_code}.ics`}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-line px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  下載 .ics
                </a>
                {viewer.isLoggedIn && (
                  <button
                    type="button"
                    onClick={handleCopyWebcal}
                    disabled={busyAction === 'webcal'}
                    className={buttonClasses({ variant: 'soft', size: 'sm' })}
                  >
                    複製 webcal:// 訂閱
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-500">
                活動時間定案後即可一鍵匯入 Google、Apple 與 Outlook 行事曆。
              </p>
            )}

            {viewer.isLoggedIn && (
              <button
                type="button"
                onClick={handleEnableWebPush}
                disabled={busyAction === 'web-push'}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-accent-600"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                開啟瀏覽器即時異動通知（Web Push）
              </button>
            )}
          </section>
        </div>
      </div>

      {/* Officer Management Bar */}
      {permissions.is_officer && (
        <section className="rounded-xl border-2 border-accent-300 bg-accent-50/50 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
                <ShieldCheck className="h-4 w-4 text-accent-600" aria-hidden="true" />
                幹部活動工具列
              </h2>
              <p className="text-sm text-ink-600">
                相簿策展、一鍵 LINE/IG/Discord 宣傳包、推播臨時異動與現場點名
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['curation', `相簿策展 (${pending_album_photos.length} 待審)`],
                  ['promo', 'LINE / IG 宣傳包'],
                  ['broadcast', '發送通知推播'],
                  ['attendance', '現場簽到名單'],
                  ['edit', '封面更換／取消活動'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => openOfficerTab(key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${
                    officerTab === key
                      ? 'bg-accent-600 text-white'
                      : 'border border-ink-300 bg-white text-ink-800 hover:bg-ink-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {officerTab === 'curation' && (
            <div className="mt-5 space-y-4 rounded-xl bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink-900">
                  待審核與精選上限（現場流精選 {featuredCount} / 3 張）
                </h3>
              </div>
              {pending_album_photos.length === 0 ? (
                <p className="text-sm text-ink-500">目前沒有待審核的新照片。</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {pending_album_photos.map((photo) => (
                    <div key={photo.id} className="rounded-xl border border-line p-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.preview_url}
                        alt={photo.caption || '待審照片'}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                      {photo.caption && (
                        <p className="mt-1.5 text-sm text-ink-700">{photo.caption}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCuratePhoto(photo.id, 'approve')}
                          className="rounded-full bg-ink-800 px-2.5 py-1 text-xs font-bold text-white"
                        >
                          收入相簿
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCuratePhoto(photo.id, 'feature')}
                          className={buttonClasses({ variant: 'primary', size: 'sm' })}
                        >
                          精選上現場流
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCuratePhoto(photo.id, 'reject')}
                          className="rounded-full border border-danger-200 px-2.5 py-1 text-xs font-bold text-danger-700"
                        >
                          拒絕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {officerTab === 'promo' && promoPack && (
            <div className="mt-5 space-y-3 rounded-xl bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink-900">社群導流懶人包</span>
                <a
                  href={promoPack.og_story_image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses({ variant: 'soft', size: 'sm' })}
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  開啟 9:16 限動預覽圖
                </a>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { label: 'LINE 群組公告', text: promoPack.line_message },
                  { label: 'Discord Markdown', text: promoPack.discord_markdown },
                  { label: 'IG 貼文文案', text: promoPack.ig_caption },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink-800">{item.label}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyPromoText(item.text, item.label)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent-600"
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        複製
                      </button>
                    </div>
                    <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap font-sans text-xs text-ink-600">
                      {item.text}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {officerTab === 'broadcast' && (
            <form onSubmit={handleBroadcast} className="mt-5 space-y-3 rounded-xl bg-white p-4">
              <p className="text-sm font-semibold text-ink-800">
                發送臨時異動／行前通知給所有已報名與有興趣同學（每小時上限 2 次）
              </p>
              <textarea
                rows={3}
                maxLength={300}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="例如：今天改到綜教館 R204 教室，請記得帶水壺！"
                className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
              />
              <button
                type="submit"
                disabled={busyAction === 'broadcast' || broadcastMessage.trim().length < 4}
                className={buttonClasses({ variant: 'primary', size: 'md' })}
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                立即推播通知
              </button>
            </form>
          )}

          {officerTab === 'attendance' && (
            <div className="mt-5 space-y-2 rounded-xl bg-white p-4 text-sm">
              <h3 className="font-bold text-ink-900">現場簽到名單（僅幹部可見）</h3>
              {attendanceList.length === 0 ? (
                <p className="text-ink-500">尚無確定參加的報名者。</p>
              ) : (
                <div className="divide-y divide-ink-100">
                  {attendanceList.map((row) => (
                    <div key={row.user_id} className="flex items-center justify-between py-2">
                      <div>
                        <span className="font-bold text-ink-900">{row.display_name}</span>
                        {row.privacy_mode === 'private_count_only' && (
                          <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-600">
                            公開匿名
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleAttendance(row.user_id, !row.attended)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold ${
                          row.attended
                            ? 'bg-success-600 text-white'
                            : 'border border-ink-300 text-ink-700'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {row.attended ? '已簽到' : '標記出席'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {officerTab === 'edit' && (
            <div className="mt-5 space-y-4 rounded-xl bg-white p-4 text-sm">
              <div>
                <p className="mb-2 font-bold text-ink-900">單圖封面即時替換</p>
                <ImageUploader
                  clubId={detail.club.id}
                  value={coverItems}
                  onChange={handleSaveCover}
                  maxImages={1}
                  purpose="club_cover"
                />
              </div>
              {detail.status !== 'cancelled' && (
                <div className="border-t border-ink-100 pt-3">
                  <button
                    type="button"
                    onClick={handleCancelEvent}
                    className="rounded-full border border-danger-300 bg-danger-50 px-4 py-2 font-bold text-danger-700 hover:bg-danger-100"
                  >
                    取消此場活動（同步發送 ICS 取消狀態）
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Event Comments (Participants & Officers) */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
          <MessageSquare className="h-4 w-4 text-accent-600" aria-hidden="true" />
          共乘／道具／出發前留言板（{comments.length}）
        </h2>

        {permissions.can_participate ? (
          <form onSubmit={handleCommentSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              maxLength={600}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="揪一起從校門出發、問集合細節或攜帶物品..."
              className={`${controlClasses} min-h-11 flex-1`}
            />
            <button
              type="submit"
              disabled={busyAction === 'comment' || !commentText.trim()}
              className={buttonClasses({ variant: 'primary', size: 'md' })}
            >
              留言
            </button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-ink-500">
            點擊上方「我要參加」成為同場參與者後即可發起共乘或行前討論。
          </p>
        )}

        <div className="mt-4 space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-ink-500">尚無留言。</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl bg-ink-50 p-3.5">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{c.display_author}</p>
                  <p className="mt-1 text-sm text-ink-700">{c.content}</p>
                </div>
                {(c.is_mine || permissions.is_officer) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(c.id)}
                    aria-label="刪除留言"
                    className="rounded-lg p-1 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Post-Event Dual-Variant Lossless Album */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">
              活動無損共編相簿（{album_photos.length}）
            </h2>
            <p className="text-sm text-ink-600">
              保留原檔無損下載，並自動壓縮為流暢預覽圖；精選照片可登上平台現場流
            </p>
          </div>
        </div>

        {permissions.can_participate && (
          <div className="mt-4 space-y-3 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-4">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                maxLength={120}
                value={albumCaption}
                onChange={(e) => setAlbumCaption(e.target.value)}
                placeholder="這張照片的故事或標題（選填，最多 120 字）"
                className={`${controlClasses} min-h-11 min-w-0 flex-1`}
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {busyAction === 'album-upload' ? '上傳雙軌原檔中...' : '上傳活動照片 (≤20MB)'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={handleAlbumFileSelect}
                  disabled={busyAction === 'album-upload'}
                  className="hidden"
                />
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
              />
              <span>
                <Check className="mr-1 inline h-3 w-3 text-success-700" aria-hidden="true" />
                本人確認拍攝素材未侵犯他人肖像權，並同意授權主辦社團收錄於活動相簿與評鑑成果。
              </span>
            </label>
          </div>
        )}

        {album_photos.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">目前尚無已公開的活動相簿照片。</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {album_photos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-xl border border-line bg-ink-50"
              >
                <div
                  className="w-full overflow-hidden bg-ink-100"
                  style={{
                    aspectRatio: String(
                      Math.max(0.65, Math.min(1.9, photo.width / Math.max(1, photo.height)))
                    ),
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview_url}
                    alt={photo.caption || detail.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="line-clamp-1 font-medium text-ink-700">
                    {photo.status === 'featured_stream' && (
                      <span className="mr-1.5 rounded bg-accent-100 px-1.5 py-0.5 text-xs font-bold text-accent-900">
                        精選現場流
                      </span>
                    )}
                    {photo.caption || '活動記錄'}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={photo.original_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-accent-600 hover:underline"
                    >
                      <Download className="h-3 w-3" aria-hidden="true" />
                      原圖
                    </a>
                    {permissions.is_officer && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCuratePhoto(
                            photo.id,
                            photo.status === 'featured_stream' ? 'approve' : 'feature'
                          )
                        }
                        className="rounded border border-ink-300 px-2 py-0.5 text-xs font-bold text-ink-700"
                      >
                        {photo.status === 'featured_stream' ? '取消精選' : '推上現場流'}
                      </button>
                    )}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Mobile sticky RSVP bar (bottom nav is hidden on event pages) */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-ink-900">
              {detail.fee_ntd === 0 ? '免費' : `NT$${detail.fee_ntd}`}
            </p>
            <p className="text-sm text-ink-600">{detail.going_count} 人已報名</p>
          </div>
          {!viewer.isLoggedIn ? (
            <ButtonLink href={`/login?callbackUrl=${encodeURIComponent(`/e/${detail.short_code}`)}`} size="lg">
              登入報名
            </ButtonLink>
          ) : campusRestricted ? (
            <ButtonLink href={`/me?returnTo=${encodeURIComponent(`/e/${detail.short_code}`)}`} size="lg" variant="secondary">
              先驗證學校信箱
            </ButtonLink>
          ) : viewer_rsvp?.status === 'going' ? (
            <a href="#rsvp-section" className={buttonClasses({ size: 'lg', variant: 'soft' })}>
              <Check className="h-4 w-4" aria-hidden="true" />
              已報名
            </a>
          ) : (
            <Button
              size="lg"
              disabled={busyAction !== null || detail.status === 'cancelled'}
              onClick={() => handleRsvp('going')}
            >
              我要參加
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}