'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Award,
  Bell,
  Bookmark,
  CalendarSync,
  CheckCircle2,
  Copy,
  Heart,
  LogOut,
  MailCheck,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { FollowMode, PortfolioVisibility } from '@/db/schema';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import { CLUB_CATEGORIES } from '@/lib/constants';
import type { UserPortfolioDTO } from '@/lib/services/portfolio';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  ClubMark,
  EmptyState,
  Field,
  IconButton,
  Input,
  Notice,
  Select,
  Tabs,
  controlClasses,
  tabPanelProps,
  useConfirm,
} from '@/components/ui';

export interface MePageData {
  user: {
    id: string;
    displayName: string;
    email: string;
    campusEmail: string | null;
    universityName: string | null;
    campusVerifiedAt: string | null;
    platformRole: string;
  };
  memberships: {
    clubId: string;
    slug: string;
    name: string;
    universityShortName: string;
    category: keyof typeof CLUB_CATEGORIES;
    role: 'owner' | 'editor' | 'member' | 'alumni';
    title: string | null;
    verificationStatus: string;
  }[];
  pendingHandovers: {
    id: string;
    clubName: string;
    clubSlug: string;
    fromUserName: string;
    note: string | null;
    expiresAt: string;
  }[];
  pendingCoClubInvitations: {
    id: string;
    targetType: 'event' | 'post';
    hostClubName: string;
  }[];
  notifications: {
    id: string;
    type: string;
    title: string;
    body: string;
    linkUrl: string | null;
    readAt: string | null;
    createdAt: string;
  }[];
  bookmarks: {
    postId: string;
    title: string;
    clubName: string;
    clubSlug: string;
    universityShortName: string;
  }[];
  follows: {
    clubId: string;
    slug: string;
    name: string;
    universityShortName: string;
    category: keyof typeof CLUB_CATEGORIES;
    followMode: FollowMode;
  }[];
  portfolio: UserPortfolioDTO | null;
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

// U-15: group the inbox by what the notification is about (docs/design/04-patterns.md §7).
const NOTIFICATION_GROUPS: { label: string; types: string[] }[] = [
  { label: '活動', types: ['event_broadcast'] },
  { label: '社團與入社', types: ['member_request_approved', 'application_result', 'directory_claim', 'handover_invite', 'handover_resolved'] },
  { label: '問答與交流', types: ['question_replied', 'alumni_ping', 'coclub_invite', 'coclub_responded'] },
];

function groupNotifications<T extends { type: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const n of items) {
    const label = NOTIFICATION_GROUPS.find((g) => g.types.includes(n.type) || n.type.startsWith('event_'))?.label ?? '平台通知';
    groups.set(label, [...(groups.get(label) ?? []), n]);
  }
  const order = [...NOTIFICATION_GROUPS.map((g) => g.label), '平台通知'];
  return order.filter((l) => groups.has(l)).map((l) => [l, groups.get(l)!]);
}

export function MeClient({
  data,
  signOutAction,
  returnTo = '',
}: {
  data: MePageData;
  signOutAction: () => Promise<void>;
  returnTo?: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [campusEmail, setCampusEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpUni, setOtpUni] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [otpJustVerified, setOtpJustVerified] = useState(false);

  const [handovers, setHandovers] = useState(data.pendingHandovers);
  const [handoverBusy, setHandoverBusy] = useState<string | null>(null);
  const [handoverMsg, setHandoverMsg] = useState<string | null>(null);

  const [coInvites, setCoInvites] = useState(data.pendingCoClubInvitations);
  const [coBusy, setCoBusy] = useState<string | null>(null);

  const [notifs, setNotifs] = useState(data.notifications);
  const unreadCount = notifs.filter((n) => !n.readAt).length;
  const [meTab, setMeTab] = useState<'notifications' | 'saved' | 'clubs' | 'settings'>('notifications');
  const [follows, setFollows] = useState(data.follows);

  // Portfolio & Calendar & Push settings
  const [handleInput, setHandleInput] = useState(data.portfolio?.handle ?? '');
  const [visibility, setVisibility] = useState<PortfolioVisibility>(
    data.portfolio?.portfolio_visibility ?? 'campus_only'
  );
  const [talentOptIn, setTalentOptIn] = useState(
    data.portfolio?.talent_discovery_opt_in ?? false
  );
  const [alumniPing, setAlumniPing] = useState(
    data.portfolio?.alumni_ping_enabled ?? false
  );
  const [alumniTagsStr, setAlumniTagsStr] = useState(
    (data.portfolio?.alumni_expertise_tags ?? []).join(', ')
  );
  const [portBusy, setPortBusy] = useState(false);
  const [portMsg, setPortMsg] = useState<string | null>(null);
  const [portErr, setPortErr] = useState<string | null>(null);

  const [calUrl, setCalUrl] = useState<string | null>(null);
  const [calMsg, setCalMsg] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyBusy(true);
    setVerifyErr(null);
    setVerifyMsg(null);
    try {
      const res = await fetch('/api/me/campus-verify/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campus_email: campusEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setVerifyErr(json?.error?.message || '發送驗證碼失敗。');
        return;
      }
      setOtpSent(true);
      setOtpUni(json.university_name);
      setVerifyMsg(`已寄出 6 位數驗證碼至 ${campusEmail}（10 分鐘內有效）。`);
    } catch {
      setVerifyErr('網路連線異常。');
    } finally {
      setVerifyBusy(false);
    }
  };

  const confirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyBusy(true);
    setVerifyErr(null);
    setVerifyMsg(null);
    try {
      const res = await fetch('/api/me/campus-verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campus_email: campusEmail, code: otpCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setVerifyErr(json?.error?.message || '驗證碼驗證失敗。');
        return;
      }
      setOtpJustVerified(true);
      setVerifyMsg(`已完成 ${json.university_name} 校園身分驗證！`);
      router.refresh();
    } catch {
      setVerifyErr('網路連線異常。');
    } finally {
      setVerifyBusy(false);
    }
  };

  const respondHandover = async (id: string, action: 'accept' | 'reject') => {
    setHandoverBusy(id);
    setHandoverMsg(null);
    try {
      const res = await fetch(`/api/handovers/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setHandoverMsg(json?.error?.message || '處理交接邀請失敗。');
        return;
      }
      setHandovers((prev) => prev.filter((h) => h.id !== id));
      setHandoverMsg(action === 'accept' ? '已接受社長交接。' : '已婉拒此交接邀請。');
      router.refresh();
    } finally {
      setHandoverBusy(null);
    }
  };

  const respondCoClub = async (
    id: string,
    decision: 'accept' | 'reject',
    includeEval = true
  ) => {
    setCoBusy(id);
    try {
      const res = await fetch(`/api/co-club/invitations/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, partner_include_eval: includeEval }),
      });
      if (res.ok) {
        setCoInvites((prev) => prev.filter((c) => c.id !== id));
        router.refresh();
      }
    } finally {
      setCoBusy(null);
    }
  };

  const markRead = async (id: string) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    await fetch(`/api/me/notifications/${id}/read`, { method: 'PATCH' });
    router.refresh();
  };

  const handleSavePortfolioSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPortBusy(true);
    setPortMsg(null);
    setPortErr(null);
    try {
      const tags = alumniTagsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
      const res = await fetch('/api/me/portfolio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handleInput.trim() || null,
          portfolio_visibility: visibility,
          talent_discovery_opt_in: talentOptIn,
          alumni_ping_enabled: alumniPing,
          alumni_expertise_tags: tags,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '儲存設定失敗');
      setPortMsg('成長軌跡與隱私授權設定已更新。');
      router.refresh();
    } catch (err) {
      setPortErr(err instanceof Error ? err.message : '儲存失敗');
    } finally {
      setPortBusy(false);
    }
  };

  const handleLoadWebcal = async (rotate = false) => {
    const res = await fetch('/api/me/calendar-token', {
      method: rotate ? 'POST' : 'GET',
    });
    if (res.ok) {
      const json = await res.json();
      setCalUrl(json.webcal_url);
      await navigator.clipboard.writeText(json.webcal_url).catch(() => {});
      setCalMsg(
        rotate
          ? '已重設行事曆密鑰並複製新的訂閱網址，舊的訂閱網址已失效。'
          : '已複製你的行事曆訂閱網址。'
      );
    }
  };

  const handleResetCalendar = async () => {
    const ok = await confirm({
      title: '重設行事曆密鑰？',
      description: '舊的訂閱網址會立刻失效，已訂閱的行事曆需要改用新網址。',
      confirmLabel: '重設密鑰',
      tone: 'danger',
    });
    if (ok) await handleLoadWebcal(true);
  };

  const handleEnableWebPush = async () => {
    setPushMsg(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushMsg('目前瀏覽器不支援推播，系統會改用站內與 Email 通知。');
        return;
      }
      const keyRes = await fetch('/api/me/push-subscriptions');
      const keyJson = await keyRes.json();
      if (!keyJson?.vapid_public_key) {
        setPushMsg('目前尚未開放瀏覽器推播，已維持站內與 Email 通知。');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setPushMsg('瀏覽器推播未獲授權，已保持站內通知與 Email 提醒。');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.vapid_public_key) as BufferSource,
      });
      const subJson = sub.toJSON();
      await fetch('/api/me/push-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });
      setPushMsg('瀏覽器即時推播已啟用！');
    } catch {
      setPushMsg('啟用推播時發生問題，已改用站內通知與 Email。');
    }
  };

  // U-14: per-item footprint visibility (owner always sees everything).
  const [footClubs, setFootClubs] = useState(data.portfolio?.clubs ?? []);
  const [footEvents, setFootEvents] = useState(data.portfolio?.attended_events ?? []);
  const handleToggleFootprint = async (kind: 'club' | 'event', id: string, hidden: boolean) => {
    const res = await fetch('/api/me/portfolio/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, hidden }),
    });
    if (!res.ok) return;
    if (kind === 'club') {
      setFootClubs((prev) => prev.map((c) => (c.club_id === id ? { ...c, hidden_from_portfolio: hidden } : c)));
    } else {
      setFootEvents((prev) => prev.map((e) => (e.id === id ? { ...e, hidden_from_portfolio: hidden } : e)));
    }
  };

  const handleChangeFollowMode = async (clubId: string, nextMode: FollowMode) => {
    const res = await fetch(`/api/me/follows/${clubId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ follow_mode: nextMode }),
    });
    if (res.ok) {
      setFollows((prev) =>
        prev.map((f) => (f.clubId === clubId ? { ...f, followMode: nextMode } : f))
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Profile + Campus Verification */}
      <Card>
        <div className="flex items-start gap-4">
          <ClubMark name={data.user.displayName} seed={data.user.email} size="lg" round />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="font-display text-2xl font-black text-fg sm:text-3xl">{data.user.displayName}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
              {data.user.campusVerifiedAt ? (
                <span className="inline-flex items-center gap-1 text-brand-soft-fg">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {data.user.universityName}
                </span>
              ) : (
                <Badge tone="warning">尚未驗證學校信箱</Badge>
              )}
              <span className="truncate">{data.user.campusEmail || data.user.email}</span>
            </p>
            {data.user.platformRole === 'platform_admin' && (
              <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-soft-fg hover:underline">
                前往平台治理 →
              </Link>
            )}
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm" icon={<LogOut className="h-4 w-4" aria-hidden="true" />}>
              登出
            </Button>
          </form>
        </div>

        {returnTo && (data.user.campusVerifiedAt || otpJustVerified) && (
          <Notice
            tone="success"
            className="mt-4"
            action={
              <ButtonLink href={returnTo} variant="secondary" size="sm">
                返回原本頁面 →
              </ButtonLink>
            }
          >
            校園身分已完成驗證，可立即回到原本頁面繼續操作。
          </Notice>
        )}

        {!data.user.campusVerifiedAt && !otpJustVerified && (
          <div className="mt-5 rounded-xl bg-brand-soft p-4 sm:p-5">
            <div className="flex items-start gap-2.5">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-soft-fg" aria-hidden="true" />
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="font-display text-base font-bold text-fg">
                    驗證大專校院校園信箱（.edu.tw），解鎖社員認證、發問與幹部權限
                  </h2>
                  <p className="mt-0.5 text-sm text-fg-muted">
                    支援全台大專校院教育信箱（例如 @cc.ncu.edu.tw、@ntust.edu.tw）；此資料僅用於身分認證，不會對外公開。
                    {returnTo ? ' 驗證完成後會顯示返回原頁按鈕。' : ''}
                  </p>
                </div>

                {!otpSent ? (
                  <form onSubmit={requestOtp} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label="學校信箱（.edu.tw）"
                      type="email"
                      required
                      value={campusEmail}
                      onChange={(e) => setCampusEmail(e.target.value)}
                      placeholder="輸入你的 .edu.tw 校園信箱"
                      className={`${controlClasses} min-h-11 flex-1`}
                    />
                    <Button type="submit" variant="primary" loading={verifyBusy}>
                      {verifyBusy ? '寄送中...' : '寄送 6 位數驗證碼'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={confirmOtp} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label="驗證碼"
                      type="text"
                      inputMode="numeric"
                      required
                      pattern="\d{6}"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder={`輸入寄往 ${otpUni || campusEmail} 的 6 位數驗證碼`}
                      className={`${controlClasses} min-h-11 flex-1 font-mono tabular-nums`}
                    />
                    <Button type="submit" variant="primary" loading={verifyBusy}>
                      {verifyBusy ? '驗證中...' : '確認驗證'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                      }}
                    >
                      更換信箱
                    </Button>
                  </form>
                )}

                {verifyMsg && <p className="text-sm font-semibold text-success-fg">{verifyMsg}</p>}
                {verifyErr && <p className="text-sm font-semibold text-danger-fg">{verifyErr}</p>}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Pending Co-Club Invitations */}
      {coInvites.length > 0 && (
        <Card>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
            <Sparkles className="h-4 w-4 text-brand-soft-fg" aria-hidden="true" />
            待回應的友社共辦邀請（{coInvites.length}）
          </h2>
          <div className="mt-3 space-y-2.5">
            {coInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft p-4 text-sm"
              >
                <span className="font-bold text-fg">
                  「{inv.hostClubName}」邀請貴社掛名共辦（{inv.targetType === 'event' ? '體驗活動' : '作品貼文'}）
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={coBusy === inv.id}
                    onClick={() => respondCoClub(inv.id, 'accept', true)}
                  >
                    同意共辦並納入本社評鑑
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={coBusy === inv.id}
                    onClick={() => respondCoClub(inv.id, 'reject', false)}
                  >
                    婉拒
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending Handover Invitations */}
      {(handovers.length > 0 || handoverMsg) && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-brand-soft-fg" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-fg">待確認的社長交接邀請</h2>
          </div>

          {handoverMsg && (
            <p className="mb-3 rounded-xl bg-success-soft px-4 py-2.5 text-sm font-semibold text-success-fg">
              {handoverMsg}
            </p>
          )}

          <div className="space-y-3">
            {handovers.map((h) => (
              <div
                key={h.id}
                className="flex flex-col justify-between gap-3 rounded-xl bg-brand-soft p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-fg">
                    「{h.clubName}」現任社長 {h.fromUserName} 邀請您接任新任社長
                  </p>
                  {h.note && <p className="text-sm text-fg-muted">備註：{h.note}</p>}
                  <p className="text-xs text-fg-muted">
                    邀請有效期限至：
                    <span className="font-mono tabular-nums">{formatTaipeiDateTime(h.expiresAt)}</span>
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="primary"
                    disabled={handoverBusy === h.id}
                    onClick={() => void respondHandover(h.id, 'accept')}
                  >
                    接受交接
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={handoverBusy === h.id}
                    onClick={() => void respondHandover(h.id, 'reject')}
                  >
                    婉拒
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs
        variant="underline"
        label="個人頁分頁"
        idPrefix="me"
        value={meTab}
        onChange={setMeTab}
        items={[
          {
            id: 'notifications',
            label: '通知',
            badge:
              unreadCount > 0 ? (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 font-mono text-xs font-semibold tabular-nums text-on-brand">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              ) : undefined,
          },
          { id: 'saved', label: '收藏與追蹤' },
          { id: 'clubs', label: '我的社團' },
          { id: 'settings', label: '足跡與訂閱' },
        ]}
      />

      {meTab === 'notifications' && (
        <div {...tabPanelProps('me', 'notifications')} className="space-y-6">
          {/* Notifications */}
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-soft-fg" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-fg">站內通知</h2>
            </div>

            {notifs.length === 0 ? (
              <EmptyState
                icon={<Bell />}
                title="目前沒有新通知"
                description="追蹤社團或報名活動後，活動異動、問答回覆和入社審核結果都會出現在這裡。"
                action={
                  <>
                    <ButtonLink href="/?tab=events" size="md">
                      看看近期活動
                    </ButtonLink>
                    <ButtonLink href="/" variant="secondary" size="md">
                      逛逛社團現場
                    </ButtonLink>
                  </>
                }
              />
            ) : (
              <div className="space-y-6">
                {notifs.every((n) => n.readAt) && (
                  <p className="flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
                    都看完了。
                    <Link href="/?tab=events" className="font-semibold text-brand-soft-fg underline-offset-4 hover:underline">
                      看看近期有什麼活動
                    </Link>
                  </p>
                )}
                {groupNotifications(notifs).map(([groupLabel, items]) => (
                  <div key={groupLabel}>
                    <h3 className="font-display text-sm font-bold text-fg-muted">{groupLabel}</h3>
                    <ul className="mt-1 divide-y-2 divide-line">
                      {items.map((n) => (
                        <li
                          key={n.id}
                          className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {!n.readAt && (
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" role="img" aria-label="未讀" />
                              )}
                              <p className={`text-sm text-fg ${n.readAt ? 'font-medium' : 'font-bold'}`}>{n.title}</p>
                            </div>
                            <p className="text-sm text-fg-secondary">{n.body}</p>
                            <p className="font-mono text-xs tabular-nums text-fg-muted">
                              {formatTaipeiDateTime(n.createdAt)}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {n.linkUrl && (
                              <ButtonLink href={n.linkUrl} variant="secondary" size="sm">
                                前往查看
                              </ButtonLink>
                            )}
                            {!n.readAt && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void markRead(n.id)}
                                icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                              >
                                已讀
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {meTab === 'saved' && (
        <div {...tabPanelProps('me', 'saved')} className="space-y-6">
          {/* Bookmarks & Follows (with Follow Separation Mode selector) */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-brand-soft-fg" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-fg">我的收藏</h2>
              </div>
              {data.bookmarks.length === 0 ? (
                <div className="space-y-3 rounded-xl bg-surface-subtle p-4 text-sm text-fg-muted">
                  <p>還沒收藏任何作品或活動。</p>
                  <ButtonLink href="/" variant="secondary">
                    去別的聚逛逛 →
                  </ButtonLink>
                </div>
              ) : (
                <ul className="divide-y-2 divide-line">
                  {data.bookmarks.map((b) => (
                    <li key={b.postId} className="py-3">
                      <Link
                        href={
                          b.clubSlug.startsWith('../e/')
                            ? `/e/${b.clubSlug.slice(5)}`
                            : `/posts/${b.postId}`
                        }
                        className="block text-sm font-semibold text-fg hover:text-brand-soft-fg hover:underline"
                      >
                        {b.title}
                      </Link>
                      <span className="mt-1 block text-sm text-fg-muted">
                        {b.universityShortName} · {b.clubName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4 text-brand-soft-fg" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-fg">我追蹤的社團（通知偏好）</h2>
              </div>
              {follows.length === 0 ? (
                <div className="space-y-3 rounded-xl bg-surface-subtle p-4 text-sm text-fg-muted">
                  <p>尚未追蹤任何社團，追蹤後可選擇「只收新活動」或「全部動態」。</p>
                  <ButtonLink href="/" variant="secondary">
                    去別的聚找社團 →
                  </ButtonLink>
                </div>
              ) : (
                <ul className="divide-y-2 divide-line">
                  {follows.map((f) => (
                    <li key={f.clubId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <Link
                          href={`/clubs/${f.slug}`}
                          className="text-sm font-semibold text-fg hover:text-brand-soft-fg hover:underline"
                        >
                          {f.name}
                        </Link>
                        <p className="text-sm text-fg-muted">
                          {f.universityShortName} · {CLUB_CATEGORIES[f.category].label}
                        </p>
                      </div>
                      <select
                        aria-label={`${f.name} 追蹤分流模式`}
                        value={f.followMode}
                        onChange={(e) => handleChangeFollowMode(f.clubId, e.target.value as FollowMode)}
                        className={`${controlClasses} min-h-11`}
                      >
                        <option value="all">全部動態</option>
                        <option value="events_only">只收新活動</option>
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {meTab === 'clubs' && (
        <div {...tabPanelProps('me', 'clubs')} className="space-y-6">
          {/* Managed Clubs */}
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-fg">我加入的社團</h2>
              <Link
                href="/clubs/apply"
                className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-soft-fg hover:underline"
              >
                認領或申請新社團 →
              </Link>
            </div>

            {data.memberships.length === 0 ? (
              <p className="text-sm text-fg-muted">
                你目前尚未加入任何認證社團。可至{' '}
                <Link href="/my-clubs" className="font-bold text-brand-soft-fg underline">
                  我的聚
                </Link>{' '}
                輸入邀請碼，或前往{' '}
                <Link href="/clubs/apply" className="font-bold text-brand-soft-fg underline">
                  認領名錄社團
                </Link>
                。
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.memberships.map((m) => (
                  <div
                    key={`${m.clubId}-${m.role}`}
                    className="flex flex-col justify-between gap-3 rounded-xl bg-surface-subtle p-4"
                  >
                    <div className="flex items-start gap-3">
                      <ClubMark name={m.name} seed={m.slug} category={m.category} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-bold text-fg-muted">{m.universityShortName}</span>
                          <Badge tone="neutral">
                            {m.role === 'owner'
                              ? '現任社長'
                              : m.role === 'editor'
                                ? '現任幹部'
                                : m.role === 'member'
                                  ? '認證社員'
                                  : '歷屆校友（只讀）'}
                          </Badge>
                        </div>
                        <Link
                          href={`/clubs/${m.slug}`}
                          className="mt-1 block font-display text-base font-bold text-fg hover:underline"
                        >
                          {m.name}
                        </Link>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {m.role !== 'member' && (
                        <ButtonLink
                          href={`/clubs/${m.slug}/manage`}
                          variant="primary"
                          size="sm"
                          icon={<Settings className="h-4 w-4" aria-hidden="true" />}
                        >
                          {m.role === 'alumni' ? '檢視年度成果' : '進入管理後台'}
                        </ButtonLink>
                      )}
                      <ButtonLink href={`/clubs/${m.slug}`} variant="secondary" size="sm">
                        公開主頁
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </ButtonLink>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {meTab === 'settings' && (
        <div {...tabPanelProps('me', 'settings')} className="space-y-6">
          {(footClubs.length > 0 || footEvents.length > 0) && (
            <Card>
              <h2 className="font-display text-lg font-bold text-fg">足跡裡要放哪些</h2>
              <p className="mt-1 text-sm text-fg-muted">
                關掉的項目只有你自己看得到，別人看你的足跡頁時不會出現，也不會算進時數。
              </p>
              <ul className="mt-4 divide-y-2 divide-line">
                {footClubs.map((c) => (
                  <li key={`club-${c.club_id}`} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-sm text-fg-body">社團・{c.name}</span>
                    <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm text-fg-muted">
                      <input
                        type="checkbox"
                        checked={!c.hidden_from_portfolio}
                        onChange={(e) => void handleToggleFootprint('club', c.club_id, !e.target.checked)}
                        className="h-4 w-4 rounded accent-brand"
                      />
                      公開
                    </label>
                  </li>
                ))}
                {footEvents.map((ev) => (
                  <li key={`event-${ev.id}`} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-sm text-fg-body">活動・{ev.title}</span>
                    <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-sm text-fg-muted">
                      <input
                        type="checkbox"
                        checked={!ev.hidden_from_portfolio}
                        onChange={(e) => void handleToggleFootprint('event', ev.id, !e.target.checked)}
                        className="h-4 w-4 rounded accent-brand"
                      />
                      公開
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Portfolio, calendar subscription & push controls */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg">
                  <Award className="h-5 w-5 text-brand-soft-fg" aria-hidden="true" />
                  個人成長軌跡與訂閱授權
                </h2>
                <p className="text-sm text-fg-muted">
                  累積認證時數 <span className="font-mono tabular-nums">{data.portfolio?.learning_hours_total ?? 0}</span>{' '}
                  小時・參與場次 <span className="font-mono tabular-nums">{data.portfolio?.attended_events.length ?? 0}</span>{' '}
                  場（預設完全私密）
                </p>
              </div>
              {handleInput && (
                <ButtonLink href={`/u/${handleInput}`} variant="secondary" size="sm">
                  檢視我的公開足跡頁
                </ButtonLink>
              )}
            </div>

            <form onSubmit={handleSavePortfolioSettings} className="mt-4 space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="個人頁代號（選填）" hint="4–30 字小寫，例如 alex-ncu">
                  {(p) => (
                    <Input {...p} value={handleInput} onChange={(e) => setHandleInput(e.target.value)} />
                  )}
                </Field>
                <Field label="誰能看見我的成長軌跡">
                  {(p) => (
                    <Select
                      {...p}
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as PortfolioVisibility)}
                    >
                      <option value="campus_only">僅限同校已驗證同學（預設）</option>
                      <option value="public">公開，任何人有網址都能看</option>
                      <option value="private">只有我自己看得到</option>
                    </Select>
                  )}
                </Field>
                <Field label="前輩經驗專長標籤（選填）" hint="用逗號分隔，最多 3 個">
                  {(p) => (
                    <Input
                      {...p}
                      value={alumniTagsStr}
                      onChange={(e) => setAlumniTagsStr(e.target.value)}
                      placeholder="如 評鑑核銷, 攝影暗房, 場控"
                    />
                  )}
                </Field>
              </div>

              <div className="flex flex-col gap-0 pt-1">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-fg-secondary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={alumniPing}
                    onChange={(e) => setAlumniPing(e.target.checked)}
                  />
                  開放「一起聚 → 前輩請益牆」接受學弟妹禮貌發問
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-fg-secondary">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={talentOptIn}
                    onChange={(e) => setTalentOptIn(e.target.checked)}
                  />
                  授權將這份歷練納入未來實習、產學合作的人才推薦（預設關閉）
                </label>
              </div>

              {portMsg && <p className="font-bold text-success-fg">{portMsg}</p>}
              {portErr && <p className="font-bold text-danger-fg">{portErr}</p>}

              <div className="flex flex-wrap items-center gap-3 border-t-2 border-line pt-4">
                <Button type="submit" variant="primary" loading={portBusy}>
                  儲存軌跡與授權設定
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleLoadWebcal(false)}
                  icon={<CalendarSync className="h-4 w-4" aria-hidden="true" />}
                >
                  複製行事曆訂閱網址
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void handleResetCalendar()}
                  icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
                >
                  重設行事曆密鑰
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleEnableWebPush}
                  icon={<Bell className="h-4 w-4" aria-hidden="true" />}
                >
                  啟用瀏覽器推播
                </Button>
              </div>

              {calUrl && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface-subtle p-2.5 font-mono text-xs text-fg-secondary">
                  <span className="truncate">{calUrl}</span>
                  <IconButton aria-label="複製網址" onClick={() => navigator.clipboard.writeText(calUrl)}>
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </div>
              )}
              {calMsg && <p className="font-semibold text-success-fg">{calMsg}</p>}
              {pushMsg && <p className="font-semibold text-brand-soft-fg">{pushMsg}</p>}
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
