import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { ArrowLeft, BadgeCheck, ExternalLink, Users } from 'lucide-react';
import { db, isDatabaseConfigured } from '@/db';
import { clubs, posts, universities, userBookmarks } from '@/db/schema';
import { formatTaipeiDate } from '@/lib/academic-year';
import { getCurrentUser } from '@/lib/auth/guards';
import { CLUB_CATEGORIES, POST_TYPES } from '@/lib/constants';
import { serializePublicPost } from '@/lib/serializers';
import { BookmarkButton } from '@/components/BookmarkFollowButtons';
import { MarkdownView } from '@/components/MarkdownView';
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

  if (!row) {
    notFound();
  }

  let isBookmarked = false;
  if (currentUser) {
    const [bm] = await db
      .select({ postId: userBookmarks.postId })
      .from(userBookmarks)
      .where(and(eq(userBookmarks.userId, currentUser.id), eq(userBookmarks.postId, row.post.id)))
      .limit(1);
    isBookmarked = Boolean(bm);
  }

  const post = serializePublicPost({
    ...row.post,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      category: row.club.category,
      avatarUrl: row.club.avatarUrl,
      verificationStatus: row.club.verificationStatus,
      isDemo: row.club.isDemo,
      universityShortName: row.universityShortName,
    },
  });

  const catMeta = CLUB_CATEGORIES[post.club.category];
  const typeMeta = POST_TYPES[post.post_type];
  const gallery =
    post.media_urls.length > 0
      ? post.media_urls
      : [{ url: `/images/demo/${post.club.category}.svg`, alt: post.title }];

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-[var(--primary)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>回到別的聚探索</span>
        </Link>
        <Link
          href={`/clubs/${post.club.slug}`}
          className="text-blue-700 hover:underline"
        >
          查看「{post.club.name}」完整成果牆 →
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${catMeta.badgeClass}`}>
            {catMeta.label}
          </span>
          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${typeMeta.badgeClass}`}>
            {typeMeta.label}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
            {post.academic_year} 學年度
          </span>
          {post.club.is_demo && (
            <span className="rounded-full bg-slate-800 px-3 py-0.5 text-xs font-bold text-white">
              示範資料 (Demo)
            </span>
          )}
        </div>

        <h1 className="mt-4 text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">
          {post.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>發布日期：{formatTaipeiDate(post.published_at)}</span>
          {post.collaborators && (
            <span className="inline-flex items-center gap-1 text-slate-700">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              合作單位：{post.collaborators}
            </span>
          )}
        </div>

        {/* Image Gallery */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {gallery.map((media, idx) => (
            <div
              key={`${media.url}-${idx}`}
              className={`overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--muted)] ${
                gallery.length === 1 ? 'sm:col-span-2' : ''
              }`}
            >
              <img
                src={media.url}
                alt={media.alt || post.title}
                loading="lazy"
                className="max-h-96 w-full object-cover"
              />
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="mt-6">
          <MarkdownView content={post.content_md} />
        </div>

        {post.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-orange-100"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {post.external_links.length > 0 && (
          <div className="mt-6 rounded-2xl bg-[var(--muted)] p-4">
            <p className="mb-2 text-xs font-bold text-slate-700">相關作品／活動連結</p>
            <div className="flex flex-wrap gap-2">
              {post.external_links.map((link, idx) => (
                <a
                  key={`${link.url}-${idx}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  <span>{link.label}</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Private Actions Bar (Zero Vanity Counts) */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <BookmarkButton
              postId={post.id}
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

      {/* 1-Click Club Entry Card */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[var(--border-strong)] bg-white p-5 shadow-xs sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-slate-500">這篇成果來自</p>
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
          進入社團主頁了解與聯繫
        </Link>
      </div>
    </article>
  );
}
