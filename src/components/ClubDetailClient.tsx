'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HelpCircle, Send, UserPlus } from 'lucide-react';

import { Button, Card, controlClasses } from '@/components/ui';

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
        <Card>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-fg">
            <HelpCircle className="h-5 w-5 text-brand-soft-fg" aria-hidden="true" />
            匿名問答箱｜想先問社團幹部什麼都可以
          </h3>
          {!isLoggedIn ? (
            <p className="mt-2 text-sm text-fg-muted">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/clubs/${clubSlug}`)}`}
                className="font-bold text-brand-soft-fg underline"
              >
                登入並完成 .edu.tw 驗證
              </Link>{' '}
              即可匿名送出提問，社團答覆後只會以匿名或暱稱公開。
            </p>
          ) : !isCampusVerified ? (
            <p className="mt-2 text-sm text-fg-muted">
              為防範廣告騷擾，提問須先{' '}
              <Link
                href={`/me?returnTo=${encodeURIComponent(`/clubs/${clubSlug}`)}`}
                className="inline-flex min-h-[44px] items-center font-bold text-brand-soft-fg underline"
              >
                完成 .edu.tw 校園信箱驗證
              </Link>
              ，驗證完就能回到這頁繼續提問。
            </p>
          ) : (
            <form onSubmit={handleAsk} className="mt-3 space-y-3">
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-detail-questiontext" className="block text-sm font-medium text-fg-body">
                  你的問題
                </label>
                <textarea id="club-detail-questiontext"
                  rows={3}
                  maxLength={500}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder={`例如：沒有自己帶器材也能去「${clubName}」體驗課嗎？大概幾點結束？`}
                  className={`${controlClasses} min-h-24 py-2.5 leading-relaxed w-full`}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-fg-secondary">
                  <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                    />
                    完全匿名提問（推薦）
                  </label>
                  {!isAnonymous && (
                    <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                      <label htmlFor="club-detail-displayalias" className="block text-sm font-medium text-fg-body">
                        顯示暱稱（選填）
                      </label>
                      <input id="club-detail-displayalias"
                        type="text"
                        maxLength={30}
                        value={displayAlias}
                        onChange={(e) => setDisplayAlias(e.target.value)}
                        placeholder="公開顯示暱稱（選填）"
                        className={`${controlClasses} min-h-11`}
                      />
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={questionText.trim().length < 5}
                  loading={qBusy}
                  icon={<Send className="h-4 w-4" aria-hidden="true" />}
                >
                  送出問題
                </Button>
              </div>
              {qMsg && <p className="text-sm font-semibold text-success-fg">{qMsg}</p>}
              {qErr && <p className="text-sm font-semibold text-danger-fg">{qErr}</p>}
            </form>
          )}
        </Card>
      )}

      {/* Dual-track Member Request */}
      {isVerifiedClub && !membershipRole && (
        <section className="rounded-2xl bg-surface-subtle p-5 sm:p-6">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-fg">
            <UserPlus className="h-5 w-5 text-brand-soft-fg" aria-hidden="true" />
            已經是「{clubName}」的社員嗎？申請加入認證社員牆
          </h3>
          {!isLoggedIn ? (
            <p className="mt-2 text-sm text-fg-muted">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/clubs/${clubSlug}`)}`}
                className="inline-flex min-h-[44px] items-center font-bold text-brand-soft-fg underline"
              >
                登入帳號
              </Link>{' '}
              後可申請同校認證社員，或至「我的聚」輸入幹部邀請碼。
            </p>
          ) : !isSameUniversity ? (
            <p className="mt-2 text-sm text-fg-muted">
              認證社員僅限 {universityShortName} 在校 .edu.tw 學生申請（外校同學可透過活動頁直接報名體驗活動！）。
            </p>
          ) : (
            <form onSubmit={handleJoinRequest} className="mt-3 flex flex-wrap gap-2">
              <div className="min-w-0 flex-1 space-y-1.5 *:w-full">
                <label htmlFor="club-detail-joinnote" className="block text-sm font-medium text-fg-body">
                  自我介紹（選填）
                </label>
                <input id="club-detail-joinnote"
                  type="text"
                  maxLength={120}
                  value={joinNote}
                  onChange={(e) => setJoinNote(e.target.value)}
                  placeholder="簡短自我介紹或班級／暱稱讓幹部辨識（選填）"
                  className={`${controlClasses} min-h-11 min-w-0 flex-1`}
                />
              </div>
              <Button type="submit" variant="secondary" loading={joinBusy} className="self-end">
                {joinBusy ? '送出中...' : '申請認證社員'}
              </Button>
              {joinMsg && <p className="w-full text-sm font-semibold text-success-fg">{joinMsg}</p>}
              {joinErr && <p className="w-full text-sm font-semibold text-danger-fg">{joinErr}</p>}
            </form>
          )}
        </section>
      )}
    </div>
  );
}
