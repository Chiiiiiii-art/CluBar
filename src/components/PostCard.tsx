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
    <article className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-md">
      <Link href={`/posts/${card.id}`} onClick={handleCardClick} className="block">
        <div
          className="relative w-full overflow-hidden bg-ink-100"
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
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-4 pt-3.5 pb-2.5">
        {card.reason && (
          <div className="flex items-start gap-2 rounded-xl border border-accent-200 bg-accent-50/90 px-3 py-2 text-sm font-medium text-accent-950">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" aria-hidden="true" />
            <span>{card.reason}</span>
          </div>
        )}

        {/* Element 2: 1 concise human headline */}
        <Link href={`/posts/${card.id}`} onClick={handleCardClick} className="block min-h-[44px]">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-ink-900 group-hover:text-accent-600 sm:text-base">
            {card.headline}
          </h3>
        </Link>

        {/* Element 3: University + Club + single qualitative pulse dot */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <Link
            href={`/clubs/${card.club.slug}`}
            className="flex min-h-[44px] min-w-0 items-center gap-1.5 text-sm font-semibold text-ink-700 hover:text-accent-600"
          >
            <span className="truncate">
              {card.club.university_short_name} · {card.club.name}
            </span>
            {card.club.verification_status === 'verified' && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent-600" aria-label="官方認證" />
            )}
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success-700">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
            {card.pulse_label}
          </span>
        </div>

        {/* Optional single-line contextual event attachment */}
        {card.contextual_event && (
          <Link
            href={`/e/${card.contextual_event.short_code}`}
            className="flex min-h-[44px] items-center gap-1.5 border-t border-line text-sm font-semibold text-accent-700 hover:underline"
          >
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{card.contextual_event.label} →</span>
          </Link>
        )}
      </div>
    </article>
  );
}
