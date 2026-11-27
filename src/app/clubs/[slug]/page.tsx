import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { db, isDatabaseConfigured } from '@/db';
import {
  clubEvents,
  clubMemberships,
  clubQuestions,
  clubs,
  posts,
  universities,
  userFollows,
} from '@/db/schema';
import { formatTaipeiDate, formatTaipeiDateTime } from '@/lib/academic-year';
import { getCurrentUser } from '@/lib/auth/guards';
import { CLUB_CATEGORIES, POST_KIND_LABELS } from '@/lib/constants';
import { computeClubPulse } from '@/lib/discovery/fairness';
import {
  clampedAspectRatio,
  serializePublicClub,
  serializePublicQuestion,
  serializePublicStreamPost,
} from '@/lib/serializers';
import { FollowButton } from '@/components/BookmarkFollowButtons';
import { ClubDetailClient } from '@/components/ClubDetailClient';
import { ClubOfficialLinks, ClubPageViewTracker } from '@/components/ClubExternalLinks';
import { ReportModal } from '@/components/ReportModal';
import { ShareButton } from '@/components/ShareButton';

export const dynamic = 'force-dynamic';

export default async function ClubPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isDatabaseConfigured()) notFound();
  const { slug } = await params;
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
    pulseLabel: computeClubPulse({ lastActivityAt: clubRow.club.lastActivityAt }),
    university: clubRow.university,
  });

  const now = new Date();
  const [eventRows, postRows, questionRows] = await Promise.all([
    db
      .select()
      .from(clubEvents)
      .where(
        and(
          eq(clubEvents.clubId, clubRow.club.id),
          eq(clubEvents.status, 'open'),
          or(isNull(clubEvents.endsAt), gt(clubEvents.endsAt, now))
        )
      )
      .orderBy(desc(clubEvents.createdAt)),
    db
      .select()
      .from(posts)
      .where(and(eq(posts.clubId, clubRow.club.id), eq(posts.status, 'published')))
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt)),
    db
      .select()
      .from(clubQuestions)
      .where(and(eq(clubQuestions.clubId, clubRow.club.id), eq(clubQuestions.status, 'published')))
      .orderBy(desc(clubQuestions.isPinnedFaq), desc(clubQuestions.answeredAt)),
  ]);

  let isFollowed = false;
  let followMode: 'all' | 'events_only' = 'all';
  let membershipRole: 'owner' | 'editor' | 'member' | 'alumni' | null = null;
  if (currentUser) {
    const [followRow] = await db
      .select()
      .from(userFollows)
      .where(and(eq(userFollows.userId, currentUser.id), eq(userFollows.clubId, clubRow.club.id)))
      .limit(1);
    if (followRow) {
      isFollowed = true;
      followMode = followRow.followMode;
    }

    const [memRow] = await db
      .select({ role: clubMemberships.role })
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
    serializePublicStreamPost({
      ...p,
      club: {
        id: clubRow.club.id,
        slug: clubRow.club.slug,
        name: clubRow.club.name,
        avatarUrl: clubRow.club.avatarUrl,
        verificationStatus: clubRow.club.verificationStatus,
        isDemo: clubRow.club.isDemo,
        universityShortName: clubRow.university.shortName,
      },
    })
  );

  const questions = questionRows.map(serializePublicQuestion);
  const categoryMeta = CLUB_CATEGORIES[publicClub.category];
  const nrcCount = publicPosts.filter((p) => p.post_kind === 'nrc_moment').length;

  return (
    <div className="space-y-6">
      <ClubPageViewTracker clubId={publicClub.id} />

      {publicClub.verification_status === 'unclaimed_directory' && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5 text-sm text-amber-950">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-bold">這個社團還沒在社團聚開通主頁</p>
              <p className="text-xs text-amber-900">
                目前僅列出校方公開名錄資料。如果你是幹部，認領後就能放上活動與日常紀錄。
              </p>
            </div>
          </div>
          <Link
            href={`/clubs/apply?claim=${encodeURIComponent(publicClub.slug)}`}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-center text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
          >
            認領這個社團
          </Link>
        </div>
      )}

      {publicClub.verification_status === 'suspended' && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <p className="font-bold">此社團目前暫停發布與更新權限</p>
          </div>
        </div>
      )}

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
                {publicClub.verification_status === 'verified' ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-blue-700">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      官方認證社團
                    </span>
                    <span className="rounded-full bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-700">
                      {publicClub.pulse_label}
                    </span>
                  </>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-900">
                    待認領校方名錄
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
                initialMode={followMode}
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
            <ClubOfficialLinks
              clubId={publicClub.id}
              links={
                publicClub.verification_status === 'unclaimed_directory'
                  ? [
                      ...(publicClub.official_directory_url
                        ? [
                            {
                              type: 'website' as const,
                              label: '校方社團官方名錄',
                              url: publicClub.official_directory_url,
                            },
                          ]
                        : []),
                      ...publicClub.external_links.filter(
                        (l) => !l.url.includes('example.com')
                      ),
                    ]
                  : publicClub.external_links
              }
            />
            {(membershipRole === 'owner' ||
              membershipRole === 'editor' ||
              membershipRole === 'alumni' ||
              currentUser?.platformRole === 'platform_admin') && (
              <Link
                href={`/clubs/${publicClub.slug}/manage`}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
              >
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                <span>社團管理後台</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {eventRows.length > 0 && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-lg font-extrabold text-slate-900">近期可參加體驗活動</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {eventRows.map((ev) => (
              <Link
                key={ev.id}
                href={`/e/${ev.shortCode}`}
                className="flex flex-col justify-between gap-2 rounded-2xl border border-blue-200/80 bg-white p-4 shadow-xs hover:border-blue-400"
              >
                <h3 className="text-sm font-bold text-slate-900">{ev.title}</h3>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span>
                    {ev.scheduleMode === 'voting'
                      ? 'TBD 投票喬時間中'
                      : ev.startsAt
                        ? formatTaipeiDateTime(ev.startsAt)
                        : '時間 TBD'}
                  </span>
                  <span>· {ev.locationText}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 text-[11px] font-semibold">
                  {ev.beginnerFriendly && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-800">
                      零基礎可
                    </span>
                  )}
                  {ev.nonMembersWelcome && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-orange-800">
                      非社員可
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700">
                    {ev.feeNtd === 0 ? '免費' : `NT$${ev.feeNtd}`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold text-slate-900">社團日常與代表作品牆</h2>
          {publicClub.verification_status === 'verified' && (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-900">
              本學期共同累積 {nrcCount} 則社員日常足跡
            </span>
          )}
        </div>

        {publicPosts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-white p-8 text-center">
            <p className="text-sm font-bold text-slate-900">這個社團目前還沒有公開作品或日常紀錄</p>
            <p className="mt-1 text-xs text-slate-600">
              {publicClub.verification_status === 'unclaimed_directory'
                ? '等現任幹部完成認領後，就會陸續放上社團簡介、體驗活動與日常照片。'
                : '社團剛開通主頁，歡迎先從下方問答箱提問或稍後再回來看看。'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {publicClub.verification_status === 'unclaimed_directory' && (
                <Link
                  href={`/clubs/apply?claim=${encodeURIComponent(publicClub.slug)}`}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white hover:bg-[var(--primary-hover)]"
                >
                  我是幹部，立即認領
                </Link>
              )}
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--border-strong)] bg-[var(--muted)] px-4 text-xs font-bold text-slate-800 hover:bg-orange-100"
              >
                回別的聚看其他社團
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {publicPosts.map((post) => {
              const kindMeta = POST_KIND_LABELS[post.post_kind];
              const firstMedia = post.media_items[0];
              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-xs hover:shadow-md"
                >
                  <div
                    className="relative bg-[var(--muted)]"
                    style={{ aspectRatio: clampedAspectRatio(firstMedia?.width, firstMedia?.height) }}
                  >
                    <img
                      src={firstMedia?.url || '/images/demo/moment-4x5.svg'}
                      alt={firstMedia?.alt || post.headline}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span
                      className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-bold ${kindMeta.badgeClass}`}
                    >
                      {kindMeta.label}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-[var(--primary)]">
                      {post.headline}
                    </h3>
                    <span className="mt-auto text-xs text-slate-500">
                      {formatTaipeiDate(post.published_at)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {questions.length > 0 && (
        <section className="rounded-3xl border border-[var(--border-strong)] bg-white p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-slate-900">置頂新手 FAQ ＆ 公開問答箱</h2>
          <div className="mt-4 space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="rounded-2xl bg-[var(--muted)] p-4">
                <p className="text-sm font-bold text-slate-900">
                  Q（{q.display_asker}）：{q.question_text}
                </p>
                {q.answer_text && (
                  <p className="mt-1.5 text-sm text-slate-700">A：{q.answer_text}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <ClubDetailClient
        clubSlug={publicClub.slug}
        clubName={publicClub.name}
        universityShortName={publicClub.university.short_name}
        isVerifiedClub={publicClub.verification_status === 'verified'}
        isLoggedIn={Boolean(currentUser)}
        isCampusVerified={Boolean(currentUser?.campusVerifiedAt)}
        isSameUniversity={Boolean(
          currentUser?.campusVerifiedAt &&
            currentUser?.universityId === publicClub.university.id
        )}
        membershipRole={membershipRole}
      />
    </div>
  );
}
