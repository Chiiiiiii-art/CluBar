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
  const [showExamples, setShowExamples] = useState(false);

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
      if (opts.hoursOnly) sp.set('has_hours', 'true');
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

  const hasActiveEventFilters =
    dateRange !== 'all' ||
    beginnerOnly ||
    nonMemberOnly ||
    freeOnly ||
    hoursOnly ||
    votingOnly ||
    Boolean(selectedDomainId) ||
    Boolean(activeNlQuery);

  const resetAllFilters = () => {
    setQuery('');
    setActiveNlQuery(null);
    setSelectedDomainId('');
    setDateRange('all');
    setBeginnerOnly(false);
    setNonMemberOnly(false);
    setFreeOnly(false);
    setHoursOnly(false);
    setVotingOnly(false);
    if (activeTab === 'stream') {
      void loadStream({ uniId: selectedUniId });
    } else {
      void loadEvents({ uniId: selectedUniId });
    }
  };

  return (
    <div className="space-y-4">
      {/* First-visit zero-friction onboarding invitation */}
      {showOnboardingPrompt && (
        <section className="flex flex-col justify-between gap-2.5 rounded-xl border border-accent-300 bg-gradient-to-r from-accent-50 via-warning-50 to-accent-50 px-4 py-3 shadow-xs sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">
              30 秒挑出適合你的社團
            </p>
            <p className="text-sm text-ink-600">
              選學校與偏好，免註冊看對應作品與體驗課。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/onboarding"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700"
            >
              <span>開始挑選</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => setShowOnboardingPrompt(false)}
              className="min-h-[44px] rounded-xl border border-ink-300 bg-white px-3.5 text-sm font-semibold text-ink-700 hover:bg-accent-50"
            >
              先逛逛
            </button>
          </div>
        </section>
      )}

      {/* Compact discovery bar + sibling tabs */}
      <section className="rounded-xl border border-ink-300 bg-white p-3.5 shadow-xs sm:p-4">
        <div className="flex flex-col gap-2.5">
          {/* Sibling Dual Tabs + School Picker */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="inline-flex rounded-xl bg-ink-100 p-1"
              role="tablist"
              aria-label="別的聚分頁切換"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'stream'}
                onClick={() => handleTabSwitch('stream')}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold transition-colors sm:px-4 sm:text-sm ${
                  activeTab === 'stream'
                    ? 'bg-white text-accent-600 shadow-xs'
                    : 'text-ink-600 hover:text-ink-900'
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
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold transition-colors sm:px-4 sm:text-sm ${
                  activeTab === 'events'
                    ? 'bg-white text-accent-700 shadow-xs'
                    : 'text-ink-600 hover:text-ink-900'
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
                className="h-11 rounded-xl border border-line-input bg-ink-100 px-3 py-0 text-sm font-semibold leading-none text-ink-800"
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
                className="hidden min-h-[44px] items-center gap-1 rounded-xl border border-accent-200 bg-accent-50 px-3.5 text-sm font-semibold text-accent-900 hover:bg-accent-100 sm:inline-flex"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>興趣測驗</span>
              </Link>
            </div>
          </div>

          {/* Single search capsule */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitQuery(undefined, activeTab);
            }}
            className="flex items-center gap-2 rounded-xl border border-ink-300 bg-ink-100 px-3 py-1"
          >
            <Search className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
            <input
              type="text"
              aria-label="白話搜尋社團或活動"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋主題、時間或新手問題..."
              className="min-h-[44px] w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-500"
            />
            {activeNlQuery && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl bg-white px-3 text-sm font-semibold text-ink-700 hover:bg-ink-50"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                重置
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] shrink-0 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
            >
              {loading ? '搜尋中' : '探索'}
            </button>
          </form>

          {/* Horizontal interest domains (scrollbar hidden, >=44px touch height) */}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {domains.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDomainSelect(d.id)}
                className={`min-h-[44px] shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                  selectedDomainId === d.id
                    ? 'bg-accent-600 text-white'
                    : 'bg-ink-100 text-ink-700 hover:bg-accent-100'
                }`}
              >
                #{d.name_zh}
              </button>
            ))}
          </div>

          {/* Action Event filters or Progressive Prompt Helper */}
          {activeTab === 'events' ? (
            <div className="space-y-2 border-t border-line pt-2">
              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto sm:flex-wrap">
                {[
                  { label: '本週活動', active: dateRange === 'this_week', onClick: () => { const n = dateRange === 'this_week' ? 'all' : 'this_week'; setDateRange(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange: n, beginnerOnly, nonMemberOnly, freeOnly, hoursOnly, votingOnly }); } },
                  { label: '零基礎可', active: beginnerOnly, onClick: () => { const n = !beginnerOnly; setBeginnerOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly: n, nonMemberOnly, freeOnly, hoursOnly, votingOnly }); } },
                  { label: '非社員可', active: nonMemberOnly, onClick: () => { const n = !nonMemberOnly; setNonMemberOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly, nonMemberOnly: n, freeOnly, hoursOnly, votingOnly }); } },
                  { label: '免費參加', active: freeOnly, onClick: () => { const n = !freeOnly; setFreeOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly, nonMemberOnly, freeOnly: n, hoursOnly, votingOnly }); } },
                  { label: '有學習時數', active: hoursOnly, onClick: () => { const n = !hoursOnly; setHoursOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly, nonMemberOnly, freeOnly, hoursOnly: n, votingOnly }); } },
                  { label: '時間投票中', active: votingOnly, onClick: () => { const n = !votingOnly; setVotingOnly(n); void loadEvents({ uniId: selectedUniId, domainId: selectedDomainId, dateRange, beginnerOnly, nonMemberOnly, freeOnly, hoursOnly, votingOnly: n }); } },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={chip.onClick}
                    className={`min-h-[44px] shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
                      chip.active
                        ? 'border-accent-600 bg-accent-600 text-white'
                        : 'border-ink-200 bg-white text-ink-700 hover:bg-accent-50'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
                {hasActiveEventFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-full border border-ink-300 bg-ink-50 px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    清除條件
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowExamples((v) => !v)}
                  aria-expanded={showExamples}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50/70 px-3.5 text-sm font-semibold text-accent-900 hover:bg-accent-100"
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent-600" aria-hidden="true" />
                  <span>{showExamples ? '收合範例問法' : '不知道怎麼搜？看範例問法'}</span>
                </button>
                {(selectedDomainId || activeNlQuery) && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-ink-200 bg-white px-3.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    清除篩選
                  </button>
                )}
              </div>
              {showExamples && (
                <div className="flex flex-wrap gap-2">
                  {DISCOVER_EXAMPLE_PROMPTS.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => void submitQuery(ex, 'stream')}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50/70 px-3.5 py-1.5 text-left text-sm font-medium text-accent-900 hover:bg-accent-100"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-600" aria-hidden="true" />
                      <span>{ex}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {!dbConfigured && (
        <div className="rounded-xl border border-warning-300 bg-warning-50 p-4 text-sm text-warning-900">
          資料庫尚未設定完成，目前顯示空狀態。
        </div>
      )}

      {degradedWarning && (
        <div className="flex items-center gap-2 rounded-xl border border-warning-300 bg-warning-50 p-4 text-sm font-semibold text-warning-950">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-700" aria-hidden="true" />
          <span>{degradedWarning}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm font-semibold text-danger-800">
          {error}
        </div>
      )}

      {/* Results Area with Skeletons (U3) & CSS Masonry (D-02) */}
      {loading ? (
        <div
          aria-busy="true"
          aria-label="正在載入內容"
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-xl border border-line bg-white p-4 shadow-xs"
            >
              <div
                className="w-full animate-pulse rounded-xl bg-ink-100"
                style={{ aspectRatio: idx % 2 === 0 ? '4 / 5' : '16 / 10' }}
              />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-ink-100" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-ink-100" />
            </div>
          ))}
        </div>
      ) : activeTab === 'stream' ? (
        streamItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white p-10 text-center">
            <Compass className="mx-auto h-8 w-8 text-ink-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-ink-900">沒有符合目前條件的現場內容</p>
            <p className="mt-1 text-sm text-ink-600">清除搜尋或切換其他興趣領域看看。</p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-accent-600 px-5 text-sm font-semibold text-white hover:bg-accent-700"
            >
              回到全部現場流
            </button>
          </div>
        ) : (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {streamItems.map((card) => (
              <div key={card.id} className="mb-5 break-inside-avoid">
                <PostCard
                  card={card}
                  sourceSurface={activeNlQuery ? 'discover_nl' : 'discover_stream'}
                />
              </div>
            ))}
          </div>
        )
      ) : eventItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white p-10 text-center">
          <Calendar className="mx-auto h-8 w-8 text-ink-500" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-ink-900">目前條件下沒有近期體驗活動</p>
          <p className="mt-1 text-sm text-ink-600">放寬篩選條件就能看到更多活動。</p>
          <button
            type="button"
            onClick={resetAllFilters}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-accent-600 px-5 text-sm font-semibold text-white hover:bg-accent-700"
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
      <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-line bg-white p-5 text-center sm:flex-row sm:text-left">
        <div className="text-sm text-ink-600">
          <p className="font-bold text-ink-800">
            已看 {activeTab === 'stream' ? streamMeta.count : eventMeta.count} 則，每個社團最多顯示 2 則、不依讚數排序
          </p>
          <p className="mt-0.5">換下一批，或切換分頁看體驗活動與社團日常。</p>
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
              className="min-h-[44px] rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
            >
              換下一批（12 則）
            </button>
          )}
          <button
            type="button"
            onClick={() => handleTabSwitch(activeTab === 'stream' ? 'events' : 'stream')}
            className="min-h-[44px] rounded-xl border border-ink-300 bg-ink-100 px-4 text-sm font-semibold text-ink-800 hover:bg-accent-100"
          >
            {activeTab === 'stream' ? '逛逛近期可參加活動 →' : '看社團日常現場流 →'}
          </button>
        </div>
      </div>
    </div>
  );
}
