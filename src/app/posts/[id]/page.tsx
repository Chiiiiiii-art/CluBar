import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowLeft, BadgeCheck, Calendar } from 'lucide-react';
import { db, isDatabaseConfigured } from '@/db';
import { clubEvents, clubs, posts, universities, userBookmarks } from '@/db/schema';
import { formatTaipeiDate } from '@/lib/academic-year';
import { getCurrentUser } from '@/lib/auth/guards';
import { POST_KIND_LABELS } from '@/lib/constants';
import { clampedAspectRatio, serializePublicStreamPost } from '@/lib/serializers';
import { BookmarkButton } from '@/components/BookmarkFollowButtons';
import { MarkdownView } from '@/components/MarkdownView';
import { ReportModal } from '@/components/ReportModal';
import { ShareButton } from '@/components/ShareButton';

import { Badge, ButtonLink, ClubMark } from '@/components/ui';
import { realMediaUrl } from '@/lib/media/placeholder';

export const dynamic = 'force-dynamic';

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  const [row] = await db
    .select({
      post: posts,
      club: clubs,
      universityShortName: universities.shortName,
    })
    .from(posts)
    .innerJoin(clubs, eq(posts.clubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(and(eq(posts.id, id), eq(posts.status, 'published')))
    .limit(1);

  if (!row) notFound();

  const [relEvent] = row.post.relatedEventId
    ? await db
        .select({
          shortCode: clubEvents.shortCode,
          title: clubEvents.title,
          startsAt: clubEvents.startsAt,
          locationText: clubEvents.locationText,
        })
        .from(clubEvents)
        .where(eq(clubEvents.id, row.post.relatedEventId))
        .limit(1)
    : [];

  let isBookmarked = false;
  if (currentUser) {
    const [bm] = await db
      .select({ targetId: userBookmarks.targetId })
      .from(userBookmarks)
      .where(
        and(
          eq(userBookmarks.userId, currentUser.id),
          eq(userBookmarks.targetType, 'post'),
          eq(userBookmarks.targetId, row.post.id)
        )
      )
      .limit(1);
    isBookmarked = Boolean(bm);
  }

  const post = serializePublicStreamPost({
    ...row.post,
    contextualEvent: relEvent ?? null,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      avatarUrl: row.club.avatarUrl,
      verificationStatus: row.club.verificationStatus,
      isDemo: row.club.isDemo,
      universityShortName: row.universityShortName,
    },
  });

  const kindMeta = POST_KIND_LABELS[post.post_kind];
  // Demo placeholder art is not content: only real media forms the gallery.
  const gallery = post.media_items.filter((m) => realMediaUrl(m.url));

  return (
    <article className="mx-auto min-w-0 max-w-3xl space-y-8 pb-12">
      {gallery.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {gallery.map((media, idx) => (
            <div
              key={`${media.url}-${idx}`}
              className={`overflow-hidden rounded-xl border border-line bg-ink-100 ${
                gallery.length === 1 ? 'sm:col-span-2' : ''
              }`}
              style={{ aspectRatio: clampedAspectRatio(media.width, media.height) }}
            >
              {media.kind === 'video' ? (
                <video
                  src={media.url}
                  poster={media.poster_url}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-contain"
                />
              ) : (
                <img
                  src={media.url}
                  alt={media.alt || post.headline}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              )}
            </div>
          ))}
        </div>
      )}

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{kindMeta.label}</Badge>
          {post.mood_tag && <Badge>{post.mood_tag}</Badge>}
        </div>
        <h1 className="break-words text-2xl font-bold leading-snug text-ink-900 sm:text-3xl">
          {post.headline}
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-600">
          <Link
            href={`/clubs/${post.club.slug}`}
            className="inline-flex min-h-11 min-w-0 items-center gap-2 font-medium text-ink-800 hover:text-accent-700"
          >
            <ClubMark name={post.club.name} seed={post.club.slug} size="sm" />
            <span className="break-words">
              {post.club.name} · {post.club.university_short_name}
            </span>
            {post.club.verification_status === 'verified' && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-accent-600" aria-label="官方認證社團" />
            )}
          </Link>
          <span aria-hidden="true">·</span>
          <time>{formatTaipeiDate(post.published_at)}</time>
        </div>
      </header>

      {post.content_md && (
        <div className="min-w-0 break-words">
          <MarkdownView content={post.content_md} />
        </div>
      )}

      {post.contextual_event && (
        <Link
          href={`/e/${post.contextual_event.short_code}`}
          className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-accent-50 p-4 text-sm font-semibold text-accent-900 hover:bg-accent-100"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="break-words">體驗活動：{post.contextual_event.title}</span>
          </span>
          <span className="shrink-0">查看報名 →</span>
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <BookmarkButton
          targetType="post"
          targetId={post.id}
          initialBookmarked={isBookmarked}
          isLoggedIn={Boolean(currentUser)}
        />
        <ShareButton />
        <ReportModal targetType="post" targetId={post.id} isLoggedIn={Boolean(currentUser)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink
          href="/"
          variant="ghost"
          icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
        >
          回到別的聚探索
        </ButtonLink>
        <ButtonLink href={`/clubs/${post.club.slug}`} variant="ghost">
          查看「{post.club.name}」門面 →
        </ButtonLink>
      </div>
    </article>
  );
}
