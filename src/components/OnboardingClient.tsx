'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Share2 } from 'lucide-react';
import { DomainIcon } from './DomainIcon';
import { EventCard } from './EventCard';
import type { DiscoverEventCardDTO } from '@/lib/serializers';
import { ONBOARDING_DISMISSED_KEY } from '@/lib/constants';

import { Button, ButtonLink, EmptyState, PageHeader, cn } from '@/components/ui';
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

/** Every step can be skipped: remember it so the home page stops offering the quiz. */
function SkipLink() {
  return (
    <p className="text-center">
      <Link
        href="/"
        onClick={() => {
          try {
            window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
          } catch {
            // Ignore storage failures
          }
        }}
        className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-fg-muted underline-offset-4 hover:text-fg hover:underline"
      >
        先隨便看看
      </Link>
    </p>
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

const MAX_DOMAINS = 3;

export function OnboardingClient({
  universities,
  domains,
  isLoggedIn,
  initialUniversityId = '',
}: {
  universities: { id: string; short_name: string; name: string }[];
  domains: { id: string; slug: string; name_zh: string }[];
  isLoggedIn: boolean;
  /** School already known (cookie): start on the interest step. */
  initialUniversityId?: string;
}) {
  const router = useRouter();
  const knownSchool = universities.some((u) => u.id === initialUniversityId);
  const [step, setStep] = useState<1 | 2 | 3>(knownSchool ? 2 : 1);
  const [universityId, setUniversityId] = useState(knownSchool ? initialUniversityId : '');
  const [domainIds, setDomainIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [blendLoading, setBlendLoading] = useState(false);

  const goStep = (next: 1 | 2 | 3) => {
    setStep(next);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleDomain = (id: string) => {
    setDomainIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_DOMAINS ? [...prev, id] : prev
    );
  };

  const submitQuiz = async () => {
    if (!universityId || domainIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university_id: universityId,
          domain_ids: domainIds,
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
            goals: [],
            domain_ids: domainIds,
            synced: false,
          })
        );
        if (isLoggedIn) {
          void fetch('/api/me/onboarding-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ university_id: universityId, goals: [], domain_ids: domainIds }),
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
          goals: [],
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
            title="你讀哪間學校？"
            description="點一下就好，不用註冊。"
          />
          <div className="grid gap-2.5 sm:grid-cols-2">
            {universities.map((u) => (
              <Choice
                key={u.id}
                selected={universityId === u.id}
                onClick={() => {
                  setUniversityId(u.id);
                  goStep(2);
                }}
              >
                {u.name}
              </Choice>
            ))}
          </div>
          <SkipLink />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <PageHeader
            title="你對哪些有點好奇？"
            description={`選 1–${MAX_DOMAINS} 個，我們只留下這些類型的社團。`}
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="group" aria-label="興趣領域">
            {domains.map((d) => (
              <Choice key={d.id} selected={domainIds.includes(d.id)} onClick={() => toggleDomain(d.id)}>
                <span className="inline-flex items-center gap-2">
                  <DomainIcon slug={d.slug} />
                  {d.name_zh}
                </span>
              </Choice>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-line pt-4">
            <Button variant="ghost" onClick={() => goStep(1)}>
              換學校
            </Button>
            <Button
              disabled={loading || domainIds.length === 0}
              onClick={submitQuiz}
              icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              className="flex-row-reverse"
            >
              {loading ? '挑選中...' : '看結果'}
            </Button>
          </div>
          <SkipLink />
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
                  href={`/?university_id=${encodeURIComponent(universityId)}${domainIds.length ? `&domain_id=${encodeURIComponent(domainIds.join(','))}` : ''}`}
                  variant="secondary"
                >
                  逛逛現場動態
                </ButtonLink>
              </>
            }
          />

          {result.clubs.length === 0 && result.events.length === 0 && (
            <EmptyState
              title="這間學校還沒有這類社團的動態"
              description="換幾個興趣看看，或先逛逛全校的社團現場。"
              action={<Button variant="secondary" onClick={() => goStep(2)}>換幾個興趣</Button>}
            />
          )}

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
