'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, Compass, Flame, RotateCcw, Search, Sparkles, X } from 'lucide-react';
import { Button, ButtonLink, ChipRow, EmptyState, FilterChip, Notice, Skeleton, Tabs, controlClasses, tabPanelProps } from '@/components/ui';
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

  const reloadEvents = (patch: Partial<Parameters<typeof loadEvents>[0]>) =>
    void loadEvents({
      uniId: selectedUniId,
      domainId: selectedDomainId,
      dateRange,
      beginnerOnly,
      nonMemberOnly,
      freeOnly,
      hoursOnly,
      votingOnly,
      ...patch,
    });

  const eventChips = [
    { label: '本週', active: dateRange === 'this_week', onClick: () => { const n = dateRange === 'this_week' ? 'all' : 'this_week'; setDateRange(n); reloadEvents({ dateRange: n }); } },
    { label: '零基礎可', active: beginnerOnly, onClick: () => { setBeginnerOnly(!beginnerOnly); reloadEvents({ beginnerOnly: !beginnerOnly }); } },
    { label: '非社員可', active: nonMemberOnly, onClick: () => { setNonMemberOnly(!nonMemberOnly); reloadEvents({ nonMemberOnly: !nonMemberOnly }); } },
    { label: '免費', active: freeOnly, onClick: () => { setFreeOnly(!freeOnly); reloadEvents({ freeOnly: !freeOnly }); } },
    { label: '有學習時數', active: hoursOnly, onClick: () => { setHoursOnly(!hoursOnly); reloadEvents({ hoursOnly: !hoursOnly }); } },
    { label: '時間投票中', active: votingOnly, onClick: () => { setVotingOnly(!votingOnly); reloadEvents({ votingOnly: !votingOnly }); } },
  ] as const;

  const hasAnyFilter = activeTab === 'events' ? hasActiveEventFilters : Boolean(selectedDomainId || activeNlQuery);
  const examplesVisible = showExamples && activeTab === 'stream' && !query.trim();

  return (
    <div className="space-y-6">
      {/* First-visit invitation: one dismissible line, not a hero */}
      {showOnboardingPrompt && (
        <div className="flex items-center gap-3 rounded-xl bg-ink-900 py-2 pr-2 pl-4 text-white">
          <Sparkles className="h-4 w-4 shrink-0 text-accent-300" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">第一次來？</span>
            <span className="text-ink-300"> 30 秒挑出適合你的社團</span>
          </p>
          <Link
            href="/onboarding"
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-surface px-3 text-sm font-semibold text-fg hover:bg-surface-sunken"
          >
            開始
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setShowOnboardingPrompt(false)}
            aria-label="關閉提示"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Discovery controls sit directly on the page: no card around them */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Tabs
            label="別的聚分頁切換"
            idPrefix="discover"
            value={activeTab}
            onChange={handleTabSwitch}
            items={[
              { id: 'stream', label: '社團現場', icon: <Flame className="hidden h-4 w-4 sm:block" aria-hidden="true" /> },
              { id: 'events', label: '近期活動', icon: <Calendar className="hidden h-4 w-4 sm:block" aria-hidden="true" /> },
            ]}
          />
          <div className="flex items-center gap-2">
            <select
              aria-label="選擇學校"
              value={selectedUniId}
              onChange={(e) => handleUniChange(e.target.value)}
              className={`${controlClasses} min-h-11 max-w-[8.5rem] sm:max-w-none`}
            >
              <option value="">全部學校</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.short_name}
                </option>
              ))}
            </select>
            <div className="hidden sm:block">
              <ButtonLink
                href="/onboarding"
                variant="secondary"
                icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
              >
                興趣測驗
              </ButtonLink>
            </div>
          </div>
        </div>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setShowExamples(false);
            void submitQuery(undefined, activeTab);
          }}
          className="relative"
        >
          <div className="flex items-center gap-2 rounded-xl border border-line-input bg-surface py-1 pr-1 pl-3.5 transition-shadow focus-within:border-brand focus-within:ring-2 focus-within:ring-focus-ring/20">
            <Search className="h-5 w-5 shrink-0 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              aria-label="用一句話搜尋社團或活動"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowExamples(true)}
              onBlur={() => window.setTimeout(() => setShowExamples(false), 150)}
              placeholder="想找什麼？例如：週末、零基礎、不用買器材"
              className="min-h-11 w-full min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
            />
            <Button type="submit" loading={loading} size="sm" className="min-h-10">
              搜尋
            </Button>
          </div>
          {examplesVisible && (
            <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl border border-line bg-surface p-2 shadow-lg">
              <p className="px-2 pt-1 pb-2 text-xs font-medium text-fg-subtle">試試這樣問</p>
              <ul>
                {DISCOVER_EXAMPLE_PROMPTS.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setShowExamples(false);
                        void submitQuery(ex, 'stream');
                      }}
                      className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-fg-body hover:bg-surface-subtle"
                    >
                      <Search className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      <span>{ex}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <ChipRow aria-label="興趣領域">
          {domains.map((d) => (
            <FilterChip key={d.id} selected={selectedDomainId === d.id} onClick={() => handleDomainSelect(d.id)}>
              {d.name_zh}
            </FilterChip>
          ))}
        </ChipRow>

        {activeTab === 'events' && (
          <ChipRow aria-label="活動條件">
            {eventChips.map((chip) => (
              <FilterChip key={chip.label} selected={chip.active} onClick={chip.onClick}>
                {chip.label}
              </FilterChip>
            ))}
          </ChipRow>
        )}

        {hasAnyFilter && (
          <div className="flex items-center justify-between gap-2 text-sm text-fg-muted">
            <span className="min-w-0 truncate">
              {activeNlQuery ? (
                <>
                  搜尋「<span className="font-medium text-fg">{activeNlQuery}</span>」的結果
                </>
              ) : (
                '已套用篩選'
              )}
            </span>
            <Button variant="ghost" size="sm" onClick={resetAllFilters} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
              清除
            </Button>
          </div>
        )}
      </div>

      {!dbConfigured && <Notice tone="warning">資料庫尚未設定完成，目前顯示空狀態。</Notice>}
      {degradedWarning && <Notice tone="warning">{degradedWarning}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}

      <div {...tabPanelProps('discover', activeTab)}>
        {loading ? (
          <div aria-busy="true" aria-label="正在載入內容" className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="mb-6 break-inside-avoid">
                <Skeleton className="w-full rounded-xl" style={{ aspectRatio: idx % 2 === 0 ? '4 / 5' : '4 / 3' }} />
                <Skeleton className="mt-3 h-4 w-4/5" />
                <Skeleton className="mt-2 h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : activeTab === 'stream' ? (
          streamItems.length === 0 ? (
            <EmptyState
              icon={<Compass />}
              title="沒有符合條件的社團現場"
              description="清除搜尋，或換個興趣領域看看。"
              action={<Button onClick={resetAllFilters}>看全部</Button>}
            />
          ) : (
            <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
              {streamItems.map((card) => (
                <div key={card.id} className="mb-6 break-inside-avoid">
                  <PostCard card={card} sourceSurface={activeNlQuery ? 'discover_nl' : 'discover_stream'} />
                </div>
              ))}
            </div>
          )
        ) : eventItems.length === 0 ? (
          <EmptyState
            icon={<Calendar />}
            title="這些條件下沒有近期活動"
            description="少選幾個條件就能看到更多。"
            action={<Button onClick={resetAllFilters}>清除條件</Button>}
          />
        ) : (
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {eventItems.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>

      {/* Batch pagination */}
      <div className="flex flex-col items-center gap-3 border-t border-line pt-6 text-center">
        <p className="text-sm text-fg-muted">
          這批 {activeTab === 'stream' ? streamMeta.count : eventMeta.count} 則・每個社團最多 2 則・不依讚數排序
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {(activeTab === 'stream' ? streamMeta.has_more : eventMeta.has_more) && (
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => {
                if (activeTab === 'stream') {
                  void loadStream({ uniId: selectedUniId, domainId: selectedDomainId, excludeIds: streamMeta.next_exclude_ids });
                } else {
                  reloadEvents({ excludeIds: eventMeta.next_exclude_ids });
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
            >
              換一批
            </Button>
          )}
          <Button variant="ghost" onClick={() => handleTabSwitch(activeTab === 'stream' ? 'events' : 'stream')}>
            {activeTab === 'stream' ? '看近期活動' : '看社團現場'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
