import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowLeft, BadgeCheck, Calendar } from 'lucide-react';
import { db, isDatabaseConfigured } from '@/db';
import { clubEvents, clubs, posts, universities, userBookmarks } from '@/db/schema';
import { formatTaipeiDate } from '@/lib/academic-year';
import { getCurrentUser } from '@/lib/auth/guards';
import { POST_KIND_LABELS } from '@/lib/constants';
import { serializePublicStreamPost } from '@/lib/serializers';
import { BookmarkButton } from '@/components/BookmarkFollowButtons';
import { MarkdownView } from '@/components/MarkdownView';
import { clampedAspectRatio } from '@/components/PostCard';
import { ReportModal } from '@/components/ReportModal';
import { ShareButton } from '@/components/ShareButton';

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
  const gallery =
    post.media_items.length > 0
      ? post.media_items
      : [{ kind: 'image' as const, url: '/images/demo/moment-4x5.svg', width: 800, height: 1000, alt: post.headline }];

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-[var(--primary)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>回到別的聚探索</span>
        </Link>
        <Link href={`/clubs/${post.club.slug}`} className="text-blue-700 hover:underline">
          查看「{post.club.name}」門面 →
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${kindMeta.badgeClass}`}>
            {kindMeta.label}
          </span>
          {post.mood_tag && (
            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
              {post.mood_tag}
            </span>
          )}
          {post.club.is_demo && (
            <span className="rounded-full bg-slate-800 px-3 py-0.5 text-xs font-bold text-white">
              示範資料 (Demo)
            </span>
          )}
        </div>

        <h1 className="mt-4 text-xl font-extrabold leading-snug text-slate-900 sm:text-2xl">
          {post.headline}
        </h1>
        <p className="mt-2 text-xs text-slate-500">發布日期：{formatTaipeiDate(post.published_at)}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {gallery.map((media, idx) => (
            <div
              key={`${media.url}-${idx}`}
              className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--muted)] ${
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

        {post.content_md && (
          <div className="mt-6">
            <MarkdownView content={post.content_md} />
          </div>
        )}

        {post.contextual_event && (
          <Link
            href={`/e/${post.contextual_event.short_code}`}
            className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm font-bold text-blue-900 hover:bg-blue-100/70"
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>體驗活動：{post.contextual_event.title}</span>
            </span>
            <span className="shrink-0 text-xs">一鍵查看報名 →</span>
          </Link>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <BookmarkButton
              targetType="post"
              targetId={post.id}
              initialBookmarked={isBookmarked}
              isLoggedIn={Boolean(currentUser)}
            />
            <ShareButton />
          </div>
          <ReportModal
            targetType="post"
            targetId={post.id}
            isLoggedIn={Boolean(currentUser)}
          />
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-slate-500">這則現場紀錄來自</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="text-base font-extrabold text-slate-900">
              {post.club.university_short_name} · {post.club.name}
            </span>
            {post.club.verification_status === 'verified' && (
              <BadgeCheck className="h-4 w-4 text-blue-600" aria-label="官方認證社團" />
            )}
          </div>
        </div>
        <Link
          href={`/clubs/${post.club.slug}`}
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-center text-sm font-bold text-white hover:bg-[var(--primary-hover)]"
        >
          進入社團門面
        </Link>
      </div>
    </article>
  );
}
