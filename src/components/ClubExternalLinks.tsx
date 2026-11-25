'use client';

import { useEffect } from 'react';
import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import type { ClubCategory, ExternalLink } from '@/db/schema';
import { trackAnalyticsEvent } from '@/lib/analytics-client';

export function ClubPageViewTracker({
  clubId,
  category,
}: {
  clubId: string;
  category: ClubCategory;
}) {
  useEffect(() => {
    trackAnalyticsEvent({
      event_type: 'club_page_view',
      club_id: clubId,
      category,
      source_surface: 'club_page',
    });
  }, [clubId, category]);
  return null;
}

export function ClubOfficialLinks({
  clubId,
  category,
  links,
}: {
  clubId: string;
  category: ClubCategory;
  links: ExternalLink[];
}) {
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link, idx) => (
        <a
          key={`${link.url}-${idx}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackAnalyticsEvent({
              event_type: 'official_link_click',
              club_id: clubId,
              category,
              source_surface: 'club_page',
            })
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--muted)] px-3.5 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-orange-100"
        >
          <span>{link.label}</span>
          <ExternalLinkIcon className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

export function OpportunitySignupLink({
  clubId,
  category,
  href,
}: {
  clubId: string;
  category: ClubCategory;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        trackAnalyticsEvent({
          event_type: 'opportunity_link_click',
          club_id: clubId,
          category,
          source_surface: 'club_page',
        })
      }
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
    >
      <span>前往報名／聯繫</span>
      <ExternalLinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}
