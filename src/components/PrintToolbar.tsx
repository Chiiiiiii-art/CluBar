'use client';

import Link from 'next/link';
import { ArrowLeft, Download, Printer } from 'lucide-react';

import { buttonClasses } from '@/components/ui';
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
          className={buttonClasses({ variant: 'secondary', size: 'md' })}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          <span>下載 Markdown (.md)</span>
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          className={buttonClasses({ variant: 'primary', size: 'md' })}
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          <span>列印／另存 PDF (A4)</span>
        </button>
      </div>
    </div>
  );
}
