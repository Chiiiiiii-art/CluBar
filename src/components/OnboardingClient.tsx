'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Share2, Sparkles } from 'lucide-react';
import { EventCard } from './EventCard';
import type { DiscoverEventCardDTO } from '@/lib/serializers';

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
      <div className="rounded-3xl border border-[var(--border-strong)] bg-white p-6 shadow-xs sm:p-8">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)]">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>免登入找社團方向（步驟 {step} / 3）</span>
        </div>

        {step === 1 && (
          <div className="mt-4 space-y-5">
            <h1 className="text-2xl font-extrabold text-slate-900">先選你目前就讀的大專校院</h1>
            <p className="text-sm text-slate-600">
              不用註冊即可瀏覽全校活躍社團日常與近期可參加體驗課。
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {universities.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUniversityId(u.id)}
                  className={`flex min-h-[48px] items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-colors ${
                    universityId === u.id
                      ? 'border-[var(--primary)] bg-orange-50 text-orange-950'
                      : 'border-[var(--border)] bg-[var(--muted)] text-slate-800 hover:bg-orange-50/50'
                  }`}
                >
                  <span>{u.name}</span>
                  {universityId === u.id && <CheckCircle2 className="h-4 w-4 text-[var(--primary)]" />}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => goStep(2)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-white"
              >
                <span>下一步</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-6">
            <h1 className="text-2xl font-extrabold text-slate-900">這學期想怎麼探索校園？</h1>

            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-600">1. 你此刻比較在意什麼？（可選 1–2 項）</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className={`min-h-[44px] rounded-xl border px-3.5 py-2.5 text-left text-xs font-bold ${
                      goals.includes(g.id)
                        ? 'border-[var(--primary)] bg-orange-50 text-orange-950'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-600">2. 挑 1–4 個看了會有點好奇的領域</p>
              <div className="flex flex-wrap gap-2">
                {domains.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDomain(d.id)}
                    className={`min-h-[44px] rounded-full px-4 text-xs font-bold ${
                      domainIds.includes(d.id)
                        ? 'bg-[var(--primary)] text-white'
                        : 'bg-[var(--muted)] text-slate-700 hover:bg-orange-100'
                    }`}
                  >
                    #{d.name_zh}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-600">3. 偏好的社團氛圍</p>
              <div className="flex flex-wrap gap-2">
                {VIBES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVibe(v.id)}
                    className={`min-h-[44px] rounded-xl border px-3.5 text-xs font-bold ${
                      vibe === v.id
                        ? 'border-[var(--primary)] bg-orange-50 text-orange-950'
                        : 'border-slate-200 bg-white text-slate-700'
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
                className="min-h-[44px] rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700"
              >
                上一步
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={submitQuiz}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-white disabled:opacity-50"
              >
                <span>{loading ? '配對中...' : '立刻看結果（免註冊）'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="mt-4 space-y-6">
            <div className="rounded-2xl bg-gradient-to-r from-orange-100 via-amber-50 to-blue-50 p-5">
              <p className="text-xs font-bold text-orange-800">你的個人校園探索特質</p>
              <h1 className="mt-1 text-2xl font-extrabold text-slate-900">{result.persona_archetype}</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={blendLoading}
                  onClick={handleCreateBlend}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  <span>{isLoggedIn ? '做一張分享卡，約朋友合拍' : '登入做個人興趣分享卡'}</span>
                </button>
                <Link
                  href={`/?university_id=${encodeURIComponent(universityId)}`}
                  className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800"
                >
                  直接進「別的聚」逛現場流 →
                </Link>
              </div>
            </div>

            {result.clubs.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">為你挑出的校內活躍社團</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {result.clubs.map((c) => (
                    <Link
                      key={c.id}
                      href={`/clubs/${c.slug}`}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--muted)] p-4 hover:border-[var(--primary)]"
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                        <span>{c.university_short_name}</span>
                        <span>● {c.pulse_label}</span>
                      </div>
                      <h3 className="mt-1 text-sm font-extrabold text-slate-900">{c.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{c.tagline}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {result.events.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">近期可直接報名的體驗場次</h2>
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
