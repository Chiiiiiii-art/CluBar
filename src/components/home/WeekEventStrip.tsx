'use client';

import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import type { DiscoverEventCardDTO } from '@/lib/serializers';
import { EventStatusTags } from '@/components/EventStatusTags';


/** Compact ticket row for the home masthead: content instead of filter shortcuts. Each card opens the event. */
export function WeekEventStrip({ events }: { events: DiscoverEventCardDTO[] }) {
  return (
    <ul className="no-scrollbar scroll-fade-x -mx-4 flex gap-3 overflow-x-auto px-4 pt-1 pb-2 sm:-mx-5 sm:px-5">
      {events.map((ev) => (
        <li key={ev.id} className="w-56 shrink-0">
          <Link
            href={`/e/${ev.short_code}`}
            onClick={() =>
              trackAnalyticsEvent({
                event_type: 'discover_event_click',
                club_id: ev.club.id,
                target_id: ev.id,
                source_surface: 'discover_events',
              })
            }
            className="tactile-card tactile-card-interactive tactile-press flex h-full flex-col overflow-hidden rounded-2xl bg-surface text-fg"
          >
            <div className="flex-1 space-y-1 px-3.5 pt-3 pb-2.5">
              {ev.schedule_mode !== 'voting' && ev.schedule_mode !== 'tbd' && ev.starts_at ? (
                <p className="flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums text-brand-soft-fg">
                  <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {formatTaipeiDateTime(ev.starts_at)}
                </p>
              ) : (
                <EventStatusTags scheduleMode={ev.schedule_mode} startsAt={ev.starts_at} />
              )}
              <p className="line-clamp-2 font-display text-base font-black leading-snug">{ev.title}</p>
            </div>
            <div className="ticket-stub flex items-center justify-between gap-2 bg-surface-subtle px-3.5 py-2 text-sm">
              <span className="min-w-0 truncate font-medium text-fg-secondary">{ev.club.name}</span>
              <span className="shrink-0 font-mono text-xs font-bold">{ev.fee_ntd === 0 ? '免費' : `NT$${ev.fee_ntd}`}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
