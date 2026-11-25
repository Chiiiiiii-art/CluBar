'use client';

import Link from 'next/link';
import { ArrowLeft, Download, Printer } from 'lucide-react';

export function PrintToolbar({
  slug,
  year,
  clubName,
}: {
  slug: string;
  year: number;
  clubName: string;
}) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-strong)] bg-white p-4 shadow-xs">
      <div className="flex items-center gap-3">
        <Link
          href={`/clubs/${slug}/manage`}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-[var(--primary)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>回到 {clubName} 管理後台</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/clubs/${slug}/summary/${year}/export?format=md`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>下載 Markdown (.md)</span>
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          <span>列印／另存 PDF (A4)</span>
        </button>
      </div>
    </div>
  );
}
