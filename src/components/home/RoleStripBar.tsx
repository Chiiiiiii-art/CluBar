import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { RoleStrip } from '@/lib/services/home-context';

/** Single-line (at most 48px) role hint above the home tabs. */
export function RoleStripBar({ strip }: { strip: RoleStrip }) {
  return (
    <Link
      href={strip.href}
      className="tactile-shadow-sm tactile-press flex min-h-11 max-h-12 items-center gap-2 rounded-xl border-2 border-border-ink bg-spark px-3.5 font-display text-sm font-bold text-fg"
    >
      <span className="min-w-0 flex-1 truncate">{strip.text}</span>
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}
