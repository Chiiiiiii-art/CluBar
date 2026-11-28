'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Calendar, Sparkles } from 'lucide-react';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { POST_KIND_LABELS } from '@/lib/constants';
import { clampedAspectRatio, type DiscoverStreamCardDTO } from '@/lib/serializers';
import { Badge, ClubMark, buttonClasses, cn } from '@/components/ui';
import { isPlaceholderMedia } from '@/lib/media/placeholder';

function tiltClass(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 2 === 0 ? 'sticker-tilt-l' : 'sticker-tilt-r';
}

/**
 * Discovery stream card. Uncropped visual showcase inside a 2px ink sticker frame,
 * paired with a non-circular scalloped ClubMark and subtle desktop tilt.
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
  const kindMeta = POST_KIND_LABELS[card.post_kind];

  const handleCardClick = () => {
    trackAnalyticsEvent({
      event_type: 'discover_stream_click',
      club_id: card.club.id,
      target_id: card.id,
      source_surface: sourceSurface,
    });
  };

  return (
    <article
      className={cn(
        'group tactile-card tactile-card-interactive relative rounded-2xl bg-surface p-2.5 pb-3.5',
        tiltClass(card.id)
      )}
    >
      <Link href={`/posts/${card.id}`} onClick={handleCardClick} className="block rounded-xl">
        {media ? (
          <div
            className="relative w-full overflow-hidden rounded-xl border-2 border-border-ink bg-surface-subtle"
            style={{ aspectRatio: aspect }}
          >
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
            <div className="pointer-events-none absolute bottom-2.5 left-2.5">
              <ClubMark name={card.club.name} seed={card.club.slug} size="sm" />
            </div>
          </div>
        ) : (
          <div className="flex min-h-44 flex-col justify-between gap-5 rounded-xl border-2 border-border-ink bg-domain-recreation-soft p-5 text-domain-recreation">
            <div className="flex items-center justify-between gap-2">
              <ClubMark name={card.club.name} seed={card.club.slug} size="md" />
              {kindMeta && <Badge className="bg-surface text-fg">{kindMeta.label}</Badge>}
            </div>
            <p className="line-clamp-5 font-display text-lg font-black leading-snug text-fg">
              {card.headline}
            </p>
          </div>
        )}
      </Link>

      <div className="mt-3 space-y-1.5 px-1">
        {card.reason && (
          <p className="flex items-start gap-1.5 text-sm font-medium text-brand-soft-fg">
            <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{card.reason}</span>
          </p>
        )}

        {media && (
          <>
            <div className="flex items-center justify-between gap-2">
              {kindMeta && <Badge tone="neutral">{kindMeta.label}</Badge>}
              {card.pulse_label && (
                <span className="ml-auto font-mono text-xs font-bold text-fg-muted">
                  {card.pulse_label}
                </span>
              )}
            </div>
            <Link href={`/posts/${card.id}`} onClick={handleCardClick} className="block py-0.5">
              <h3 className="line-clamp-2 font-display text-base font-bold leading-snug text-fg group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                {card.headline}
              </h3>
            </Link>
          </>
        )}

        <div className="flex items-center gap-2 text-sm text-fg-secondary">
          <Link
            href={`/clubs/${card.club.slug}`}
            className="inline-flex min-h-8 min-w-0 items-center gap-1 font-medium hover:text-fg"
          >
            <span className="truncate">
              {card.club.name}
              <span className="text-fg-muted"> · {card.club.university_short_name}</span>
            </span>
            {card.club.verification_status === 'verified' && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-cobalt" aria-label="官方認證" />
            )}
          </Link>
        </div>

        {card.contextual_event && (
          <Link
            href={`/e/${card.contextual_event.short_code}`}
            className={buttonClasses({
              variant: 'soft',
              size: 'md',
              className: 'mt-1 w-full min-w-0 justify-between',
            })}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{card.contextual_event.label}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        )}
      </div>
    </article>
  );
}
