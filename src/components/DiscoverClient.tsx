'use client';

import { useState } from 'react';
import { AlertTriangle, Compass, RotateCcw, Search, Sparkles } from 'lucide-react';
import { DISCOVER_EXAMPLE_PROMPTS } from '@/lib/constants';
import type { DiscoverBatchMeta } from '@/lib/discovery/service';
import type { DiscoverStreamCardDTO } from '@/lib/serializers';
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
  initialItems,
  initialMeta,
  universities,
  domains,
  dbConfigured,
  initialUniversityId = '',
}: {
  initialItems: DiscoverStreamCardDTO[];
  initialMeta: DiscoverBatchMeta;
  universities: UniversityOption[];
  domains: DomainOption[];
  dbConfigured: boolean;
  initialUniversityId?: string;
}) {
  const [items, setItems] = useState<DiscoverStreamCardDTO[]>(initialItems);
  const [meta, setMeta] = useState<DiscoverBatchMeta>(initialMeta);
  const [selectedUniId, setSelectedUniId] = useState(initialUniversityId);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [query, setQuery] = useState('');
  const [activeNlQuery, setActiveNlQuery] = useState<string | null>(null);
  const [degradedWarning, setDegradedWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitQuery = async (text?: string) => {
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
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '搜尋暫時無法使用。');
        return;
      }
      setItems(json.items ?? []);
      setMeta(json.batch_meta);
      if (json.degraded && json.warning_message) {
        setDegradedWarning(json.warning_message);
      }
    } catch {
      setError('網路連線異常，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-4 shadow-xs sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-lg font-extrabold text-slate-900 sm:text-xl">
              別的聚｜探索校園社團現場
            </h1>
            <select
              aria-label="選擇學校"
              value={selectedUniId}
              onChange={(e) => setSelectedUniId(e.target.value)}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-[var(--muted)] px-3 text-xs font-semibold text-slate-800"
            >
              <option value="">全部合作大專校院</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.short_name}
                </option>
              ))}
            </select>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitQuery();
            }}
            className="flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--muted)] px-3 py-1.5"
          >
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="試著用白話搜尋：週四晚上想學畫畫沒基礎..."
              className="min-h-[40px] w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            {activeNlQuery && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveNlQuery(null);
                  setItems(initialItems);
                  setMeta(initialMeta);
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
              {loading ? '探索中' : '探索'}
            </button>
          </form>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {domains.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setSelectedDomainId(selectedDomainId === d.id ? '' : d.id);
                  void submitQuery(d.name_zh);
                }}
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

          <div className="flex flex-wrap gap-1.5">
            {DISCOVER_EXAMPLE_PROMPTS.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => void submitQuery(ex)}
                className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50/70 px-3 py-1 text-[11px] font-medium text-orange-900 hover:bg-orange-100"
              >
                <Sparkles className="h-3 w-3 text-[var(--brand)]" aria-hidden="true" />
                {ex}
              </button>
            ))}
          </div>
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

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-white p-10 text-center">
          <Compass className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-bold text-slate-900">目前沒有符合條件的現場動態</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((card) => (
            <PostCard
              key={card.id}
              card={card}
              sourceSurface={activeNlQuery ? 'discover_nl' : 'discover_stream'}
            />
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 text-center text-xs text-slate-600">
        本批次克制顯示 {meta.count} 則（單社團最多 2 則、不連續洗版、零公開讚粉數）。
      </div>
    </div>
  );
}
