'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Share2 } from 'lucide-react';
import { EventCard } from './EventCard';
import type { DiscoverEventCardDTO } from '@/lib/serializers';

import { Button, ButtonLink, PageHeader, cn } from '@/components/ui';
interface RecommendResult {
  persona_archetype: string;
  clubs: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    university_short_name: string;
    pulse_label: string;
    is_demo: boolean;
  }[];
  events: DiscoverEventCardDTO[];
}

const GOALS = [
  { id: 'make_friends', label: '想破冰交友、認識跨系同學' },
  { id: 'learn_skill', label: '想從零學一項酷技能或創作作品' },
  { id: 'weekend_fun', label: '想找下課或週末輕鬆參與的活動' },
  { id: 'earn_hours', label: '想順便累積藝文／生活／服務時數' },
];

const VIBES = [
  { id: 'hands_on', label: '動手做專案／實作派' },
  { id: 'chill', label: '低壓力、像跟朋友聊天的氛圍' },
  { id: 'active', label: '戶外活動或揮汗運動' },
];

/** One selected style for every step: dark border, light fill, check mark. */
function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'tactile-press flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-2 border-border-ink px-4 py-2.5 text-left font-display text-sm',
        selected
          ? 'bg-spark font-bold text-fg'
          : 'bg-surface font-medium text-fg-secondary hover:bg-surface-subtle hover:text-fg'
      )}
    >
      <span className="min-w-0 break-words">{children}</span>
      {selected && <Check className="h-4 w-4 shrink-0 text-fg" aria-hidden="true" />}
    </button>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div>
      <p className="text-sm font-medium text-fg-muted">步驟 {step} / 3</p>
      <div
        role="progressbar"
        aria-label="完成進度"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        aria-valuetext={`步驟 ${step} / 3`}
        className="mt-2 h-2 overflow-hidden rounded-full border border-border-ink bg-surface-sunken"
      >
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function OnboardingClient({
  universities,
  domains,
  isLoggedIn,
}: {
  universities: { id: string; short_name: string; name: string }[];
  domains: { id: string; slug: string; name_zh: string }[];
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [universityId, setUniversityId] = useState(universities[0]?.id ?? '');
  const [goals, setGoals] = useState<string[]>(['make_friends']);
  const [domainIds, setDomainIds] = useState<string[]>([]);
  const [vibe, setVibe] = useState('hands_on');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [blendLoading, setBlendLoading] = useState(false);

  const goStep = (next: 1 | 2 | 3) => {
    setStep(next);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1]!, id]
    );
  };

  const toggleDomain = (id: string) => {
    setDomainIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const submitQuiz = async () => {
    if (!universityId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university_id: universityId,
          goals,
          domain_ids: domainIds,
          vibe,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult(json);
        goStep(3);
        document.cookie = `clubar_univ=${encodeURIComponent(universityId)}; path=/; max-age=2592000; SameSite=Lax`;
        window.localStorage.setItem(
          'clubar_onboarding',
          JSON.stringify({
            university_id: universityId,
            goals,
            domain_ids: domainIds,
            vibe,
            synced: false,
          })
        );
        if (isLoggedIn) {
          void fetch('/api/me/onboarding-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ university_id: universityId, goals, domain_ids: domainIds, vibe }),
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBlend = async () => {
    if (!isLoggedIn) {
      router.push('/login?callbackUrl=/onboarding');
      return;
    }
    setBlendLoading(true);
    try {
      const res = await fetch('/api/blends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university_id: universityId,
          domain_ids: domainIds,
          goals,
        }),
      });
      const json = await res.json();
      if (res.ok && json.blend?.short_code) {
        router.push(`/blend/${json.blend.short_code}`);
      }
    } finally {
      setBlendLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-6">
          <PageHeader
            title="先選你就讀的大專校院"
            description="不用註冊，就能瀏覽全校活躍社團與近期可參加的體驗課。"
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {universities.map((u) => (
              <Choice key={u.id} selected={universityId === u.id} onClick={() => setUniversityId(u.id)}>
                {u.name}
              </Choice>
            ))}
          </div>
          <div className="flex justify-end border-t-2 border-dashed border-line pt-4">
            <Button size="md" onClick={() => goStep(2)} icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />} className="flex-row-reverse">
              下一步
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8">
          <PageHeader title="這學期想怎麼探索校園？" />

          <section className="space-y-3" aria-labelledby="onb-goals">
            <h2 id="onb-goals" className="font-display text-base font-bold text-fg">
              你現在比較在意什麼？
              <span className="ml-2 text-sm font-normal text-fg-muted">可選 1–2 項</span>
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {GOALS.map((g) => (
                <Choice key={g.id} selected={goals.includes(g.id)} onClick={() => toggleGoal(g.id)}>
                  {g.label}
                </Choice>
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="onb-domains">
            <h2 id="onb-domains" className="font-display text-base font-bold text-fg">
              挑幾個你有點好奇的領域
              <span className="ml-2 text-sm font-normal text-fg-muted">可選 1–4 個</span>
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {domains.map((d) => (
                <Choice key={d.id} selected={domainIds.includes(d.id)} onClick={() => toggleDomain(d.id)}>
                  #{d.name_zh}
                </Choice>
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="onb-vibe">
            <h2 id="onb-vibe" className="font-display text-base font-bold text-fg">
              偏好的社團氛圍
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {VIBES.map((v) => (
                <Choice key={v.id} selected={vibe === v.id} onClick={() => setVibe(v.id)}>
                  {v.label}
                </Choice>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-line pt-4">
            <Button variant="ghost" onClick={() => goStep(1)}>
              上一步
            </Button>
            <Button
              disabled={loading}
              onClick={submitQuiz}
              icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              className="flex-row-reverse"
            >
              {loading ? '配對中...' : '看結果（免註冊）'}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-8">
          <PageHeader
            eyebrow="你的校園探索類型"
            title={result.persona_archetype}
            action={
              <>
                <Button
                  disabled={blendLoading}
                  onClick={handleCreateBlend}
                  icon={<Share2 className="h-4 w-4" aria-hidden="true" />}
                >
                  {isLoggedIn ? '做一張分享卡，約朋友合拍' : '登入做興趣分享卡'}
                </Button>
                <ButtonLink
                  href={`/?university_id=${encodeURIComponent(universityId)}`}
                  variant="secondary"
                >
                  逛逛現場動態
                </ButtonLink>
              </>
            }
          />

          {result.clubs.length > 0 && (
            <section className="space-y-3" aria-labelledby="onb-clubs">
              <h2 id="onb-clubs" className="font-display text-lg font-bold text-fg">
                為你挑出的校內活躍社團
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {result.clubs.map((c) => (
                  <Link
                    key={c.id}
                    href={`/clubs/${c.slug}`}
                    className="tactile-card tactile-card-interactive tactile-press min-w-0 rounded-2xl bg-surface p-4"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm text-fg-muted">
                      <span className="truncate">{c.university_short_name}</span>
                      <span className="shrink-0 text-success-fg">● {c.pulse_label}</span>
                    </div>
                    <h3 className="mt-1 break-words font-display text-base font-bold text-fg">{c.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{c.tagline}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {result.events.length > 0 && (
            <section className="space-y-3" aria-labelledby="onb-events">
              <h2 id="onb-events" className="font-display text-lg font-bold text-fg">
                近期可直接報名的體驗場次
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.events.map((ev) => (
                  <EventCard key={ev.id} event={ev} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
