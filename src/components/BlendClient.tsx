'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Download, Sparkles, Users } from 'lucide-react';
import { EventCard } from './EventCard';
import type { DiscoverEventCardDTO } from '@/lib/serializers';

import { buttonClasses } from '@/components/ui';
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
      <section className="rounded-xl border border-ink-300 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-sm font-semibold text-accent-900">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                校園興趣合拍結果
              </span>
              <span className="text-sm font-semibold text-ink-600">{universityName}</span>
            </div>

            <h1 className="mt-4 text-2xl font-bold text-ink-900 sm:text-3xl">
              {partnerName
                ? `${creatorName} × ${partnerName}：合拍指數 ${matchScore ?? 75}%`
                : `${creatorName} 邀請你做一場校園興趣合拍！`}
            </h1>

            {sharedDomains.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {sharedDomains.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-ink-300 bg-white px-3.5 py-1 text-sm font-semibold text-accent-900"
                  >
                    #{d}
                  </span>
                ))}
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-xl bg-danger-50 px-4 py-2 text-sm font-semibold text-danger-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-2.5">
              {!partnerName && !isCreator && !isExpired && (
                <button
                  type="button"
                  disabled={joining}
                  onClick={handleJoin}
                  className={buttonClasses({ variant: 'primary', size: 'md' })}
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  <span>{joining ? '合拍計算中...' : isLoggedIn ? '加入雙人合拍（看共同推薦）' : '登入加入合拍'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={copyLink}
                className={buttonClasses({ variant: 'secondary', size: 'md' })}
              >
                {copied ? <Check className="h-4 w-4 text-success-700" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? '已複製邀請連結' : '複製邀請連結給朋友'}</span>
              </button>

              <a
                href={`/api/og/blend/${shortCode}?format=story`}
                download={`clubar-blend-${shortCode}.png`}
                className={buttonClasses({ variant: 'soft', size: 'md' })}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>下載 IG 限動分享卡</span>
              </a>

              <Link
                href="/"
                className={buttonClasses({ variant: 'secondary', size: 'md' })}
              >
                回別的聚逛活動 →
              </Link>
            </div>
          </div>

          <div className="mx-auto w-36 shrink-0 overflow-hidden rounded-xl border border-ink-300 bg-white sm:mx-0 sm:w-40">
            <img
              src={`/api/og/blend/${shortCode}?format=story`}
              alt="IG 限動 9:16 合拍分享卡預覽"
              className="aspect-[9/16] w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {recommendedClubs.length > 0 && (
        <section className="space-y-3 rounded-xl border border-line bg-white p-6">
          <h2 className="text-lg font-bold text-ink-900">你們都可能會喜歡的寶藏社團</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {recommendedClubs.map((c) => (
              <Link
                key={c.id}
                href={`/clubs/${c.slug}`}
                className="rounded-xl bg-ink-100 p-4 hover:bg-accent-100/70"
              >
                <h3 className="text-sm font-semibold text-ink-900">{c.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-ink-600">{c.tagline}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recommendedEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-ink-900">一起相約參加的體驗活動</h2>
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
