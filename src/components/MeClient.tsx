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
      setHandoverMsg(action === 'accept' ? '已成功接受社長交接！' : '已婉拒此交接邀請。');
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
      setPortMsg('1D 成長軌跡與隱私授權設定已更新！');
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
          ? '已重新輪替專屬行事曆密鑰並複製最新 webcal:// 網址（舊訂閱自動作廢）。'
          : '已複製專屬 webcal:// 行事曆訂閱網址！'
      );
    }
  };

  const handleEnableWebPush = async () => {
    setPushMsg(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushMsg('目前瀏覽器不支援 Web Push，系統會自動改用站內與 Email 通知。');
        return;
      }
      const keyRes = await fetch('/api/me/push-subscriptions');
      const keyJson = await keyRes.json();
      if (!keyJson?.vapid_public_key) {
        setPushMsg('目前伺服器未啟用 VAPID 推播，已開啟站內與 Email 雙備援通知。');
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
      setPushMsg('啟用推播時發生問題，已切換回站內通知＋Email。');
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
      <section className="rounded-xl border border-ink-300 bg-white p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink-900">{data.user.displayName}</h1>
              {data.user.campusVerifiedAt ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-0.5 text-sm font-semibold text-accent-700">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  已驗證：{data.user.universityName}
                </span>
              ) : (
                <span className="rounded-full bg-warning-100 px-3 py-0.5 text-sm font-semibold text-warning-900">
                  一般會員（尚未驗證校園信箱）
                </span>
              )}
              {data.user.platformRole === 'platform_admin' && (
                <Link
                  href="/admin"
                  className="rounded-full bg-ink-900 px-3 py-0.5 text-sm font-semibold text-white"
                >
                  平台管理員 →
                </Link>
              )}
            </div>
            <p className="text-sm text-ink-500">
              登入信箱：{data.user.email}
              {data.user.campusEmail ? ` ｜ 校園信箱：${data.user.campusEmail}` : ''}
            </p>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>登出帳號</span>
            </button>
          </form>
        </div>

        {returnTo && (data.user.campusVerifiedAt || otpJustVerified) && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-300 bg-success-50 p-4 text-sm text-success-950">
            <p className="font-bold">校園身分已完成驗證，可立即回到原本頁面繼續操作。</p>
            <Link
              href={returnTo}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-success-700 px-4 font-bold text-white hover:bg-success-800"
            >
              返回原本頁面 →
            </Link>
          </div>
        )}

        {!data.user.campusVerifiedAt && !otpJustVerified && (
          <div className="mt-6 rounded-xl border border-accent-200 bg-accent-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-2.5">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-700" aria-hidden="true" />
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink-900">
                    驗證大專校院校園信箱（.edu.tw），解鎖社員認證、發問與幹部權限
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-600">
                    支援全台大專校院教育信箱（例如 @cc.ncu.edu.tw、@ntust.edu.tw）；此資料僅用於身分認證，不會對外公開。
                    {returnTo ? ' 驗證完成後會顯示返回原頁按鈕。' : ''}
                  </p>
                </div>

                {!otpSent ? (
                  <form onSubmit={requestOtp} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      required
                      value={campusEmail}
                      onChange={(e) => setCampusEmail(e.target.value)}
                      placeholder="輸入你的 .edu.tw 校園信箱"
                      className="min-h-[44px] flex-1 rounded-xl border border-line-input bg-white px-3.5 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={verifyBusy}
                      className="min-h-[44px] rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                    >
                      {verifyBusy ? '寄送中...' : '寄送 6 位數驗證碼'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={confirmOtp} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      required
                      pattern="\d{6}"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder={`輸入寄往 ${otpUni || campusEmail} 的 6 位數驗證碼`}
                      className="min-h-[44px] flex-1 rounded-xl border border-line-input bg-white px-3.5 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={verifyBusy}
                      className="min-h-[44px] rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                    >
                      {verifyBusy ? '驗證中...' : '確認驗證'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                      }}
                      className="min-h-[44px] rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700"
                    >
                      更換信箱
                    </button>
                  </form>
                )}

                {verifyMsg && (
                  <p className="text-sm font-semibold text-success-800">{verifyMsg}</p>
                )}
                {verifyErr && (
                  <p className="text-sm font-semibold text-danger-700">{verifyErr}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Pending Co-Club Invitations */}
      {coInvites.length > 0 && (
        <section className="rounded-xl border border-accent-200 bg-accent-50/70 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink-900">
            <Sparkles className="h-4 w-4 text-accent-700" aria-hidden="true" />
            待回應的 Co-Club 友社共辦邀請 ({coInvites.length})
          </h2>
          <div className="mt-3 space-y-2.5">
            {coInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-4 text-sm"
              >
                <span className="font-bold text-ink-900">
                  「{inv.hostClubName}」邀請貴社掛名共辦（{inv.targetType === 'event' ? '體驗活動' : '作品貼文'}）
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={coBusy === inv.id}
                    onClick={() => respondCoClub(inv.id, 'accept', true)}
                    className="rounded-full bg-accent-600 px-3.5 py-1.5 font-bold text-white"
                  >
                    同意共辦並納入本社評鑑
                  </button>
                  <button
                    type="button"
                    disabled={coBusy === inv.id}
                    onClick={() => respondCoClub(inv.id, 'reject', false)}
                    className="rounded-full border border-ink-300 px-3 py-1.5 font-bold text-ink-700"
                  >
                    婉拒
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending Handover Invitations */}
      {(handovers.length > 0 || handoverMsg) && (
        <section className="rounded-xl border border-accent-300 bg-accent-50 p-5">
          <div className="mb-3 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-accent-600" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink-900">待確認的社長交接邀請</h2>
          </div>

          {handoverMsg && (
            <p className="mb-3 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-success-800">
              {handoverMsg}
            </p>
          )}

          <div className="space-y-3">
            {handovers.map((h) => (
              <div
                key={h.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-accent-200 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-ink-900">
                    「{h.clubName}」現任社長 {h.fromUserName} 邀請您接任新任社長
                  </p>
                  {h.note && <p className="text-sm text-ink-600">備註：{h.note}</p>}
                  <p className="text-xs text-ink-500">
                    邀請有效期限至：{formatTaipeiDateTime(h.expiresAt)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={handoverBusy === h.id}
                    onClick={() => void respondHandover(h.id, 'accept')}
                    className="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                  >
                    接受交接
                  </button>
                  <button
                    type="button"
                    disabled={handoverBusy === h.id}
                    onClick={() => void respondHandover(h.id, 'reject')}
                    className="rounded-xl border border-ink-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                  >
                    婉拒
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 1D Portfolio, Webcal Subscription & Push Controls */}
      <section className="rounded-xl border border-ink-300 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
              <Award className="h-5 w-5 text-accent-600" aria-hidden="true" />
              個人社團成長軌跡 (1D Portfolio) 與訂閱授權
            </h2>
            <p className="text-sm text-ink-600">
              累積認證時數 {data.portfolio?.learning_hours_total ?? 0} 小時・參與場次{' '}
              {data.portfolio?.attended_events.length ?? 0} 場（預設完全私密，無追蹤人數虛榮排行）
            </p>
          </div>
          {handleInput && (
            <Link
              href={`/u/${handleInput}`}
              className="rounded-full border border-ink-300 px-3.5 py-1.5 text-sm font-semibold text-accent-700 hover:bg-accent-50"
            >
              檢視我的公開足跡頁 /u/{handleInput}
            </Link>
          )}
        </div>

        <form onSubmit={handleSavePortfolioSettings} className="mt-4 space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-bold text-ink-700">個人頁代號 (handle)</label>
              <input
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="如 alex-ncu (4-30字小寫)"
                className="w-full rounded-xl border border-line-input px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold text-ink-700">誰能看見我的成長軌跡</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as PortfolioVisibility)}
                className="w-full rounded-xl border border-line-input px-3 py-2"
              >
                <option value="campus_only">僅限同校已驗證同學 (預設)</option>
                <option value="public">公開網際網路分享網址</option>
                <option value="private">完全僅限本人檢視</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold text-ink-700">
                前輩經驗專長標籤（逗號分隔，最多 3 個）
              </label>
              <input
                value={alumniTagsStr}
                onChange={(e) => setAlumniTagsStr(e.target.value)}
                placeholder="如 評鑑核銷, 攝影暗房, 場控"
                className="w-full rounded-xl border border-line-input px-3 py-2"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex cursor-pointer items-center gap-2 font-semibold text-ink-700">
              <input
                type="checkbox"
                checked={alumniPing}
                onChange={(e) => setAlumniPing(e.target.checked)}
              />
              開放「一起聚 → 前輩請益牆 (Alumni Ping)」接受學弟妹禮貌發問
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-ink-700">
              <input
                type="checkbox"
                checked={talentOptIn}
                onChange={(e) => setTalentOptIn(e.target.checked)}
              />
              授權將本歷練納入未來實習／產學人才推薦 (Talent Opt-in，預設關閉)
            </label>
          </div>

          {portMsg && <p className="font-bold text-success-700">{portMsg}</p>}
          {portErr && <p className="font-bold text-danger-700">{portErr}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={portBusy}
              className="rounded-full bg-accent-600 px-4 py-2 font-bold text-white"
            >
              儲存軌跡與授權設定
            </button>
            <button
              type="button"
              onClick={() => handleLoadWebcal(false)}
              className="inline-flex items-center gap-1 rounded-full border border-ink-300 px-3.5 py-2 font-bold text-ink-800"
            >
              <CalendarSync className="h-3.5 w-3.5 text-accent-600" />
              複製個人 webcal:// 行事曆
            </button>
            <button
              type="button"
              onClick={() => handleLoadWebcal(true)}
              className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-3 py-2 text-ink-600"
            >
              <RefreshCw className="h-3 w-3" />
              重設行事曆密鑰
            </button>
            <button
              type="button"
              onClick={handleEnableWebPush}
              className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-3.5 py-2 font-bold text-ink-700"
            >
              <Bell className="h-3.5 w-3.5" />
              啟用瀏覽器 Push 推播
            </button>
          </div>

          {calUrl && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-ink-50 p-2.5 font-mono text-xs text-ink-700">
              <span className="truncate">{calUrl}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(calUrl)}
                className="shrink-0 font-bold text-accent-600"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {calMsg && <p className="font-semibold text-success-700">{calMsg}</p>}
          {pushMsg && <p className="font-semibold text-accent-700">{pushMsg}</p>}
        </form>
      </section>

      {/* Managed Clubs */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">我加入的社團</h2>
          <Link
            href="/clubs/apply"
            className="text-sm font-semibold text-accent-600 hover:underline"
          >
            認領或申請新社團 →
          </Link>
        </div>

        {data.memberships.length === 0 ? (
          <p className="text-sm text-ink-600">
            你目前尚未加入任何認證社團。可至{' '}
            <Link href="/my-clubs" className="font-bold text-accent-700 underline">
              我的聚
            </Link>{' '}
            輸入邀請碼，或前往{' '}
            <Link href="/clubs/apply" className="font-bold text-accent-700 underline">
              認領名錄社團
            </Link>
            。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.memberships.map((m) => (
              <div
                key={`${m.clubId}-${m.role}`}
                className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-ink-100/50 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-ink-600">{m.universityShortName}</span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 font-bold text-ink-800">
                      {m.role === 'owner'
                        ? '現任社長'
                        : m.role === 'editor'
                          ? '現任幹部'
                          : m.role === 'member'
                            ? '認證社員'
                            : '歷屆校友（只讀）'}
                    </span>
                  </div>
                  <Link
                    href={`/clubs/${m.slug}`}
                    className="mt-1 block text-base font-bold text-ink-900 hover:text-accent-600"
                  >
                    {m.name}
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2">
                  {m.role !== 'member' && (
                    <Link
                      href={`/clubs/${m.slug}/manage`}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-accent-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-700"
                    >
                      <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{m.role === 'alumni' ? '檢視年度成果' : '進入管理後台'}</span>
                    </Link>
                  )}
                  <Link
                    href={`/clubs/${m.slug}`}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-ink-300 bg-white px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <span>公開主頁</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bookmarks & Follows (with Follow Separation Mode selector) */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-accent-600" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink-900">我的收藏</h2>
          </div>
          {data.bookmarks.length === 0 ? (
            <div className="space-y-3 rounded-xl bg-ink-100/40 p-4 text-sm text-ink-600">
              <p>還沒收藏任何作品或活動。</p>
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center rounded-full border border-ink-300 bg-white px-4 font-bold text-ink-800 hover:bg-ink-50"
              >
                去別的聚逛逛 →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {data.bookmarks.map((b) => (
                <li
                  key={b.postId}
                  className="rounded-xl border border-line bg-ink-100/40 p-3"
                >
                  <Link
                    href={
                      b.clubSlug.startsWith('../e/')
                        ? `/e/${b.clubSlug.slice(5)}`
                        : `/posts/${b.postId}`
                    }
                    className="block text-sm font-semibold text-ink-900 hover:text-accent-600"
                  >
                    {b.title}
                  </Link>
                  <span className="mt-1 block text-sm text-ink-600">
                    {b.universityShortName} · {b.clubName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Heart className="h-4 w-4 text-accent-600" aria-hidden="true" />
            <h2 className="text-base font-bold text-ink-900">我追蹤的社團（通知偏好）</h2>
          </div>
          {follows.length === 0 ? (
            <div className="space-y-3 rounded-xl bg-ink-100/40 p-4 text-sm text-ink-600">
              <p>尚未追蹤任何社團，追蹤後可選擇「只收新活動」或「全部動態」。</p>
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center rounded-full border border-ink-300 bg-white px-4 font-bold text-ink-800 hover:bg-ink-50"
              >
                去別的聚找社團 →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {follows.map((f) => (
                <li
                  key={f.clubId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-ink-100/40 p-3"
                >
                  <div>
                    <Link
                      href={`/clubs/${f.slug}`}
                      className="text-sm font-semibold text-ink-900 hover:text-accent-600"
                    >
                      {f.name}
                    </Link>
                    <p className="text-sm text-ink-500">
                      {f.universityShortName} · {CLUB_CATEGORIES[f.category].label}
                    </p>
                  </div>
                  <select
                    aria-label={`${f.name} 追蹤分流模式`}
                    value={f.followMode}
                    onChange={(e) =>
                      handleChangeFollowMode(f.clubId, e.target.value as FollowMode)
                    }
                    className="min-h-[44px] rounded-xl border border-line-input bg-white px-3 py-1 text-sm font-semibold text-ink-700"
                  >
                    <option value="all">全部動態</option>
                    <option value="events_only">只收新活動</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Notifications */}
      <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent-600" aria-hidden="true" />
          <h2 className="text-base font-bold text-ink-900">站內通知</h2>
        </div>

        {notifs.length === 0 ? (
          <p className="text-sm text-ink-500">目前沒有任何通知。</p>
        ) : (
          <div className="space-y-2.5">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`flex flex-col justify-between gap-2 rounded-xl border p-3.5 sm:flex-row sm:items-center ${
                  n.readAt
                    ? 'border-ink-200 bg-white'
                    : 'border-accent-200 bg-accent-50/70'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-accent-600" />}
                    <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                  </div>
                  <p className="text-sm text-ink-700">{n.body}</p>
                  <p className="text-xs text-ink-500">
                    {formatTaipeiDateTime(n.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {n.linkUrl && (
                    <Link
                      href={n.linkUrl}
                      className="rounded-xl border border-ink-300 bg-white px-3 py-1.5 text-sm font-semibold text-ink-800 hover:bg-ink-50"
                    >
                      前往查看
                    </Link>
                  )}
                  {!n.readAt && (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-ink-100 px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-200"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>已讀</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
