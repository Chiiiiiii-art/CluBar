'use client';

import Link from 'next/link';
import { BadgeCheck, Sparkles } from 'lucide-react';
import { trackAnalyticsEvent } from '@/lib/analytics-client';
import { CLUB_CATEGORIES, POST_TYPES } from '@/lib/constants';
import type { DiscoverCardDTO } from '@/lib/serializers';

export function PostCard({
  card,
  sourceSurface = 'discover_topic',
}: {
  card: DiscoverCardDTO;
  sourceSurface?: 'discover_topic' | 'discover_nl';
}) {
  const categoryMeta = CLUB_CATEGORIES[card.club.category];
  const postTypeMeta = POST_TYPES[card.post_type];
  const imgSrc = card.cover_image?.url || `/images/demo/${card.club.category}.svg`;

  const handleCardClick = () => {
    trackAnalyticsEvent({
      event_type: 'discover_card_click',
      club_id: card.club.id,
      post_id: card.post_id,
      category: card.club.category,
      source_surface: sourceSurface,
    });
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md">
      <Link href={`/posts/${card.post_id}`} onClick={handleCardClick} className="block">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--muted)]">
          <img
            src={imgSrc}
            alt={card.cover_image?.alt || card.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${categoryMeta.badgeClass}`}
            >
              {categoryMeta.label}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${postTypeMeta.badgeClass}`}
            >
              {postTypeMeta.label}
            </span>
          </div>
          {card.club.is_demo && (
            <span className="absolute top-3 right-3 rounded-full bg-slate-900/75 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs">
              示範資料 (Demo)
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {card.reason && (
          <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50/90 px-3 py-2 text-xs font-medium text-orange-950">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
            <span>{card.reason}</span>
          </div>
        )}

        <Link href={`/posts/${card.post_id}`} onClick={handleCardClick} className="block space-y-1.5">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 group-hover:text-[var(--primary)]">
            {card.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">{card.summary}</p>
        </Link>

        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-[var(--muted)] px-2 py-0.5 text-xs font-medium text-slate-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3">
          <Link
            href={`/clubs/${card.club.slug}`}
            onClick={handleCardClick}
            className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-[var(--primary)]"
          >
            <span className="truncate">
              {card.club.university_short_name} · {card.club.name}
            </span>
            {card.club.verification_status === 'verified' && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-blue-600" aria-label="官方認證社團" />
            )}
          </Link>
          <span className="shrink-0 text-xs text-slate-500">{card.academic_year} 學年</span>
        </div>
      </div>
    </article>
  );
}
