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

  const removeQuery = () => {
    setQuery('');
    setActiveNlQuery(null);
    if (activeTab === 'stream') void loadStream({ uniId: selectedUniId, domainId: selectedDomainId });
    else reloadEvents({});
  };

  // Applied-filter overview (Baymard): every active condition, each removable on its own.
  const appliedFilters: { key: string; label: string; remove: () => void }[] = [
    ...(activeNlQuery ? [{ key: 'q', label: `搜尋「${activeNlQuery}」`, remove: removeQuery }] : []),
    ...(selectedDomainId
      ? [
          {
            key: 'domain',
            label: domains.find((d) => d.id === selectedDomainId)?.name_zh ?? '興趣領域',
            remove: () => handleDomainSelect(selectedDomainId),
          },
        ]
      : []),
    ...(activeTab === 'events'
      ? eventChips.filter((c) => c.active).map((c) => ({ key: c.label, label: c.label, remove: c.onClick }))
      : []),
  ];

  const hasAnyFilter = activeTab === 'events' ? hasActiveEventFilters : Boolean(selectedDomainId || activeNlQuery);
  const examplesVisible = showExamples && activeTab === 'stream' && !query.trim();

  const featuredEvent = eventItems[0] ?? null;
  const selectedUniLabel =
    universities.find((u) => u.id === selectedUniId)?.short_name ?? '全部學校';

  const quickEventShortcuts = [
    {
      label: '零基礎可',
      active: activeTab === 'events' && beginnerOnly,
      toneClass: 'bg-spark text-fg',
      shape: 'rounded-full',
      onClick: () => {
        const next = !(activeTab === 'events' && beginnerOnly);
        setActiveTab('events');
        setBeginnerOnly(next);
        reloadEvents({ beginnerOnly: next });
      },
    },
    {
      label: '非社員歡迎',
      active: activeTab === 'events' && nonMemberOnly,
      toneClass: 'bg-domain-arts-soft text-domain-arts',
      shape: 'rounded-xl',
      onClick: () => {
        const next = !(activeTab === 'events' && nonMemberOnly);
        setActiveTab('events');
        setNonMemberOnly(next);
        reloadEvents({ nonMemberOnly: next });
      },
    },
    {
      label: '本週體驗',
      active: activeTab === 'events' && dateRange === 'this_week',
      toneClass: 'bg-domain-service-soft text-domain-service',
      shape: 'rounded-lg',
      onClick: () => {
        const next = activeTab === 'events' && dateRange === 'this_week' ? 'all' : 'this_week';
        setActiveTab('events');
        setDateRange(next);
        reloadEvents({ dateRange: next });
      },
    },
    {
      label: '免費參加',
      active: activeTab === 'events' && freeOnly,
      toneClass: 'bg-surface text-fg',
      shape: 'rounded-lg',
      onClick: () => {
        const next = !(activeTab === 'events' && freeOnly);
        setActiveTab('events');
        setFreeOnly(next);
        reloadEvents({ freeOnly: next });
      },
    },
  ] as const;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* First-visit invitation: lightweight slim bar (keeps visual spotlight on Hero Bento) */}
      {showOnboardingPrompt && (
        <div className="tactile-shadow-sm flex items-center gap-3 rounded-xl border-2 border-border-ink bg-surface py-1.5 pr-1.5 pl-3.5 text-fg">
          <Sparkles className="h-4 w-4 shrink-0 text-cobalt" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-medium">
            <span className="font-bold">第一次來？</span>
            <span> 30 秒挑出適合你的社團</span>
          </p>
          <Link
            href="/onboarding"
            className="tactile-press inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border-2 border-border-ink bg-spark px-3 font-display text-sm font-bold text-fg"
          >
            開始
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setShowOnboardingPrompt(false)}
            aria-label="關閉提示"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-subtle hover:text-fg"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Soft Neubrutalist Bento Masthead */}
      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]" aria-label="社團探索主視覺">
        <div className="tactile-card flex min-w-0 flex-col justify-between gap-4 rounded-2xl bg-surface p-5 sm:p-6">
          <div className="space-y-3">
            <span className="tactile-shadow-sm inline-flex items-center rounded-lg border-2 border-border-ink bg-domain-academic-soft px-3 py-1 text-xs font-bold text-domain-academic">
              {selectedUniLabel} · 社團探索
            </span>
            <h1 className="font-display text-2xl font-black leading-tight text-fg sm:text-3xl">
              看作品，找到真正{' '}
              <span className="tactile-shadow-sm inline-block rounded-lg border-2 border-border-ink bg-spark px-2.5 py-0.5 text-fg">
                想去的社團
              </span>
            </h1>
            <p className="text-sm text-fg-secondary sm:text-base">
              從社員日常與體驗社課開始，零基礎也能輕鬆參加。
            </p>
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
            <div className="tactile-shadow-sm flex items-center gap-2 rounded-xl border-2 border-border-ink bg-canvas py-1 pr-1 pl-3.5 transition-shadow focus-within:ring-2 focus-within:ring-focus-ring/25">
              <Search className="h-5 w-5 shrink-0 text-fg-muted" aria-hidden="true" />
              <input
                type="search"
                aria-label="用一句話搜尋社團或活動"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowExamples(true)}
                onBlur={() => window.setTimeout(() => setShowExamples(false), 150)}
                placeholder="搜尋：週末、零基礎、不用買器材"
                className="min-h-11 w-full min-w-0 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
              />
              <Button type="submit" loading={loading} size="sm" className="min-h-10">
                搜尋
              </Button>
            </div>
            {examplesVisible && (
              <div className="tactile-shadow-md absolute inset-x-0 top-full z-20 mt-2 rounded-xl border-2 border-border-ink bg-surface p-2">
                <p className="px-2 pt-1 pb-2 text-xs font-bold text-fg-muted">試試這樣找</p>
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
                        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium text-fg-body hover:bg-surface-subtle"
                      >
                        <Search className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
                        <span>{ex}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        </div>

        <aside className="tactile-card flex min-w-0 flex-col justify-between gap-4 rounded-2xl bg-cobalt p-5 text-on-cobalt">
          <div className="space-y-2.5">
            <span className="font-mono text-xs font-bold tracking-wide">點貼紙直接看活動</span>
            <div className="flex flex-wrap gap-2">
              {quickEventShortcuts.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={item.active}
                  onClick={item.onClick}
                  className={`tactile-press inline-flex min-h-10 items-center gap-1.5 border-2 border-border-ink px-3 py-1.5 font-display text-xs font-bold ${item.shape} ${
                    item.active ? 'bg-fg text-spark' : item.toneClass
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {featuredEvent ? (
            <div className="tactile-shadow-sm flex items-center justify-between gap-3 rounded-xl border-2 border-border-ink bg-surface px-3.5 py-3 text-fg">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-brand-soft-fg">本週體驗社課</p>
                <p className="truncate font-display text-sm font-black">{featuredEvent.title}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTabSwitch('events')}
                className="shrink-0"
              >
                看票根 →
              </Button>
            </div>
          ) : (
            <div className="tactile-shadow-sm flex items-center justify-between gap-3 rounded-xl border-2 border-border-ink bg-surface px-3.5 py-3 text-fg">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-brand-soft-fg">不知道從哪逛？</p>
                <p className="truncate font-display text-sm font-black">30 秒測驗挑出適合你的社團</p>
              </div>
              <ButtonLink href="/onboarding" variant="secondary" size="sm" className="shrink-0">
                開始 →
              </ButtonLink>
            </div>
          )}
        </aside>
      </section>

      {/* Discovery controls */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
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

        <ChipRow aria-label="興趣領域" className="sm:gap-2">
          {domains.map((d, idx) => {
            const domainTints = [
              'bg-domain-academic-soft hover:bg-spark/60',
              'bg-domain-arts-soft hover:bg-spark/60',
              'bg-domain-recreation-soft hover:bg-spark/60',
              'bg-domain-sports-soft hover:bg-spark/60',
              'bg-domain-service-soft hover:bg-spark/60',
              'bg-domain-social-soft hover:bg-spark/60',
            ];
            return (
              <FilterChip
                key={d.id}
                shapeIndex={idx}
                tintClass={domainTints[idx % domainTints.length]}
                selected={selectedDomainId === d.id}
                onClick={() => handleDomainSelect(d.id)}
                className="sm:px-3"
              >
                {d.name_zh}
              </FilterChip>
            );
          })}
        </ChipRow>

        {activeTab === 'events' && (
          <ChipRow aria-label="活動條件">
            {eventChips.map((chip, idx) => (
              <FilterChip key={chip.label} shapeIndex={idx + 1} selected={chip.active} onClick={chip.onClick}>
                {chip.label}
              </FilterChip>
            ))}
          </ChipRow>
        )}

        {hasAnyFilter && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-dashed border-border-ink bg-surface px-3 py-2 text-sm" aria-label="已套用的條件">
            <span className="font-bold text-fg-secondary">已選條件：</span>
            {appliedFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.remove}
                aria-label={`移除條件：${f.label}`}
                className="tactile-press inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg border-2 border-border-ink bg-spark px-3 font-display font-bold text-fg"
              >
                <span className="truncate">{f.label}</span>
                <X className="h-3.5 w-3.5 shrink-0 text-fg" aria-hidden="true" />
              </button>
            ))}
            <Button variant="secondary" size="sm" onClick={resetAllFilters} icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
              撕掉全部
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
                <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: idx % 2 === 0 ? '4 / 5' : '4 / 3' }} />
                <Skeleton className="mt-3 h-4 w-4/5" />
                <Skeleton className="mt-2 h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : activeTab === 'stream' ? (
          streamItems.length === 0 ? (
            <EmptyState
              title="這裡還空著"
              description="換個領域逛逛，找張喜歡的社團貼紙。"
              action={<Button onClick={resetAllFilters}>看全部作品</Button>}
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
            title="這些條件下沒有近期活動"
            description="少選幾個條件就能看到更多體驗社課。"
            action={<Button onClick={resetAllFilters}>撕掉全部</Button>}
          />
        ) : (
          <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {eventItems.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>

      {/* Finite batch end */}
      <div className="tactile-shadow-sm flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-border-ink bg-surface px-5 py-4">
        <p className="font-display text-sm font-bold text-fg">這批看完了</p>
        <div className="flex flex-wrap gap-2">
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
          <Button variant="soft" onClick={() => handleTabSwitch(activeTab === 'stream' ? 'events' : 'stream')}>
            {activeTab === 'stream' ? '看近期活動' : '看社團現場'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
