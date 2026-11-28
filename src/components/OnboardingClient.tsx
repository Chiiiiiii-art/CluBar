'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Download, Share2 } from 'lucide-react';
import { DomainIcon } from './DomainIcon';
import { EventCard } from './EventCard';
import { RecipeCard } from './RecipeCard';
import type { DiscoverEventCardDTO } from '@/lib/serializers';
import { ONBOARDING_DISMISSED_KEY } from '@/lib/constants';
import { MAX_TAPS, cardTitle, foodLabel, parseMaker, recipeImagePath, recipePath, toRecipe, type Food, type PaletteId } from '@/lib/recipe';
import { downloadImage, preloadShareImage, shareInvite } from '@/lib/share';

import { Button, ButtonLink, EmptyState, Input, PageHeader, cn } from '@/components/ui';
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

/**
 * Interest sticker that counts taps: each tap adds one 份 with a floating "+N";
 * a long press (or Backspace) takes one back, so no extra minus button takes up room.
 */
function TapChoice({
  count,
  onAdd,
  onRemove,
  children,
}: {
  count: number;
  onAdd: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const [pops, setPops] = useState<{ id: number; text: string }[]>([]);

  const pop = (text: string) => {
    const id = Date.now() + Math.random();
    setPops((p) => [...p, { id, text }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 700);
  };
  const remove = () => {
    if (count === 0) return;
    onRemove();
    pop('−1');
  };
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <button
      type="button"
      aria-pressed={count > 0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        longPressed.current = false;
        cancel();
        timer.current = window.setTimeout(() => {
          longPressed.current = true;
          remove();
          navigator.vibrate?.(15);
        }, 450);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '-') {
          e.preventDefault();
          remove();
        }
      }}
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        if (count >= MAX_TAPS) return;
        onAdd();
        pop(`+${count + 1}`);
      }}
      style={{ WebkitTouchCallout: 'none' }}
      className={cn(
        'tactile-press relative flex min-h-12 w-full select-none items-center justify-between gap-2 rounded-xl border-2 border-border-ink px-4 py-2.5 text-left font-display text-sm',
        count > 0
          ? 'bg-spark font-bold text-fg'
          : 'bg-surface font-medium text-fg-secondary hover:bg-surface-subtle hover:text-fg'
      )}
    >
      <span className="min-w-0 break-words">{children}</span>
      {count > 0 && (
        <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-fg px-1.5 text-sm font-bold text-spark">
          {count}
          <span className="sr-only"> 份</span>
        </span>
      )}
      {pops.map((p) => (
        <span
          key={p.id}
          aria-hidden="true"
          className="animate-tap-pop pointer-events-none absolute left-1/2 top-0 font-display text-lg font-bold text-brand"
        >
          {p.text}
        </span>
      ))}
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

export function OnboardingClient({
  universities,
  domains,
  isLoggedIn,
  userName = '',
  initialUniversityId = '',
}: {
  universities: { id: string; short_name: string; name: string }[];
  domains: { id: string; slug: string; name_zh: string }[];
  isLoggedIn: boolean;
  /** Printed on the share card; editable before sharing. */
  userName?: string;
  /** School already known (cookie): start on the interest step. */
  initialUniversityId?: string;
}) {
  const router = useRouter();
  const knownSchool = universities.some((u) => u.id === initialUniversityId);
  const [step, setStep] = useState<1 | 2 | 3>(knownSchool ? 2 : 1);
  const [universityId, setUniversityId] = useState(knownSchool ? initialUniversityId : '');
  // Taps per domain slug: more taps, bigger share of the recipe.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [food, setFood] = useState<Food>('drink');
  const [palette, setPalette] = useState<PaletteId>('soda');
  const [maker, setMaker] = useState(parseMaker(userName));
  const [shareNote, setShareNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [blendLoading, setBlendLoading] = useState(false);

  const recipe = toRecipe(counts);
  const slugToId = new Map(domains.map((d) => [d.slug, d.id]));
  const domainIds = recipe.map((p) => slugToId.get(p.slug)).filter(Boolean) as string[];
  const card = { parts: recipe, food, palette, maker: parseMaker(maker) };
  const imageUrl = recipeImagePath(card);

  useEffect(() => {
    // iOS needs the share image ready before the tap (see lib/share).
    if (step === 3 && recipe.length > 0) preloadShareImage(imageUrl, 'clubar-mix.png');
  }, [step, imageUrl, recipe.length]);

  const goStep = (next: 1 | 2 | 3) => {
    setStep(next);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const bump = (slug: string, delta: 1 | -1) =>
    setCounts((prev) => ({ ...prev, [slug]: Math.max(0, Math.min(MAX_TAPS, (prev[slug] ?? 0) + delta)) }));

  const handleShare = async () => {
    const outcome = await shareInvite({
      title: cardTitle(card.maker, food),
      text: `這是${cardTitle(card.maker, food)}，你也來調一份？`,
      url: `${window.location.origin}${recipePath(card)}`,
      imageUrl,
      fileName: 'clubar-mix.png',
    });
    setShareNote(
      outcome === 'copied' ? '連結已複製，貼給朋友吧' : outcome === 'failed' ? '分享失敗，可以改用存成圖片' : ''
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
            domain_weights: counts,
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
            description="喜歡就點，越喜歡點越多下；點錯了長按可以減一份。"
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="group" aria-label="興趣領域">
            {domains.map((d) => (
              <TapChoice
                key={d.id}
                count={counts[d.slug] ?? 0}
                onAdd={() => bump(d.slug, 1)}
                onRemove={() => bump(d.slug, -1)}
              >
                <span className="inline-flex items-center gap-2">
                  <DomainIcon slug={d.slug} />
                  {d.name_zh}
                </span>
              </TapChoice>
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
              {loading ? '調配中...' : '看結果'}
            </Button>
          </div>
          <SkipLink />
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-8">
          <PageHeader
            eyebrow="測驗結果"
            title="調好了，這是你的配方"
            description="點越多下的興趣，份量越多。想換個食物也可以。"
          />
          <div className="space-y-3">
            <RecipeCard
              parts={recipe}
              food={food}
              palette={palette}
              maker={card.maker}
              onFoodChange={setFood}
              onPaletteChange={setPalette}
            />
            <div className="max-w-xs">
              <label htmlFor="onb-maker" className="mb-1 block text-sm font-semibold text-fg-secondary">
                卡片上的名字
              </label>
              <Input
                id="onb-maker"
                value={maker}
                maxLength={16}
                placeholder="留空就寫「我」"
                onChange={(e) => setMaker(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button onClick={handleShare} icon={<Share2 className="h-4 w-4" aria-hidden="true" />}>
                分享我的{foodLabel(food)}
              </Button>
              <Button
                variant="secondary"
                onClick={() => void downloadImage(imageUrl, 'clubar-mix.png')}
                icon={<Download className="h-4 w-4" aria-hidden="true" />}
              >
                存成圖片
              </Button>
            </div>
            <p className="min-h-5 text-sm text-fg-muted" role="status">
              {shareNote}
            </p>
          </div>

          {result.clubs.length === 0 && result.events.length === 0 && (
            <EmptyState
              title="這間學校還沒有這類社團的動態"
              description="換幾個興趣看看，或先逛逛全校的社團動態。"
              action={<Button variant="secondary" onClick={() => goStep(2)}>換幾個興趣</Button>}
            />
          )}

          {result.clubs.length > 0 && (
            <section className="space-y-3" aria-labelledby="onb-clubs">
              <h2 id="onb-clubs" className="font-display text-lg font-bold text-fg">
                照你的配方，挑出這些社團
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

          <div className="flex flex-wrap gap-2.5 border-t-2 border-dashed border-line pt-4">
            <ButtonLink
              href={`/?university_id=${encodeURIComponent(universityId)}${domainIds.length ? `&domain_id=${encodeURIComponent(domainIds.join(','))}` : ''}`}
              variant="secondary"
            >
              逛逛社團動態
            </ButtonLink>
            <Button variant="ghost" disabled={blendLoading} onClick={handleCreateBlend}>
              {isLoggedIn ? '約朋友比對興趣' : '登入約朋友比對興趣'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
