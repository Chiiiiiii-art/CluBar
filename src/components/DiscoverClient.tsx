'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bookmark,
  Compass,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import type { ClubCategory } from '@/db/schema';
import {
  CLUB_CATEGORY_LIST,
  CURATED_INTEREST_TAGS,
  DISCOVER_EXAMPLE_PROMPTS,
} from '@/lib/constants';
import type { DiscoverBatchMeta } from '@/lib/discovery/service';
import type { DiscoverCardDTO } from '@/lib/serializers';
import { PostCard } from './PostCard';

interface UniversityOption {
  id: string;
  short_name: string;
  name: string;
}

export function DiscoverClient({
  initialItems,
  initialMeta,
  universities,
  dbConfigured,
  initialCategory = '',
  initialTag = '',
  initialUniversityId = '',
}: {
  initialItems: DiscoverCardDTO[];
  initialMeta: DiscoverBatchMeta;
  universities: UniversityOption[];
  dbConfigured: boolean;
  initialCategory?: ClubCategory | '';
  initialTag?: string;
  initialUniversityId?: string;
}) {
  const [items, setItems] = useState<DiscoverCardDTO[]>(initialItems);
  const [meta, setMeta] = useState<DiscoverBatchMeta>(initialMeta);
  const [mode, setMode] = useState<'topic' | 'nl'>('topic');

  // Track A state
  const [selectedCategory, setSelectedCategory] = useState<ClubCategory | ''>(initialCategory);
  const [selectedTag, setSelectedTag] = useState<string>(initialTag);
  const [selectedUniId, setSelectedUniId] = useState<string>(initialUniversityId);

  // Track B state
  const [query, setQuery] = useState('');
  const [activeNlQuery, setActiveNlQuery] = useState<string | null>(null);
  const [degradedWarning, setDegradedWarning] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopicFeed = async (next: {
    category?: ClubCategory | '';
    tag?: string;
    universityId?: string;
  }) => {
    const cat = next.category !== undefined ? next.category : selectedCategory;
    const tag = next.tag !== undefined ? next.tag : selectedTag;
    const uni = next.universityId !== undefined ? next.universityId : selectedUniId;

    setSelectedCategory(cat);
    setSelectedTag(tag);
    setSelectedUniId(uni);
    setMode('topic');
    setActiveNlQuery(null);
    setDegradedWarning(null);
    setError(null);
    setLoading(true);

    try {
      const sp = new URLSearchParams();
      if (cat) sp.set('category', cat);
      if (tag) sp.set('tag', tag);
      if (uni) sp.set('university_id', uni);

      const res = await fetch(`/api/discover/feed?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '載入探索成果失敗。');
        return;
      }
      setItems(json.items ?? []);
      setMeta(json.batch_meta);
    } catch {
      setError('網路連線異常，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  const submitNlQuery = async (rawQuery: string) => {
    const clean = rawQuery.trim();
    if (clean.length < 2) {
      setError('請輸入至少 2 個字的興趣或需求描述。');
      return;
    }

    setQuery(clean);
    setMode('nl');
    setActiveNlQuery(clean);
    setDegradedWarning(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/discover/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          university_id: selectedUniId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message || '探索失敗，請稍後再試。');
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
      {!dbConfigured && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">尚未連線至資料庫（DATABASE_URL 未設定）</p>
          <p className="mt-1 text-xs">
            請參考 `.env.example` 與 `docker-compose.yml` 啟動 PostgreSQL 後執行{' '}
            <code>npm run db:migrate &amp;&amp; npm run db:seed</code>，即可顯示完整示範社團成果。
          </p>
        </div>
      )}

      {/* Hero + Track B Natural Language Search */}
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-gradient-to-br from-white via-[#FFF7ED] to-[#FFEDD5]/70 p-5 shadow-xs sm:p-8">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span>別的聚｜內容即入口，不看粉絲數</span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            不知道社團名稱？直接說出你想探索什麼
          </h1>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            每次只呈現最多 12 則最契合的作品與日常成果，單一社團最多出現 2 則、絕不洗版，看完即止。
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitNlQuery(query);
            }}
            className="flex flex-col gap-2.5 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={300}
                placeholder="例如：想學拍底片又想認識新朋友、找人一起寫程式做專案..."
                className="w-full rounded-2xl border border-[var(--border-strong)] bg-white py-3 pr-4 pl-10 text-sm text-slate-900 shadow-xs placeholder:text-slate-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{loading && mode === 'nl' ? '探索配對中...' : '白話需求探索'}</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-500">試試這些說法：</span>
            {DISCOVER_EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => void submitNlQuery(example)}
                className="rounded-full border border-[var(--border-strong)] bg-white px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-[var(--brand)] hover:bg-orange-50 hover:text-[var(--primary)]"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Track A Filters */}
      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void fetchTopicFeed({ category: '' })}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                mode === 'topic' && selectedCategory === ''
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--muted)] text-slate-700 hover:bg-orange-100'
              }`}
            >
              全部分類
            </button>
            {CLUB_CATEGORY_LIST.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => void fetchTopicFeed({ category: cat.value })}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  mode === 'topic' && selectedCategory === cat.value
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--muted)] text-slate-700 hover:bg-orange-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <select
            aria-label="篩選大專校院"
            value={selectedUniId}
            onChange={(e) => {
              const nextUni = e.target.value;
              if (mode === 'nl' && activeNlQuery) {
                setSelectedUniId(nextUni);
              } else {
                void fetchTopicFeed({ universityId: nextUni });
              }
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
          >
            <option value="">全部大專校院</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.short_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs font-semibold text-slate-500">興趣標籤：</span>
          {selectedTag && (
            <button
              type="button"
              onClick={() => void fetchTopicFeed({ tag: '' })}
              className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white"
            >
              清除 #{selectedTag}
            </button>
          )}
          {CURATED_INTEREST_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                void fetchTopicFeed({ tag: selectedTag === tag ? '' : tag })
              }
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selectedTag === tag && mode === 'topic'
                  ? 'border-[var(--primary)] bg-orange-50 text-[var(--primary)]'
                  : 'border-[var(--border)] bg-white text-slate-700 hover:bg-[var(--muted)]'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </section>

      {/* Active Mode Header */}
      {activeNlQuery && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-orange-950">
            <Sparkles className="h-4 w-4 text-[var(--brand)]" aria-hidden="true" />
            <span>
              需求探索：<strong>「{activeNlQuery}」</strong>（嚴選 {items.length} 則作品）
            </span>
          </div>
          <button
            type="button"
            onClick={() => void fetchTopicFeed({ category: '', tag: '' })}
            className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-xs hover:bg-orange-100"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>回到主題瀏覽</span>
          </button>
        </div>
      )}

      {/* Degraded Alert Banner */}
      {degradedWarning && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-950"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <span>{degradedWarning}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {error}
        </div>
      )}

      {/* Results Grid */}
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-72 animate-pulse rounded-2xl border border-[var(--border)] bg-white/80"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-white p-10 text-center">
          <p className="text-base font-bold text-slate-900">目前沒有完全符合條件的公開成果</p>
          <p className="mt-1.5 text-sm text-slate-600">
            我們不會強塞低相關度內容湊數，歡迎換個說法或切換其他社團分類看看。
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              void fetchTopicFeed({ category: '', tag: '', universityId: '' });
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>顯示全部最新成果</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((card) => (
            <PostCard
              key={card.post_id}
              card={card}
              sourceSurface={mode === 'nl' ? 'discover_nl' : 'discover_topic'}
            />
          ))}
        </div>
      )}

      {/* Mandatory End-of-Batch Card (FR-DISC-03) */}
      {!loading && (
        <section
          aria-label="本批探索結束提醒"
          className="rounded-3xl border border-[var(--border-strong)] bg-white p-6 text-center shadow-xs sm:p-8"
        >
          <p className="text-base font-extrabold text-slate-900">
            這批相關的社團成果已看完（共 {meta.count} 則，單批上限 {meta.cap} 則）
          </p>
          <p className="mt-1 text-sm text-slate-600">
            不採用無限捲動消耗注意力。你可以換個主題逛逛，或把時間留給真正感興趣的社團。
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            {meta.suggested_categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  void fetchTopicFeed({ category: cat.value, tag: '' });
                }}
                className="rounded-xl border border-[var(--border-strong)] bg-[var(--muted)] px-4 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-orange-100"
              >
                逛逛「{cat.label}」社團
              </button>
            ))}

            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              重新描述探索需求
            </button>

            <Link
              href="/me"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              <span>前往我的收藏／追蹤社團</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
