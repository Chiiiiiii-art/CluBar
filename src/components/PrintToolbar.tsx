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
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-300 bg-white p-4">
      <div className="flex items-center gap-3">
        <Link
          href={`/clubs/${slug}/manage`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-ink-700 hover:text-accent-600"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>回到 {clubName} 管理後台</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/clubs/${slug}/summary/${year}/export?format=md`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-4 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>下載 Markdown (.md)</span>
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          <span>列印／另存 PDF (A4)</span>
        </button>
      </div>
    </div>
  );
}
