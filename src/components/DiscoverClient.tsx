'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Compass,
  Flame,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { DISCOVER_EXAMPLE_PROMPTS } from '@/lib/constants';
import type { DiscoverBatchMeta } from '@/lib/discovery/service';
import type { DiscoverEventCardDTO, DiscoverStreamCardDTO } from '@/lib/serializers';
import { EventCard } from './EventCard';
import { PostCard } from './PostCard';

interface UniversityOption {
  id: string;
  short_name: string;
  name: string;
}

interface DomainOption {
  id: string;
  slug: string;
  name_zh: string;
}

export function DiscoverClient({
  initialTab = 'stream',
  initialStreamItems,
  initialStreamMeta,
  initialEventItems,
  initialEventMeta,
  universities,
  domains,
  dbConfigured,
  initialUniversityId = '',
  isLoggedIn = false,
}: {
  initialTab?: 'stream' | 'events';
  initialStreamItems: DiscoverStreamCardDTO[];
  initialStreamMeta: DiscoverBatchMeta;
  initialEventItems: DiscoverEventCardDTO[];
  initialEventMeta: DiscoverBatchMeta;
  universities: UniversityOption[];
  domains: DomainOption[];
  dbConfigured: boolean;
  initialUniversityId?: string;
  isLoggedIn?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'stream' | 'events'>(initialTab);
  const [selectedUniId, setSelectedUniId] = useState(initialUniversityId);
  const [selectedDomainId, setSelectedDomainId] = useState('');

  // Stream tab state
  const [streamItems, setStreamItems] = useState<DiscoverStreamCardDTO[]>(initialStreamItems);
  const [streamMeta, setStreamMeta] = useState<DiscoverBatchMeta>(initialStreamMeta);

  // Events tab state & filters
  const [eventItems, setEventItems] = useState<DiscoverEventCardDTO[]>(initialEventItems);
  const [eventMeta, setEventMeta] = useState<DiscoverBatchMeta>(initialEventMeta);
  const [dateRange, setDateRange] = useState<'all' | 'this_week' | 'this_month'>('all');
  const [beginnerOnly, setBeginnerOnly] = useState(false);
  const [nonMemberOnly, setNonMemberOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [hoursOnly, setHoursOnly] = useState(false);
  const [votingOnly, setVotingOnly] = useState(false);

  // Shared progressive search capsule
  const [query, setQuery] = useState('');
  const [activeNlQuery, setActiveNlQuery] = useState<string | null>(null);
  const [degradedWarning, setDegradedWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnboardingPrompt, setShowOnboardingPrompt] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('clubar_onboarding');
      if (!saved && !initialUniversityId) {
        setShowOnboardingPrompt(true);
      } else if (saved && isLoggedIn) {
        const parsed = JSON.parse(saved);
        if (!parsed.synced) {
          void fetch('/api/me/onboarding-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              university_id: parsed.university_id,
              goals: parsed.goals ?? [],
              domain_ids: parsed.domain_ids ?? [],
              vibe: parsed.vibe,
            }),
          }).then((res) => {
            if (res.ok) {
              window.localStorage.setItem(
                'clubar_onboarding',
                JSON.stringify({ ...parsed, synced: true })
              );
            }
          });
        }
      }
    } catch {
      // Ignore storage failures
    }
  }, [initialUniversityId, isLoggedIn]);

  const loadStream = async (opts: {
    uniId?: string;
    domainId?: string;
    excludeIds?: string[];
  }) => {
    setLoading(true);
    setError(null);
    setDegradedWarning(null);
    setActiveNlQuery(null);
    try {
      const sp = new URLSearchParams();
      if (opts.uniId) sp.set('university_id', opts.uniId);
      if (opts.domainId) sp.set('domain_id', opts.domainId);
      if (opts.excludeIds?.length) sp.set('exclude_ids', opts.excludeIds.join(','));
      const res = await fetch(`/api/discover/stream?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '載入現場流失敗。');
        return;
      }
      setStreamItems(json.items ?? []);
      setStreamMeta(json.batch_meta);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async (opts: {
    uniId?: string;
    domainId?: string;
    dateRange?: 'all' | 'this_week' | 'this_month';
    beginnerOnly?: boolean;
    nonMemberOnly?: boolean;
    freeOnly?: boolean;
    hoursOnly?: boolean;
    votingOnly?: boolean;
    excludeIds?: string[];
  }) => {
    setLoading(true);
    setError(null);
    setDegradedWarning(null);
    setActiveNlQuery(null);
    try {
      const sp = new URLSearchParams();
      if (opts.uniId) sp.set('university_id', opts.uniId);
      if (opts.domainId) sp.set('domain_id', opts.domainId);
      if (opts.dateRange && opts.dateRange !== 'all') sp.set('date_range', opts.dateRange);
      if (opts.beginnerOnly) sp.set('beginner_only', 'true');
      if (opts.nonMemberOnly) sp.set('non_member_only', 'true');
      if (opts.freeOnly) sp.set('free_only', 'true');
      if (opts.hoursOnly) sp.set('hours_type', 'life');
      if (opts.votingOnly) sp.set('voting_only', 'true');
      if (opts.excludeIds?.length) sp.set('exclude_ids', opts.excludeIds.join(','));

      const res = await fetch(`/api/discover/events?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '載入近期可參加活動失敗。');
        return;
      }
      setEventItems(json.items ?? []);
      setEventMeta(json.batch_meta);
    } finally {
      setLoading(false);
    }
  };

  const submitQuery = async (text?: string, targetTab: 'stream' | 'events' = activeTab) => {
    const q = (text ?? query).trim();
    if (q.length < 2) {
      setError('請輸入至少 2 個字的需求描述。');
      return;
    }
    setQuery(q);
    setActiveNlQuery(q);
    setDegradedWarning(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/discover/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          university_id: selectedUniId || undefined,
          tab: targetTab,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '搜尋暫時無法使用。');
        return;
      }
      if (targetTab === 'events') {
        setEventItems(json.items ?? []);
        setEventMeta(json.batch_meta);
      } else {
        setStreamItems(json.items ?? []);
        setStreamMeta(json.batch_meta);
      }
      if (json.degraded && json.warning_message) {
        setDegradedWarning(json.warning_message);
      }
    } catch {
      setError('網路連線異常，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const handleUniChange = (nextUniId: string) => {
    setSelectedUniId(nextUniId);
    if (nextUniId) {
      document.cookie = `clubar_univ=${encodeURIComponent(nextUniId)}; path=/; max-age=2592000; SameSite=Lax`;
    } else {
      document.cookie = 'clubar_univ=; path=/; max-age=0';
    }
    setShowOnboardingPrompt(false);
    if (activeTab === 'stream') {
      void loadStream({ uniId: nextUniId, domainId: selectedDomainId });
    } else {
      void loadEvents({
        uniId: nextUniId,
        domainId: selectedDomainId,
        dateRange,
        beginnerOnly,
        nonMemberOnly,
        freeOnly,
        hoursOnly,
        votingOnly,
      });
    }
  };

  const handleDomainSelect = (domainId: string) => {
    const next = selectedDomainId === domainId ? '' : domainId;
    setSelectedDomainId(next);
    if (activeTab === 'stream') {
      void loadStream({ uniId: selectedUniId, domainId: next });
    } else {
      void loadEvents({
        uniId: selectedUniId,
        domainId: next,
        dateRange,
        beginnerOnly,
        nonMemberOnly,
        freeOnly,
        hoursOnly,
        votingOnly,
      });
    }
  };

  const handleTabSwitch = (nextTab: 'stream' | 'events') => {
    setActiveTab(nextTab);
    if (activeNlQuery) {
      void submitQuery(activeNlQuery, nextTab);
    }
  };

  return (
    <div className="space-y-5">
      {/* First-visit zero-friction onboarding invitation */}
      {showOnboardingPrompt && (
        <section className="flex flex-col justify-between gap-3 rounded-3xl border border-orange-300 bg-gradient-to-r from-orange-50 via-amber-50 to-blue-50 p-4 shadow-xs sm:flex-row sm:items-center sm:p-5">
          <div className="space-y-1">
            <p className="text-sm font-extrabold text-slate-900">
              第一次找社團？30 秒免註冊測出你的校園興趣 Blend
            </p>
            <p className="text-xs text-slate-600">
              選你的學校與 2–3 個偏好問題，立即濾出零基礎友善體驗與潛在寶藏小社團，還能約朋友合拍。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/onboarding"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
            >
              <span>開始適性破冰</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setShowOnboardingPrompt(false)}
              className="min-h-[44px] rounded-xl border border-[var(--border-strong)] bg-white px-3 text-xs font-semibold text-slate-600"
            >
              先逛逛
            </button>
          </div>
        </section>
      )}

      {/* Lightweight progressive discovery capsule + sibling tabs */}
      <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-3">
          {/* Sibling Dual Tabs + School Picker */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="inline-flex rounded-2xl bg-[var(--muted)] p-1"
              role="tablist"
              aria-label="別的聚雙分頁切換"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'stream'}
                onClick={() => handleTabSwitch('stream')}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-colors sm:text-sm ${
                  activeTab === 'stream'
                    ? 'bg-white text-[var(--primary)] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="h-4 w-4" aria-hidden="true" />
                <span>探索現場流</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'events'}
                onClick={() => handleTabSwitch('events')}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-colors sm:text-sm ${
                  activeTab === 'events'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <span>近期可參加</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="選擇學校"
                value={selectedUniId}
                onChange={(e) => handleUniChange(e.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-[var(--muted)] px-3 text-xs font-semibold text-slate-800"
              >
                <option value="">全部大專校院</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.short_name}
                  </option>
                ))}
              </select>
              <Link
                href="/onboarding"
                className="hidden min-h-[40px] items-center gap-1 rounded-xl border border-orange-200 bg-orange-50 px-3 text-xs font-bold text-orange-900 sm:inline-flex"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>興趣 Blend</span>
              </Link>
            </div>
          </div>

          {/* Single search capsule */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitQuery(undefined, activeTab);
            }}
            className="flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--muted)] px-3 py-1"
          >
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="白話搜尋：週四晚上想學畫畫沒基礎、或週末去爬郊山..."
              className="min-h-[40px] w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            {activeNlQuery && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveNlQuery(null);
                  if (activeTab === 'stream') {
                    void loadStream({ uniId: selectedUniId, domainId: selectedDomainId });
                  } else {
                    void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId });
                  }
                }}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-white px-2.5 text-xs font-semibold text-slate-600"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="min-h-[40px] shrink-0 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {loading ? '搜尋中' : '探索'}
            </button>
          </form>

          {/* Horizontal interest domains */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {domains.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDomainSelect(d.id)}
                className={`min-h-[36px] shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  selectedDomainId === d.id
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--muted)] text-slate-700 hover:bg-orange-100'
                }`}
              >
                #{d.name_zh}
              </button>
            ))}
          </div>

          {/* Action Event filters (only visible in Tab B) */}
          {activeTab === 'events' ? (
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-2.5">
              {[
                { label: '本週活動', active: dateRange === 'this_week', onClick: () => { const n = dateRange === 'this_week' ? 'all' : 'this_week'; setDateRange(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange: n, beginnerOnly, nonMemberOnly, freeOnly, hoursOnly, votingOnly }); } },
                { label: '零基礎可', active: beginnerOnly, onClick: () => { const n = !beginnerOnly; setBeginnerOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly: n, nonMemberOnly, freeOnly, hoursOnly, votingOnly }); } },
                { label: '非社員可', active: nonMemberOnly, onClick: () => { const n = !nonMemberOnly; setNonMemberOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly, nonMemberOnly: n, freeOnly, hoursOnly, votingOnly }); } },
                { label: '免費參加', active: freeOnly, onClick: () => { const n = !freeOnly; setFreeOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly, nonMemberOnly, freeOnly: n, hoursOnly, votingOnly }); } },
                { label: '有學習時數', active: hoursOnly, onClick: () => { const n = !hoursOnly; setHoursOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly, nonMemberOnly, freeOnly, hoursOnly: n, votingOnly }); } },
                { label: 'TBD 喬時間中', active: votingOnly, onClick: () => { const n = !votingOnly; setVotingOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly, nonMemberOnly, freeOnly, hoursOnly, votingOnly: n }); } },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onClick}
                  className={`min-h-[34px] rounded-full border px-3 text-xs font-semibold transition-colors ${
                    chip.active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {DISCOVER_EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => void submitQuery(ex, 'stream')}
                  className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50/70 px-3 py-1 text-[11px] font-medium text-orange-900 hover:bg-orange-100"
                >
                  <Sparkles className="h-3 w-3 text-[var(--brand)]" aria-hidden="true" />
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {!dbConfigured && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          資料庫尚未設定完成，目前顯示空狀態。
        </div>
      )}

      {degradedWarning && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-semibold text-amber-950">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
          <span>{degradedWarning}</span>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Results Grid */}
      {activeTab === 'stream' ? (
        streamItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-white p-10 text-center">
            <Compass className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-bold text-slate-900">沒有更多符合條件的現場動態了</p>
            <button
              type="button"
              onClick={() => {
                setSelectedDomainId('');
                void loadStream({ uniId: selectedUniId });
              }}
              className="mt-3 min-h-[40px] rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white"
            >
              回到最新現場流
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {streamItems.map((card) => (
              <PostCard
                key={card.id}
                card={card}
                sourceSurface={activeNlQuery ? 'discover_nl' : 'discover_stream'}
              />
            ))}
          </div>
        )
      ) : eventItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-white p-10 text-center">
          <Calendar className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-bold text-slate-900">目前條件下尚無近期體驗活動</p>
          <button
            type="button"
            onClick={() => {
              setDateRange('all');
              setBeginnerOnly(false);
              setNonMemberOnly(false);
              setFreeOnly(false);
              setHoursOnly(false);
              setVotingOnly(false);
              void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId });
            }}
            className="mt-3 min-h-[40px] rounded-xl bg-blue-600 px-4 text-xs font-bold text-white"
          >
            清除活動篩選條件
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {eventItems.map((ev) => (
            <EventCard key={ev.id} event={ev} />
          ))}
        </div>
      )}

      {/* Controlled Batch Pagination Card */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-5 text-center sm:flex-row sm:text-left">
        <div className="text-xs text-slate-600">
          <p className="font-bold text-slate-800">
            本批次呈現 {activeTab === 'stream' ? streamMeta.count : eventMeta.count} 則（單社團最多 2 則・不連發・零讚粉排行）
          </p>
          <p className="mt-0.5">逛累了可直接切換分頁看活動，或約朋友測一場雙人興趣 Blend。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(activeTab === 'stream' ? streamMeta.has_more : eventMeta.has_more) && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (activeTab === 'stream') {
                  void loadStream({
                    uniId: selectedUniId,
                    domainId: selectedDomainId,
                    excludeIds: streamMeta.next_exclude_ids,
                  });
                } else {
                  void loadEvents({
                    uniId: selectedUniId,
                    domainId: selectedDomainId,
                    dateRange,
                    beginnerOnly,
                    nonMemberOnly,
                    freeOnly,
                    hoursOnly,
                    votingOnly,
                    excludeIds: eventMeta.next_exclude_ids,
                  });
                }
              }}
              className="min-h-[44px] rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              換下一批（12 則）
            </button>
          )}
          <button
            type="button"
            onClick={() => handleTabSwitch(activeTab === 'stream' ? 'events' : 'stream')}
            className="min-h-[44px] rounded-xl border border-[var(--border-strong)] bg-[var(--muted)] px-4 text-xs font-bold text-slate-800 hover:bg-orange-100"
          >
            {activeTab === 'stream' ? '逛逛近期可參加活動 →' : '看社團日常現場流 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
