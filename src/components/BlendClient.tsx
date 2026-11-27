'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Download, Users } from 'lucide-react';
import { EventCard } from './EventCard';
import type { DiscoverEventCardDTO } from '@/lib/serializers';

import { Badge, Button, ButtonLink, Card, Notice, PageHeader, Section, buttonClasses } from '@/components/ui';
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

  const canJoin = !partnerName && !isCreator && !isExpired;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow={`校園興趣合拍 · ${universityName}`}
        title={
          partnerName
            ? `${creatorName} × ${partnerName}：合拍指數 ${matchScore ?? 75}%`
            : `${creatorName} 邀請你做一場校園興趣合拍`
        }
      />

      {error && <Notice tone="danger">{error}</Notice>}

      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1 space-y-5">
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-ink-900">共同的興趣</h2>
              {sharedDomains.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sharedDomains.map((d) => (
                    <Badge key={d} tone="accent" className="px-3 py-1 text-sm">
                      #{d}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-600">
                  {partnerName ? '你們目前沒有重疊的興趣領域。' : '加入合拍後，就能看到你們的共同興趣。'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              {canJoin && (
                <Button
                  disabled={joining}
                  onClick={handleJoin}
                  icon={<Users className="h-4 w-4" aria-hidden="true" />}
                >
                  {joining ? '合拍計算中...' : isLoggedIn ? '加入合拍，看共同推薦' : '登入加入合拍'}
                </Button>
              )}
              <ButtonLink href="/" variant={canJoin ? 'secondary' : 'primary'}>
                回別的聚逛活動
              </ButtonLink>
            </div>

            <div className="flex flex-wrap gap-2.5 border-t border-line pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={copyLink}
                icon={
                  copied ? (
                    <Check className="h-4 w-4 text-success-700" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )
                }
              >
                {copied ? '已複製邀請連結' : '複製邀請連結'}
              </Button>
              <a
                href={`/api/og/blend/${shortCode}?format=story`}
                download={`clubar-blend-${shortCode}.png`}
                className={buttonClasses({ variant: 'ghost', size: 'sm' })}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>下載限時動態分享卡</span>
              </a>
            </div>
          </div>

          <div className="mx-auto w-32 shrink-0 overflow-hidden rounded-xl border border-line sm:mx-0 sm:w-36">
            <img
              src={`/api/og/blend/${shortCode}?format=story`}
              alt="限時動態 9:16 合拍分享卡預覽"
              className="aspect-[9/16] w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </Card>

      {recommendedClubs.length > 0 && (
        <Section title="你們可能都會喜歡的社團">
          <div className="grid gap-3 sm:grid-cols-3">
            {recommendedClubs.map((c) => (
              <Link
                key={c.id}
                href={`/clubs/${c.slug}`}
                className="min-w-0 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-ink-300"
              >
                <h3 className="break-words text-base font-semibold text-ink-900">{c.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-ink-600">{c.tagline}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {recommendedEvents.length > 0 && (
        <Section title="一起參加的體驗活動">
          <div className="grid gap-4 sm:grid-cols-2">
            {recommendedEvents.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
