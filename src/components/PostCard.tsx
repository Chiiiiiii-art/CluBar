'use client';

import Link from 'next/link';
import { BadgeCheck, Calendar, Sparkles } from 'lucide-react';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { clampedAspectRatio, type DiscoverStreamCardDTO } from '@/lib/serializers';

export function PostCard({
  card,
  sourceSurface = 'discover_stream',
}: {
  card: DiscoverStreamCardDTO;
  sourceSurface?: 'discover_stream' | 'discover_nl';
}) {
  const imgSrc = card.cover_media?.url || '/images/demo/moment-4x5.svg';
  const aspect = clampedAspectRatio(card.cover_media?.width, card.cover_media?.height);

  const handleCardClick = () => {
    trackAnalyticsEvent({
      event_type: 'discover_stream_click',
      club_id: card.club.id,
      target_id: card.id,
      source_surface: sourceSurface,
    });
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md">
      <Link href={`/posts/${card.id}`} onClick={handleCardClick} className="block">
        <div
          className="relative w-full overflow-hidden bg-[var(--muted)]"
          style={{ aspectRatio: aspect }}
        >
          {card.cover_media?.kind === 'video' ? (
            <video
              src={card.cover_media.url}
              poster={card.cover_media.poster_url}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={imgSrc}
              alt={card.cover_media?.alt || card.headline}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          )}
          {card.club.is_demo && (
            <span className="absolute top-3 right-3 rounded-full bg-slate-900/70 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs">
              示範
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {card.reason && (
          <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50/90 px-3 py-2 text-xs font-medium text-orange-950">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
            <span>{card.reason}</span>
          </div>
        )}

        {/* Element 2: 1 concise human headline (<=30 chars) */}
        <Link href={`/posts/${card.id}`} onClick={handleCardClick} className="block">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 group-hover:text-[var(--primary)] sm:text-base">
            {card.headline}
          </h3>
        </Link>

        {/* Element 3: University + Club + single qualitative pulse dot */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Link
            href={`/clubs/${card.club.slug}`}
            className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[var(--primary)]"
          >
            <span className="truncate">
              {card.club.university_short_name} · {card.club.name}
            </span>
            {card.club.verification_status === 'verified' && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-label="官方認證" />
            )}
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {card.pulse_label}
          </span>
        </div>

        {/* Optional single-line contextual event attachment */}
        {card.contextual_event && (
          <Link
            href={`/e/${card.contextual_event.short_code}`}
            className="flex items-center gap-1.5 border-t border-[var(--border)] pt-2 text-xs font-semibold text-blue-700 hover:underline"
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{card.contextual_event.label} →</span>
          </Link>
        )}
      </div>
    </article>
  );
}
