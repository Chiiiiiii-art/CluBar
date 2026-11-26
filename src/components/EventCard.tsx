'use client';

import Link from 'next/link';
import { Calendar, MapPin, Sparkles, Users } from 'lucide-react';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { EVENT_THEME_PRESETS, LEARNING_HOURS_LABELS } from '@/lib/constants';
import type { DiscoverEventCardDTO } from '@/lib/serializers';
import { clampedAspectRatio } from './PostCard';

export function EventCard({ event }: { event: DiscoverEventCardDTO }) {
  const theme = EVENT_THEME_PRESETS[event.theme_preset] ?? EVENT_THEME_PRESETS.warm_paper!;
  const aspect = clampedAspectRatio(event.cover_media?.width ?? 1280, event.cover_media?.height ?? 720);

  // Max 3 decision tags per SRS-DISC-008
  const decisionTags: string[] = [];
  if (event.beginner_friendly) decisionTags.push('零基礎可');
  if (event.non_members_welcome) decisionTags.push('非社員可');
  decisionTags.push(event.fee_ntd === 0 ? '免費' : `NT$${event.fee_ntd}`);
  if (decisionTags.length < 3 && event.learning_hours_category !== 'none') {
    decisionTags.push(
      `${LEARNING_HOURS_LABELS[event.learning_hours_category]} ${event.learning_hours_count}h`
    );
  }

  const timeLabel =
    event.schedule_mode === 'voting'
      ? 'TBD 投票喬時間中'
      : event.schedule_mode === 'tbd'
        ? '時間 TBD 待定'
        : event.starts_at
          ? formatTaipeiDateTime(event.starts_at)
          : '時間待定';

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
      {/* Element 1: Aspect-ratio Event Cover */}
      <Link
        href={`/e/${event.short_code}`}
        onClick={() =>
          trackAnalyticsEvent({
            event_type: 'discover_event_click',
            club_id: event.club.id,
            target_id: event.id,
            source_surface: 'discover_events',
          })
        }
        className="block"
      >
        <div
          className={`relative w-full overflow-hidden bg-gradient-to-br ${theme.gradientClass}`}
          style={{ aspectRatio: aspect }}
        >
          {event.cover_media?.url ? (
            <img
              src={event.cover_media.url}
              alt={event.cover_media.alt || event.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : null}
          {event.schedule_mode !== 'scheduled' && (
            <span className="absolute top-3 left-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
              {event.schedule_mode === 'voting' ? '投票喬時間中' : 'TBD 搶先看'}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {event.reason && (
          <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/90 px-3 py-2 text-xs font-medium text-blue-950">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" aria-hidden="true" />
            <span>{event.reason}</span>
          </div>
        )}

        {/* Element 2: Event Title + Time & Location */}
        <Link href={`/e/${event.short_code}`} className="block space-y-1.5">
          <p className="text-[11px] font-semibold text-slate-500">
            {event.club.university_short_name} · {event.club.name}
            {event.co_host_clubs && event.co_host_clubs.length > 0
              ? ` × ${event.co_host_clubs.map((c) => c.name).join(' × ')}`
              : ''}
          </p>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 group-hover:text-blue-700">
            {event.title}
          </h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
              {timeLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              <span className="truncate max-w-[160px]">{event.location_text}</span>
            </span>
          </div>
        </Link>

        {/* Element 3: Up to 3 key decision tags */}
        <div className="flex flex-wrap gap-1.5">
          {decisionTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[var(--muted)] px-2.5 py-0.5 text-[11px] font-bold text-slate-700"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Element 4: Non-vanity attendance momentum prompt */}
        <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-2.5 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <Users className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
            {event.going_count > 0
              ? `已有 ${event.going_count} 人想參加`
              : '搶先卡位這場體驗'}
          </span>
          <Link
            href={`/e/${event.short_code}`}
            className="font-bold text-blue-700 hover:underline"
          >
            詳情／報名 →
          </Link>
        </div>
      </div>
    </article>
  );
}
