import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubMemberships,
  clubOpportunities,
  clubs,
  posts,
  universities,
  userFollows,
} from '@/db/schema';
import { formatTaipeiDate } from '@/lib/academic-year';
import { getCurrentUser } from '@/lib/auth/guards';
import { CLUB_CATEGORIES, POST_TYPES } from '@/lib/constants';
import {
  serializePublicClub,
  serializePublicOpportunity,
  serializePublicPost,
} from '@/lib/serializers';
import { postTypeSchema } from '@/lib/validators';
import { FollowButton } from '@/components/BookmarkFollowButtons';
import {
  ClubOfficialLinks,
  ClubPageViewTracker,
  OpportunitySignupLink,
} from '@/components/ClubExternalLinks';
import { ReportModal } from '@/components/ReportModal';
import { ShareButton } from '@/components/ShareButton';

export const dynamic = 'force-dynamic';

export default async function ClubPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string; post_type?: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();

  const { slug } = await params;
  const sp = await searchParams;
  const currentUser = await getCurrentUser();

  const [clubRow] = await db
    .select({
      club: clubs,
      university: {
        id: universities.id,
        code: universities.code,
        name: universities.name,
        shortName: universities.shortName,
      },
    })
    .from(clubs)
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(eq(clubs.slug, slug))
    .limit(1);

  if (!clubRow || clubRow.club.verificationStatus === 'pending_review') {
    notFound();
  }

  const publicClub = serializePublicClub({
    ...clubRow.club,
    university: clubRow.university,
  });

  const now = new Date();
  const oppRows = await db
    .select()
    .from(clubOpportunities)
    .where(
      and(
        eq(clubOpportunities.clubId, clubRow.club.id),
        eq(clubOpportunities.isActive, true),
        or(isNull(clubOpportunities.deadlineAt), gt(clubOpportunities.deadlineAt, now))
      )
    )
    .orderBy(desc(clubOpportunities.createdAt));

  const opportunities = oppRows.map(serializePublicOpportunity);

  const selectedYear =
    sp.year && /^\d{3}$/.test(sp.year) ? Number(sp.year) : undefined;
  const parsedType = sp.post_type ? postTypeSchema.safeParse(sp.post_type) : null;
  const selectedPostType = parsedType?.success ? parsedType.data : undefined;

  const postConditions = [eq(posts.clubId, clubRow.club.id), eq(posts.status, 'published')];
  if (selectedYear) postConditions.push(eq(posts.academicYear, selectedYear));
  if (selectedPostType) postConditions.push(eq(posts.postType, selectedPostType));

  const postRows = await db
    .select()
    .from(posts)
    .where(and(...postConditions))
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt));

  const availableYearRows = await db
    .selectDistinct({ academicYear: posts.academicYear })
    .from(posts)
    .where(and(eq(posts.clubId, clubRow.club.id), eq(posts.status, 'published')))
    .orderBy(desc(posts.academicYear));

  let isFollowed = false;
  let membershipRole: 'owner' | 'editor' | 'alumni' | null = null;
  if (currentUser) {
    const [followRow] = await db
      .select({ clubId: userFollows.clubId })
      .from(userFollows)
      .where(
        and(eq(userFollows.userId, currentUser.id), eq(userFollows.clubId, clubRow.club.id))
      )
      .limit(1);
    isFollowed = Boolean(followRow);

    const [memRow] = await db
      .select({ role: clubMemberships.role, endedAt: clubMemberships.endedAt })
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, clubRow.club.id),
          eq(clubMemberships.userId, currentUser.id),
          or(isNull(clubMemberships.endedAt), eq(clubMemberships.role, 'alumni'))
        )
      )
      .limit(1);
    if (memRow) membershipRole = memRow.role;
  }

  const publicPosts = postRows.map((p) =>
    serializePublicPost({
      ...p,
      club: {
        id: clubRow.club.id,
        slug: clubRow.club.slug,
        name: clubRow.club.name,
        category: clubRow.club.category,
        avatarUrl: clubRow.club.avatarUrl,
        verificationStatus: clubRow.club.verificationStatus,
        isDemo: clubRow.club.isDemo,
        universityShortName: clubRow.university.shortName,
      },
    })
  );

  const categoryMeta = CLUB_CATEGORIES[publicClub.category];
  const latestYear = availableYearRows[0]?.academicYear ?? 115;

  return (
    <div className="space-y-6">
      <ClubPageViewTracker clubId={publicClub.id} category={publicClub.category} />

      {publicClub.verification_status === 'unclaimed_directory' && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5 text-sm text-amber-950">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-bold">尚未認領之校方名錄社團</p>
              <p className="text-xs text-amber-900">
                此頁面資料來自大專校院公開社團名錄，若您是本社團現任幹部，歡迎認證接管並開始累積社團成果。
              </p>
            </div>
          </div>
          <Link
            href={`/clubs/apply?claim=${encodeURIComponent(publicClub.slug)}`}
            className="shrink-0 rounded-xl bg-[var(--primary)] px-4 py-2 text-center text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
          >
            我是社團幹部，申請認領
          </Link>
        </div>
      )}

      {publicClub.verification_status === 'suspended' && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <p className="font-bold">此社團目前暫停發布與更新權限</p>
            <p className="text-xs text-red-900">
              既有公開合規成果仍可瀏覽，社團幹部可前往通知中心查看管理員處置與申訴資訊。
            </p>
          </div>
        </div>
      )}

      {/* Club Identity Card */}
      <section className="overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-white shadow-xs">
        <div className="h-36 w-full overflow-hidden bg-[var(--muted)] sm:h-48">
          <img
            src={publicClub.cover_url || '/images/demo/cover.svg'}
            alt={`${publicClub.name} 封面`}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-800">
                  {publicClub.university.name}
                </span>
                <span
                  className={`rounded-full border px-3 py-0.5 text-xs font-bold ${categoryMeta.badgeClass}`}
                >
                  {categoryMeta.label}
                </span>
                {publicClub.verification_status === 'verified' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-700">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    官方認證社團
                  </span>
                )}
                {publicClub.is_demo && (
                  <span className="rounded-full bg-slate-800 px-3 py-0.5 text-xs font-bold text-white">
                    示範資料 (Demo)
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {publicClub.name}
              </h1>
              {publicClub.tagline && (
                <p className="text-sm font-medium text-slate-700 sm:text-base">
                  {publicClub.tagline}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FollowButton
                clubId={publicClub.id}
                initialFollowed={isFollowed}
                isLoggedIn={Boolean(currentUser)}
              />
              <ShareButton />
              <ReportModal
                targetType="club"
                targetId={publicClub.id}
                isLoggedIn={Boolean(currentUser)}
              />
            </div>
          </div>

          {publicClub.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {publicClub.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] pt-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">社團官方聯絡與外部管道</p>
              <ClubOfficialLinks
                clubId={publicClub.id}
                category={publicClub.category}
                links={publicClub.external_links}
              />
              {publicClub.external_links.length === 0 && publicClub.official_directory_url && (
                <a
                  href={publicClub.official_directory_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-semibold text-blue-700 underline"
                >
                  查看校方社團名錄頁面
                </a>
              )}
            </div>

            {(membershipRole === 'owner' ||
              membershipRole === 'editor' ||
              membershipRole === 'alumni' ||
              currentUser?.platformRole === 'platform_admin') && (
              <div className="flex flex-wrap gap-2">
                {(membershipRole === 'owner' || membershipRole === 'editor') && (
                  <Link
                    href={`/clubs/${publicClub.slug}/manage`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>社團管理後台</span>
                  </Link>
                )}
                <Link
                  href={`/clubs/${publicClub.slug}/summary/${latestYear}/print`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{latestYear} 學年度成果彙整</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Independent Opportunities Section (auto-hidden when empty per FR-MY-01) */}
      {opportunities.length > 0 && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-lg font-extrabold text-slate-900">近期參與機會／體驗招募</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-blue-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">{opp.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-600">{opp.summary}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
                    {opp.schedule_text && <span>時間／地點：{opp.schedule_text}</span>}
                    {opp.deadline_at && <span>截止日：{formatTaipeiDate(opp.deadline_at)}</span>}
                  </div>
                </div>
                <OpportunitySignupLink
                  clubId={publicClub.id}
                  category={publicClub.category}
                  href={opp.external_url}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Achievement Wall */}
      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="text-xl font-extrabold text-slate-900">社團成果貼文牆</h2>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/clubs/${publicClub.slug}`}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                !selectedPostType && !selectedYear
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-white text-slate-700 hover:bg-orange-50'
              }`}
            >
              全部
            </Link>
            {Object.entries(POST_TYPES).map(([key, meta]) => {
              const active = selectedPostType === key;
              const qs = new URLSearchParams();
              if (selectedYear) qs.set('year', String(selectedYear));
              if (!active) qs.set('post_type', key);
              return (
                <Link
                  key={key}
                  href={`/clubs/${publicClub.slug}${qs.toString() ? `?${qs.toString()}` : ''}`}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                    active
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-white text-slate-700 hover:bg-orange-50'
                  }`}
                >
                  {meta.label}
                </Link>
              );
            })}

            {availableYearRows.map((row) => {
              const active = selectedYear === row.academicYear;
              const qs = new URLSearchParams();
              if (!active) qs.set('year', String(row.academicYear));
              if (selectedPostType) qs.set('post_type', selectedPostType);
              return (
                <Link
                  key={row.academicYear}
                  href={`/clubs/${publicClub.slug}${qs.toString() ? `?${qs.toString()}` : ''}`}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-[var(--border-strong)] bg-white text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  {row.academicYear} 學年
                </Link>
              );
            })}
          </div>
        </div>

        {publicPosts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-white p-10 text-center">
            <p className="text-sm font-bold text-slate-900">目前尚無公開成果紀錄</p>
            <p className="mt-1 text-xs text-slate-600">
              {publicClub.verification_status === 'unclaimed_directory'
                ? '待社團幹部認領後即可開始新增活動與作品成果。'
                : '社團幹部可前往管理後台新增第一篇作品或活動成果。'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {publicPosts.map((post) => {
              const typeMeta = POST_TYPES[post.post_type];
              const thumb = post.media_urls[0]?.url || `/images/demo/${publicClub.category}.svg`;
              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] bg-[var(--muted)]">
                    <img
                      src={thumb}
                      alt={post.media_urls[0]?.alt || post.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span
                      className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-bold ${typeMeta.badgeClass}`}
                    >
                      {typeMeta.label}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 text-base font-bold text-slate-900 group-hover:text-[var(--primary)]">
                      {post.title}
                    </h3>
                    <p className="line-clamp-2 text-sm text-slate-600">{post.summary}</p>
                    <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-500">
                      <span>{post.academic_year} 學年度</span>
                      <span>{formatTaipeiDate(post.published_at)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
