'use client';

import { useEffect } from 'react';
import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import type { ExternalLink } from '@/db/schema';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { buttonClasses } from '@/components/ui';

export function ClubPageViewTracker({ clubId }: { clubId: string }) {
  useEffect(() => {
    trackAnalyticsEvent({
      event_type: 'club_page_view',
      club_id: clubId,
      source_surface: 'club_page',
    });
  }, [clubId]);
  return null;
}

export function ClubOfficialLinks({
  clubId,
  links,
}: {
  clubId: string;
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
              source_surface: 'club_page',
            })
          }
          className={buttonClasses({ variant: 'secondary', size: 'md', className: 'gap-1.5' })}
        >
          <span>{link.label}</span>
          <ExternalLinkIcon className="h-3.5 w-3.5 text-fg-muted" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}
