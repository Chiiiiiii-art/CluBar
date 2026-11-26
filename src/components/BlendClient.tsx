'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Download, Sparkles, Users } from 'lucide-react';
import { EventCard } from './EventCard';
import type { DiscoverEventCardDTO } from '@/lib/serializers';

export function BlendClient({
  shortCode,
  creatorName,
  partnerName,
  universityName,
  matchScore,
  sharedDomains,
  recommendedClubs,
  recommendedEvents,
  isCreator,
  isLoggedIn,
  isExpired,
}: {
  shortCode: string;
  creatorName: string;
  partnerName: string | null;
  universityName: string;
  matchScore: number | null;
  sharedDomains: string[];
  recommendedClubs: { id: string; slug: string; name: string; tagline: string }[];
  recommendedEvents: DiscoverEventCardDTO[];
  isCreator: boolean;
  isLoggedIn: boolean;
  isExpired: boolean;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleJoin = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/blend/${shortCode}`)}`);
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/blends/${shortCode}/join`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '合拍失敗。');
        return;
      }
      router.refresh();
    } finally {
      setJoining(false);
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/blend/${shortCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-3xl border border-[var(--border-strong)] bg-gradient-to-br from-orange-50 via-white to-blue-50 p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">
            <Sparkles className="h-3.5 w-3.5" />
            CluBar 校園興趣 Blend
          </span>
          <span className="text-xs font-semibold text-slate-600">{universityName}</span>
        </div>

        <h1 className="mt-4 text-2xl font-extrabold text-slate-900 sm:text-3xl">
          {partnerName
            ? `${creatorName} × ${partnerName}：合拍指數 ${matchScore ?? 75}%`
            : `${creatorName} 邀請你做一場校園興趣合拍！`}
        </h1>

        {sharedDomains.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sharedDomains.map((d) => (
              <span
                key={d}
                className="rounded-full border border-[var(--border-strong)] bg-white px-3.5 py-1 text-xs font-bold text-orange-900"
              >
                #{d}
              </span>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2.5">
          {!partnerName && !isCreator && !isExpired && (
            <button
              type="button"
              disabled={joining}
              onClick={handleJoin}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              <span>{joining ? '合拍計算中...' : isLoggedIn ? '加入雙人合拍（看共同推薦）' : '登入與 TA 合拍'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-white px-4 text-xs font-bold text-slate-800"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? '已複製邀請連結' : '複製邀請連結給朋友'}</span>
          </button>

          <a
            href={`/api/og/blend/${shortCode}?format=story`}
            download={`clubar-blend-${shortCode}.png`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-800 hover:bg-blue-100"
          >
            <Download className="h-4 w-4" />
            <span>下載 IG 限動 9:16 分享卡</span>
          </a>
        </div>
      </section>

      {recommendedClubs.length > 0 && (
        <section className="space-y-3 rounded-3xl border border-[var(--border)] bg-white p-6">
          <h2 className="text-lg font-extrabold text-slate-900">你們都可能會喜歡的寶藏社團</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {recommendedClubs.map((c) => (
              <Link
                key={c.id}
                href={`/clubs/${c.slug}`}
                className="rounded-2xl bg-[var(--muted)] p-4 hover:bg-orange-100/70"
              >
                <h3 className="text-sm font-extrabold text-slate-900">{c.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-600">{c.tagline}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recommendedEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold text-slate-900">一起相約參加的體驗活動</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {recommendedEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
