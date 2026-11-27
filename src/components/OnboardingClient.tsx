'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Share2, Sparkles } from 'lucide-react';
import { EventCard } from './EventCard';
import type { DiscoverEventCardDTO } from '@/lib/serializers';

import { buttonClasses } from '@/components/ui';
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border border-ink-300 bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent-600">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>免登入找社團方向（步驟 {step} / 3）</span>
        </div>

        {step === 1 && (
          <div className="mt-4 space-y-5">
            <h1 className="text-2xl font-bold text-ink-900">先選你目前就讀的大專校院</h1>
            <p className="text-sm text-ink-600">
              不用註冊即可瀏覽全校活躍社團日常與近期可參加體驗課。
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {universities.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUniversityId(u.id)}
                  className={`flex min-h-[48px] items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-bold transition-colors ${
                    universityId === u.id
                      ? 'border-accent-600 bg-accent-50 text-accent-950'
                      : 'border-line bg-ink-100 text-ink-800 hover:bg-accent-50/50'
                  }`}
                >
                  <span>{u.name}</span>
                  {universityId === u.id && <CheckCircle2 className="h-4 w-4 text-accent-600" />}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => goStep(2)}
                className={buttonClasses({ variant: 'primary', size: 'md' })}
              >
                <span>下一步</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-6">
            <h1 className="text-2xl font-bold text-ink-900">這學期想怎麼探索校園？</h1>

            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-ink-600">1. 你此刻比較在意什麼？（可選 1–2 項）</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className={`min-h-[44px] rounded-xl border px-3.5 py-2.5 text-left text-sm font-bold ${
                      goals.includes(g.id)
                        ? 'border-accent-600 bg-accent-50 text-accent-950'
                        : 'border-ink-200 bg-white text-ink-700'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-ink-600">2. 挑 1–4 個看了會有點好奇的領域</p>
              <div className="flex flex-wrap gap-2">
                {domains.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDomain(d.id)}
                    className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${
                      domainIds.includes(d.id)
                        ? 'bg-accent-600 text-white'
                        : 'bg-ink-100 text-ink-700 hover:bg-accent-100'
                    }`}
                  >
                    #{d.name_zh}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-ink-600">3. 偏好的社團氛圍</p>
              <div className="flex flex-wrap gap-2">
                {VIBES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVibe(v.id)}
                    className={`min-h-[44px] rounded-xl border px-3.5 text-sm font-bold ${
                      vibe === v.id
                        ? 'border-accent-600 bg-accent-50 text-accent-950'
                        : 'border-ink-200 bg-white text-ink-700'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => goStep(1)}
                className="min-h-[44px] rounded-xl border border-ink-300 px-4 text-sm font-semibold text-ink-700"
              >
                上一步
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={submitQuiz}
                className={buttonClasses({ variant: 'primary', size: 'md' })}
              >
                <span>{loading ? '配對中...' : '立刻看結果（免註冊）'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="mt-4 space-y-6">
            <div className="rounded-xl bg-white p-5">
              <p className="text-sm font-semibold text-accent-800">你的個人校園探索特質</p>
              <h1 className="mt-1 text-2xl font-bold text-ink-900">{result.persona_archetype}</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={blendLoading}
                  onClick={handleCreateBlend}
                  className={buttonClasses({ variant: 'primary', size: 'md' })}
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  <span>{isLoggedIn ? '做一張分享卡，約朋友合拍' : '登入做個人興趣分享卡'}</span>
                </button>
                <Link
                  href={`/?university_id=${encodeURIComponent(universityId)}`}
                  className={buttonClasses({ variant: 'secondary', size: 'md' })}
                >
                  直接進「別的聚」逛現場流 →
                </Link>
              </div>
            </div>

            {result.clubs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-ink-900">為你挑出的校內活躍社團</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.clubs.map((c) => (
                    <Link
                      key={c.id}
                      href={`/clubs/${c.slug}`}
                      className="rounded-xl border border-line bg-ink-100 p-4 hover:border-accent-600"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-success-700">
                        <span>{c.university_short_name}</span>
                        <span>● {c.pulse_label}</span>
                      </div>
                      <h3 className="mt-1 text-sm font-semibold text-ink-900">{c.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-600">{c.tagline}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {result.events.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-ink-900">近期可直接報名的體驗場次</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {result.events.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
