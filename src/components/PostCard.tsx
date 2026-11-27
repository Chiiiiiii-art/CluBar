'use client';

import Link from 'next/link';
import { BadgeCheck, Calendar, Sparkles } from 'lucide-react';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { clampedAspectRatio, type DiscoverStreamCardDTO } from '@/lib/serializers';
import { ClubMark } from '@/components/ui';
import { isPlaceholderMedia } from '@/lib/media/placeholder';

/**
 * Discovery stream card. Content-first: the photo carries the card, text sits
 * underneath without a box. Posts with no media get a text-first tile rather
 * than decorative placeholder art.
 */
export function PostCard({
  card,
  sourceSurface = 'discover_stream',
}: {
  card: DiscoverStreamCardDTO;
  sourceSurface?: 'discover_stream' | 'discover_nl';
}) {
  const media = isPlaceholderMedia(card.cover_media?.url) ? null : card.cover_media;
  const aspect = clampedAspectRatio(media?.width, media?.height);

  const handleCardClick = () => {
    trackAnalyticsEvent({
      event_type: 'discover_stream_click',
      club_id: card.club.id,
      target_id: card.id,
      source_surface: sourceSurface,
    });
  };

  return (
    <article className="group">
      <Link href={`/posts/${card.id}`} onClick={handleCardClick} className="block rounded-xl">
        {media ? (
          <div className="relative w-full overflow-hidden rounded-xl bg-ink-100" style={{ aspectRatio: aspect }}>
            {media.kind === 'video' ? (
              <video
                src={media.url}
                poster={media.poster_url}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={media.url}
                alt={media.alt || card.headline}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
            )}
          </div>
        ) : (
          <div className="flex min-h-44 flex-col justify-between gap-6 rounded-xl bg-ink-100 p-5 transition-colors group-hover:bg-ink-200/70">
            <ClubMark name={card.club.name} seed={card.club.slug} size="md" />
            <p className="line-clamp-5 text-lg font-semibold leading-snug text-ink-900">{card.headline}</p>
          </div>
        )}
      </Link>

      <div className="mt-3 space-y-1">
        {card.reason && (
          <p className="flex items-start gap-1.5 text-sm text-accent-700">
            <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{card.reason}</span>
          </p>
        )}

        {media && (
          <Link href={`/posts/${card.id}`} onClick={handleCardClick} className="block">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-ink-900 group-hover:underline group-hover:decoration-ink-300 group-hover:underline-offset-4">
              {card.headline}
            </h3>
          </Link>
        )}

        <div className="flex items-center gap-2 text-sm text-ink-600">
          <Link
            href={`/clubs/${card.club.slug}`}
            className="inline-flex min-h-8 min-w-0 items-center gap-1 hover:text-ink-900"
          >
            <span className="truncate">
              {card.club.name}
              <span className="text-ink-500"> · {card.club.university_short_name}</span>
            </span>
            {card.club.verification_status === 'verified' && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-accent-600" aria-label="官方認證" />
            )}
          </Link>
          {card.pulse_label && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-ink-500">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
              {card.pulse_label}
            </span>
          )}
        </div>

        {card.contextual_event && (
          <Link
            href={`/e/${card.contextual_event.short_code}`}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-accent-50 px-3 text-sm font-medium text-accent-800 hover:bg-accent-100"
          >
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{card.contextual_event.label}</span>
          </Link>
        )}
      </div>
    </article>
  );
}
