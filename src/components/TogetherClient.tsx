'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { TOGETHER_ITEM_TYPE_LABELS } from '@/lib/constants';
import type { PublicTogetherItemDTO } from '@/lib/serializers';

export function TogetherClient({
  domains,
  initialItems,
}: {
  domains: { id: string; slug: string; name_zh: string }[];
  initialItems: PublicTogetherItemDTO[];
}) {
  const [selectedDomain, setSelectedDomain] = useState('');
  const filtered = selectedDomain
    ? initialItems.filter((item) => item.domain_id === selectedDomain)
    : initialItems;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
          <h1 className="text-xl font-extrabold text-slate-900">一起聚｜跨校同好實作舞台</h1>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          以細分興趣領域串聯各校社團與認證社員，作品試玩、Rebound 接力與路線／專題實務切磋。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedDomain('')}
            className={`min-h-[36px] rounded-full px-3.5 text-xs font-semibold ${
              !selectedDomain
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--muted)] text-slate-700 hover:bg-orange-100'
            }`}
          >
            全部領域
          </button>
          {domains.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDomain(d.id)}
              className={`min-h-[36px] rounded-full px-3.5 text-xs font-semibold ${
                selectedDomain === d.id
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--muted)] text-slate-700 hover:bg-orange-100'
              }`}
            >
              #{d.name_zh}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-xs"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 font-bold text-orange-900">
                #{item.domain_name}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                {TOGETHER_ITEM_TYPE_LABELS[item.item_type]}
              </span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900">{item.title}</h2>
            <p className="line-clamp-3 text-sm text-slate-600">{item.content_md}</p>
            <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs">
              <Link
                href={`/clubs/${item.club.slug}`}
                className="font-semibold text-blue-700 hover:underline"
              >
                {item.club.university_short_name} · {item.club.name} · 個人
              </Link>
              <span className="text-slate-500">回覆 {item.reply_count}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
