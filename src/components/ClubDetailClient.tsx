'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Send, UserPlus } from 'lucide-react';

import { buttonClasses, controlClasses } from '@/components/ui';
export function ClubDetailClient({
  clubSlug,
  clubName,
  universityShortName,
  isVerifiedClub,
  isLoggedIn,
  isCampusVerified,
  isSameUniversity,
  membershipRole,
}: {
  clubSlug: string;
  clubName: string;
  universityShortName: string;
  isVerifiedClub: boolean;
  isLoggedIn: boolean;
  isCampusVerified: boolean;
  isSameUniversity: boolean;
  membershipRole: 'owner' | 'editor' | 'member' | 'alumni' | null;
}) {
  const [questionText, setQuestionText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [displayAlias, setDisplayAlias] = useState('');
  const [qBusy, setQBusy] = useState(false);
  const [qMsg, setQMsg] = useState<string | null>(null);
  const [qErr, setQErr] = useState<string | null>(null);

  const [joinNote, setJoinNote] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);
  const [joinErr, setJoinErr] = useState<string | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (questionText.trim().length < 5) return;
    setQBusy(true);
    setQMsg(null);
    setQErr(null);
    try {
      const res = await fetch(`/api/clubs/${clubSlug}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: questionText.trim(),
          is_anonymous: isAnonymous,
          display_alias: !isAnonymous ? displayAlias.trim() || null : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '送出提問失敗');
      setQuestionText('');
      setQMsg('問題已匿名送進社團問答箱！幹部回覆後你會收到站內通知。');
    } catch (err) {
      setQErr(err instanceof Error ? err.message : '提問失敗');
    } finally {
      setQBusy(false);
    }
  }

  async function handleJoinRequest(e: React.FormEvent) {
    e.preventDefault();
    setJoinBusy(true);
    setJoinMsg(null);
    setJoinErr(null);
    try {
      const res = await fetch(`/api/clubs/${clubSlug}/member-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: joinNote.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '送出申請失敗');
      setJoinMsg('已送出認證社員申請！社團幹部審核通過後即可在「我的社團」發布日常微動態。');
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : '申請失敗');
    } finally {
      setJoinBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Ask Box */}
      {isVerifiedClub && (
        <section className="rounded-xl border border-ink-300 bg-white p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-base font-bold text-ink-900">
            <HelpCircle className="h-4 w-4 text-accent-600" aria-hidden="true" />
            匿名問答箱｜想先問社團幹部什麼都可以
          </h3>
          {!isLoggedIn ? (
            <p className="mt-2 text-sm text-ink-600">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/clubs/${clubSlug}`)}`}
                className="font-bold text-accent-600 underline"
              >
                登入並完成 .edu.tw 驗證
              </Link>{' '}
              即可匿名送出提問，社團答覆後只會以匿名或暱稱公開。
            </p>
          ) : !isCampusVerified ? (
            <p className="mt-2 text-sm text-ink-600">
              為防範廣告騷擾，提問須先{' '}
              <Link
                href={`/me?returnTo=${encodeURIComponent(`/clubs/${clubSlug}`)}`}
                className="inline-flex min-h-[44px] items-center font-bold text-accent-600 underline"
              >
                完成 .edu.tw 校園信箱驗證
              </Link>
              ，驗證完就能回到這頁繼續提問。
            </p>
          ) : (
            <form onSubmit={handleAsk} className="mt-3 space-y-3">
              <textarea
                rows={3}
                maxLength={500}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder={`例如：沒有自己帶器材也能去「${clubName}」體驗課嗎？大概幾點結束？`}
                className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-ink-700">
                  <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                    />
                    完全匿名提問（推薦）
                  </label>
                  {!isAnonymous && (
                    <input
                      type="text"
                      maxLength={30}
                      value={displayAlias}
                      onChange={(e) => setDisplayAlias(e.target.value)}
                      placeholder="公開顯示暱稱（選填）"
                      className={`${controlClasses} min-h-11`}
                    />
                  )}
                </div>
                <button
                  type="submit"
                  disabled={qBusy || questionText.trim().length < 5}
                  className={buttonClasses({ variant: 'primary', size: 'md' })}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  送出問題
                </button>
              </div>
              {qMsg && <p className="text-sm font-semibold text-success-700">{qMsg}</p>}
              {qErr && <p className="text-sm font-semibold text-danger-700">{qErr}</p>}
            </form>
          )}
        </section>
      )}

      {/* Dual-track Member Request */}
      {isVerifiedClub && !membershipRole && (
        <section className="rounded-xl border border-line bg-ink-50 p-5 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <UserPlus className="h-4 w-4 text-accent-600" aria-hidden="true" />
            已經是「{clubName}」的社員嗎？申請加入認證社員牆
          </h3>
          {!isLoggedIn ? (
            <p className="mt-2 text-sm text-ink-600">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/clubs/${clubSlug}`)}`}
                className="inline-flex min-h-[44px] items-center font-bold text-accent-600 underline"
              >
                登入帳號
              </Link>{' '}
              後可申請同校認證社員，或至「我的聚」輸入幹部邀請碼。
            </p>
          ) : !isSameUniversity ? (
            <p className="mt-2 text-sm text-ink-600">
              認證社員僅限 {universityShortName} 在校 .edu.tw 學生申請（外校同學可透過活動頁直接報名體驗活動！）。
            </p>
          ) : (
            <form onSubmit={handleJoinRequest} className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                maxLength={120}
                value={joinNote}
                onChange={(e) => setJoinNote(e.target.value)}
                placeholder="簡短自我介紹或班級／暱稱讓幹部辨識（選填）"
                className={`${controlClasses} min-h-11 min-w-0 flex-1`}
              />
              <button
                type="submit"
                disabled={joinBusy}
                className="min-h-[44px] rounded-full bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
              >
                {joinBusy ? '送出中...' : '申請認證社員'}
              </button>
              {joinMsg && <p className="w-full text-sm font-semibold text-success-700">{joinMsg}</p>}
              {joinErr && <p className="w-full text-sm font-semibold text-danger-700">{joinErr}</p>}
            </form>
          )}
        </section>
      )}
    </div>
  );
}
