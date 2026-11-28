'use client';

import Link from 'next/link';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { EVENT_THEME_PRESETS, LEARNING_HOURS_LABELS } from '@/lib/constants';
import { clampedAspectRatio, type DiscoverEventCardDTO } from '@/lib/serializers';
import { Badge, ClubMark } from '@/components/ui';
import { ShareButton } from '@/components/ShareButton';
import { realMediaUrl } from '@/lib/media/placeholder';

export function EventCard({ event }: { event: DiscoverEventCardDTO }) {
  const theme = EVENT_THEME_PRESETS[event.theme_preset] ?? EVENT_THEME_PRESETS.warm_paper!;
  const aspect = clampedAspectRatio(event.cover_media?.width ?? 1280, event.cover_media?.height ?? 720);
  const href = `/e/${event.short_code}`;

  // At most 2 decision tags on a card (fee is shown in the meta line).
  const decisionTags: string[] = [];
  if (event.beginner_friendly) decisionTags.push('零基礎可');
  if (event.non_members_welcome) decisionTags.push('非社員可');
  if (decisionTags.length < 2 && event.learning_hours_category !== 'none') {
    decisionTags.push(`${LEARNING_HOURS_LABELS[event.learning_hours_category]} ${event.learning_hours_count}h`);
  }

  const timeLabel =
    event.schedule_mode === 'voting'
      ? '時間投票中'
      : event.schedule_mode === 'tbd'
        ? '時間待定'
        : event.starts_at
          ? formatTaipeiDateTime(event.starts_at)
          : '時間待定';

  const track = () =>
    trackAnalyticsEvent({
      event_type: 'discover_event_click',
      club_id: event.club.id,
      target_id: event.id,
      source_surface: 'discover_events',
    });

  return (
    <article className="group tactile-card tactile-card-interactive flex flex-col overflow-hidden rounded-2xl bg-surface">
      <Link href={href} onClick={track} className="block border-b-2 border-border-ink">
        <div
          className={`relative w-full overflow-hidden bg-gradient-to-br ${theme.gradientClass}`}
          style={{ aspectRatio: aspect }}
        >
          {realMediaUrl(event.cover_media?.url) ? (
            <img
              src={event.cover_media!.url}
              alt={event.cover_media!.alt || event.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-end p-4">
              <ClubMark name={event.club.name} seed={event.club.id} size="md" />
            </div>
          )}
        </div>
      </Link>

      {/* Ticket body: what / when / where */}
      <div className="flex-1 space-y-1.5 px-4 pt-3.5 pb-4">
        {event.reason && (
          <p className="flex items-start gap-1.5 text-sm font-medium text-brand-soft-fg">
            <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{event.reason}</span>
          </p>
        )}

        <p className="flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums text-brand-soft-fg">
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {timeLabel}
        </p>

        <Link href={href} onClick={track} className="block py-0.5">
          <h3 className="line-clamp-2 font-display text-lg font-black leading-snug text-fg group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
            {event.title}
          </h3>
        </Link>

        <p className="truncate text-sm font-medium text-fg-secondary">
          {event.club.name}
          {event.co_host_clubs && event.co_host_clubs.length > 0
            ? ` × ${event.co_host_clubs.map((c) => c.name).join(' × ')}`
            : ''}
        </p>

        <p className="flex items-center gap-1.5 text-sm text-fg-muted">
          <MapPin className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <span className="truncate">
            {event.club.university_short_name} · {event.location_text}
          </span>
        </p>
      </div>

      {/* Ticket stub: fee and who can come */}
      <div className="ticket-stub flex flex-wrap items-center justify-between gap-2 bg-surface-subtle px-4 py-3">
        <span className="font-mono text-sm font-bold text-fg">
          {event.fee_ntd === 0 ? '免費入場' : `NT$${event.fee_ntd}`}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {decisionTags.map((tag) => (
            <Badge key={tag} tone="accent">
              {tag}
            </Badge>
          ))}
          <ShareButton
            iconOnly
            variant="ghost"
            label={`分享「${event.title}」`}
            url={href}
            title={event.title}
            text={`${event.club.name}｜${event.title}\n時間：${timeLabel}`}
            clubId={event.club.id}
            targetId={event.id}
            surface="event_card"
            className="-my-2 -mr-2"
          />
        </div>
      </div>
    </article>
  );
}
