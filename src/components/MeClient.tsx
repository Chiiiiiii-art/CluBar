'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bell,
  Bookmark,
  CheckCircle2,
  Heart,
  LogOut,
  MailCheck,
  Settings,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { CLUB_CATEGORIES } from '@/lib/constants';
import { formatTaipeiDateTime } from '@/lib/academic-year';

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
  }[];
}

export function MeClient({
  data,
  signOutAction,
}: {
  data: MePageData;
  signOutAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [campusEmail, setCampusEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpUni, setOtpUni] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyErr, setVerifyErr] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [handovers, setHandovers] = useState(data.pendingHandovers);
  const [handoverBusy, setHandoverBusy] = useState<string | null>(null);
  const [handoverMsg, setHandoverMsg] = useState<string | null>(null);

  const [notifs, setNotifs] = useState(data.notifications);

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

  const markRead = async (id: string) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    await fetch(`/api/me/notifications/${id}/read`, { method: 'PATCH' });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Account Profile + Campus Verification */}
      <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900">{data.user.displayName}</h1>
              {data.user.campusVerifiedAt ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-700">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  已驗證：{data.user.universityName}
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-900">
                  一般會員（尚未驗證校園信箱）
                </span>
              )}
              {data.user.platformRole === 'platform_admin' && (
                <Link
                  href="/admin"
                  className="rounded-full bg-slate-900 px-3 py-0.5 text-xs font-bold text-white"
                >
                  平台管理員 →
                </Link>
              )}
            </div>
            <p className="text-xs text-slate-500">
              登入信箱：{data.user.email}
              {data.user.campusEmail ? ` ｜ 校園信箱：${data.user.campusEmail}` : ''}
            </p>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>登出帳號</span>
            </button>
          </form>
        </div>

        {!data.user.campusVerifiedAt && (
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-2.5">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
              <div className="flex-1 space-y-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    驗證大專校院 `.edu.tw` 校園信箱（解鎖社團幹部與認領權限）
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    支援全台大專校院 `.edu.tw` 網域（如 `@cc.ncu.edu.tw`、`@ntust.edu.tw`）；本資料僅供身分驗證，不對外公開。
                  </p>
                </div>

                {!otpSent ? (
                  <form onSubmit={requestOtp} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      required
                      value={campusEmail}
                      onChange={(e) => setCampusEmail(e.target.value)}
                      placeholder="輸入您的 .edu.tw 校園信箱"
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={verifyBusy}
                      className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
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
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={verifyBusy}
                      className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {verifyBusy ? '驗證中...' : '確認驗證'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      更換信箱
                    </button>
                  </form>
                )}

                {verifyMsg && (
                  <p className="text-xs font-semibold text-emerald-800">{verifyMsg}</p>
                )}
                {verifyErr && (
                  <p className="text-xs font-semibold text-red-700">{verifyErr}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Pending Handover Invitations */}
      {(handovers.length > 0 || handoverMsg) && (
        <section className="rounded-3xl border border-orange-300 bg-orange-50 p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-slate-900">待確認的社長交接邀請</h2>
          </div>

          {handoverMsg && (
            <p className="mb-3 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-800">
              {handoverMsg}
            </p>
          )}

          <div className="space-y-3">
            {handovers.map((h) => (
              <div
                key={h.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-orange-200 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">
                    「{h.clubName}」現任社長 {h.fromUserName} 邀請您接任新任社長
                  </p>
                  {h.note && <p className="text-xs text-slate-600">備註：{h.note}</p>}
                  <p className="text-[11px] text-slate-500">
                    邀請有效期限至：{formatTaipeiDateTime(h.expiresAt)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={handoverBusy === h.id}
                    onClick={() => void respondHandover(h.id, 'accept')}
                    className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
                  >
                    接受交接
                  </button>
                  <button
                    type="button"
                    disabled={handoverBusy === h.id}
                    onClick={() => void respondHandover(h.id, 'reject')}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    婉拒
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Managed Clubs */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">我管理的社團</h2>
          <Link
            href="/clubs/apply"
            className="text-xs font-bold text-[var(--primary)] hover:underline"
          >
            認領或申請新社團 →
          </Link>
        </div>

        {data.memberships.length === 0 ? (
          <p className="text-sm text-slate-600">
            您目前尚未加入任何認證社團幹部團隊。若您是社團幹部，可請社長指派或前往{' '}
            <Link href="/clubs/apply" className="font-bold text-blue-700 underline">
              認領名錄社團
            </Link>
            。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.memberships.map((m) => (
              <div
                key={`${m.clubId}-${m.role}`}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/50 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-600">{m.universityShortName}</span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 font-bold text-slate-800">
                      {m.role === 'owner'
                        ? '現任社長'
                        : m.role === 'editor'
                          ? '現任幹部'
                          : '歷屆校友（只讀）'}
                    </span>
                  </div>
                  <Link
                    href={`/clubs/${m.slug}`}
                    className="mt-1 block text-base font-extrabold text-slate-900 hover:text-[var(--primary)]"
                  >
                    {m.name}
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/clubs/${m.slug}/manage`}
                    className="inline-flex items-center gap-1 rounded-xl bg-[var(--primary)] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{m.role === 'alumni' ? '檢視年度成果' : '進入管理後台'}</span>
                  </Link>
                  <Link
                    href={`/clubs/${m.slug}`}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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

      {/* Bookmarks & Follows */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-slate-900">我的私密收藏貼文</h2>
          </div>
          {data.bookmarks.length === 0 ? (
            <p className="text-xs text-slate-500">
              尚未收藏任何作品或活動貼文，前往「別的聚」探索感興趣的內容吧。
            </p>
          ) : (
            <ul className="space-y-2.5">
              {data.bookmarks.map((b) => (
                <li
                  key={b.postId}
                  className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3"
                >
                  <Link
                    href={`/posts/${b.postId}`}
                    className="block text-sm font-bold text-slate-900 hover:text-[var(--primary)]"
                  >
                    {b.title}
                  </Link>
                  <Link
                    href={`/clubs/${b.clubSlug}`}
                    className="mt-1 block text-xs text-slate-600 hover:underline"
                  >
                    {b.universityShortName} · {b.clubName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs">
          <div className="mb-3 flex items-center gap-2">
            <Heart className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-slate-900">我追蹤的社團</h2>
          </div>
          {data.follows.length === 0 ? (
            <p className="text-xs text-slate-500">尚未追蹤任何社團。</p>
          ) : (
            <ul className="space-y-2.5">
              {data.follows.map((f) => (
                <li
                  key={f.clubId}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3"
                >
                  <div>
                    <Link
                      href={`/clubs/${f.slug}`}
                      className="text-sm font-bold text-slate-900 hover:text-[var(--primary)]"
                    >
                      {f.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {f.universityShortName} · {CLUB_CATEGORIES[f.category].label}
                    </p>
                  </div>
                  <Link
                    href={`/clubs/${f.slug}`}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    查看
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Notifications */}
      <section className="rounded-3xl border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
          <h2 className="text-base font-extrabold text-slate-900">站內通知</h2>
        </div>

        {notifs.length === 0 ? (
          <p className="text-xs text-slate-500">目前沒有任何通知。</p>
        ) : (
          <div className="space-y-2.5">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`flex flex-col justify-between gap-2 rounded-2xl border p-3.5 sm:flex-row sm:items-center ${
                  n.readAt
                    ? 'border-slate-200 bg-white'
                    : 'border-orange-200 bg-orange-50/70'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.readAt && <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />}
                    <p className="text-sm font-bold text-slate-900">{n.title}</p>
                  </div>
                  <p className="text-xs text-slate-700">{n.body}</p>
                  <p className="text-[11px] text-slate-400">
                    {formatTaipeiDateTime(n.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {n.linkUrl && (
                    <Link
                      href={n.linkUrl}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      前往查看
                    </Link>
                  )}
                  {!n.readAt && (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
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
