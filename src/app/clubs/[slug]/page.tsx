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
import { Badge, ClubMark } from '@/components/ui';
import { realMediaUrl } from '@/lib/media/placeholder';
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
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-warning-300 bg-warning-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5 text-sm text-warning-950">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" aria-hidden="true" />
            <div>
              <p className="font-bold">這個社團還沒在社團聚開通主頁</p>
              <p className="text-sm text-warning-900">
                目前僅列出校方公開名錄資料。如果你是幹部，認領後就能放上活動與日常紀錄。
              </p>
            </div>
          </div>
          <Link
            href={`/clubs/apply?claim=${encodeURIComponent(publicClub.slug)}`}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-accent-600 px-4 text-center text-sm font-semibold text-white hover:bg-accent-700"
          >
            認領這個社團
          </Link>
        </div>
      )}

      {publicClub.verification_status === 'suspended' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger-300 bg-danger-50 p-4 text-sm text-danger-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-700" aria-hidden="true" />
          <div>
            <p className="font-bold">此社團目前暫停發布與更新權限</p>
          </div>
        </div>
      )}

      <section className="space-y-6">
        {realMediaUrl(publicClub.cover_url) && (
          <div className="h-40 w-full overflow-hidden rounded-xl bg-ink-100 sm:h-56">
            <img
              src={publicClub.cover_url!}
              alt={`${publicClub.name} 封面`}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {realMediaUrl(publicClub.avatar_url) ? (
              <img
                src={publicClub.avatar_url!}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20"
              />
            ) : (
              <ClubMark name={publicClub.name} seed={publicClub.slug} size="lg" className="sm:h-20 sm:w-20 sm:text-3xl" />
            )}
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{publicClub.name}</h1>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink-600">
                <span>{publicClub.university.name}</span>
                <span aria-hidden="true">·</span>
                <span>{categoryMeta.label}</span>
                {publicClub.verification_status === 'verified' ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-accent-700">
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                      官方認證
                    </span>
                    {publicClub.pulse_label && (
                      <span className="inline-flex items-center gap-1 text-ink-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-success-500" aria-hidden="true" />
                        {publicClub.pulse_label}
                      </span>
                    )}
                  </>
                ) : (
                  <Badge tone="warning">待認領</Badge>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FollowButton
              clubId={publicClub.id}
              initialFollowed={isFollowed}
              initialMode={followMode}
              isLoggedIn={Boolean(currentUser)}
            />
            <ShareButton />
            <ReportModal targetType="club" targetId={publicClub.id} isLoggedIn={Boolean(currentUser)} />
          </div>
        </div>

        {(publicClub.tagline || publicClub.description) && (
          <div className="max-w-3xl space-y-2">
            {publicClub.tagline && <p className="text-lg font-medium text-ink-900">{publicClub.tagline}</p>}
            {publicClub.description && (
              <p className="whitespace-pre-line text-base text-ink-700">{publicClub.description}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
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
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-ink-300 bg-white px-3.5 py-2 text-sm font-semibold text-ink-800 hover:bg-ink-50"
              >
                <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                <span>社團管理後台</span>
              </Link>
            )}
        </div>
      </section>

      {eventRows.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-accent-700" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-ink-900">近期活動</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {eventRows.map((ev) => (
              <Link
                key={ev.id}
                href={`/e/${ev.shortCode}`}
                className="flex flex-col justify-between gap-2 rounded-xl border border-line bg-white p-4 transition-colors hover:border-ink-300"
              >
                <h3 className="text-sm font-semibold text-ink-900">{ev.title}</h3>
                <div className="flex flex-wrap gap-2 text-sm text-ink-600">
                  <span>
                    {ev.scheduleMode === 'voting'
                      ? 'TBD 投票喬時間中'
                      : ev.startsAt
                        ? formatTaipeiDateTime(ev.startsAt)
                        : '時間 TBD'}
                  </span>
                  <span>· {ev.locationText}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 text-xs font-semibold">
                  {ev.beginnerFriendly && (
                    <span className="rounded-full bg-success-50 px-2.5 py-0.5 text-success-800">
                      零基礎可
                    </span>
                  )}
                  {ev.nonMembersWelcome && (
                    <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-accent-800">
                      非社員可
                    </span>
                  )}
                  <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-ink-700">
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
          <h2 className="text-xl font-bold text-ink-900">社團日常與代表作品牆</h2>
          {publicClub.verification_status === 'verified' && (
            <span className="rounded-full bg-accent-100 px-3 py-1 text-sm font-semibold text-accent-900">
              本學期共同累積 {nrcCount} 則社員日常足跡
            </span>
          )}
        </div>

        {publicPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-ink-900">這個社團目前還沒有公開作品或日常紀錄</p>
            <p className="mt-1 text-sm text-ink-600">
              {publicClub.verification_status === 'unclaimed_directory'
                ? '等現任幹部完成認領後，就會陸續放上社團簡介、體驗活動與日常照片。'
                : '社團剛開通主頁，歡迎先從下方問答箱提問或稍後再回來看看。'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {publicClub.verification_status === 'unclaimed_directory' && (
                <Link
                  href={`/clubs/apply?claim=${encodeURIComponent(publicClub.slug)}`}
                  className="inline-flex min-h-[44px] items-center rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white hover:bg-accent-700"
                >
                  我是幹部，立即認領
                </Link>
              )}
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-ink-300 bg-ink-100 px-4 text-sm font-semibold text-ink-800 hover:bg-accent-100"
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
                  className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white shadow-xs hover:shadow-md"
                >
                  <div
                    className="relative bg-ink-100"
                    style={{ aspectRatio: clampedAspectRatio(firstMedia?.width, firstMedia?.height) }}
                  >
                    <img
                      src={firstMedia?.url || '/images/demo/moment-4x5.svg'}
                      alt={firstMedia?.alt || post.headline}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <span
                      className={`absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-sm font-semibold ${kindMeta.badgeClass}`}
                    >
                      {kindMeta.label}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 text-sm font-semibold text-ink-900 group-hover:text-accent-600">
                      {post.headline}
                    </h3>
                    <span className="mt-auto text-sm text-ink-500">
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
        <section className="rounded-xl border border-ink-300 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-ink-900">置頂新手 FAQ ＆ 公開問答箱</h2>
          <div className="mt-4 space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl bg-ink-100 p-4">
                <p className="text-sm font-semibold text-ink-900">
                  Q（{q.display_asker}）：{q.question_text}
                </p>
                {q.answer_text && (
                  <p className="mt-1.5 text-sm text-ink-700">A：{q.answer_text}</p>
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
