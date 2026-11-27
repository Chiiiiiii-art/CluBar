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
import { Badge, ClubMark, buttonClasses } from '@/components/ui';
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
  const isUnclaimed = publicClub.verification_status === 'unclaimed_directory';
  // Qualitative trust signals only — no counts (docs/design/04-patterns.md §2).
  const trustSignals = isUnclaimed
    ? []
    : [
        publicClub.pulse_label,
        eventRows.some((ev) => ev.beginnerFriendly) ? '零基礎可' : null,
        eventRows.some((ev) => ev.nonMembersWelcome) ? '非社員可' : null,
        questions.some((q) => q.answer_text) ? '問答有回覆' : null,
      ].filter((v): v is string => Boolean(v));

  return (
    <div className="space-y-6">
      <ClubPageViewTracker clubId={publicClub.id} />

      {publicClub.verification_status === 'unclaimed_directory' && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-warning-300 bg-warning-soft p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5 text-sm text-warning-950">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" aria-hidden="true" />
            <div>
              <p className="font-bold">這個社團還沒在社團聚開通主頁</p>
              <p className="text-sm text-warning-fg">
                目前僅列出校方公開名錄資料。如果你是幹部，認領後就能放上活動與日常紀錄。
              </p>
            </div>
          </div>
          <Link
            href={`/clubs/apply?claim=${encodeURIComponent(publicClub.slug)}`}
            className={buttonClasses({ variant: 'primary', size: 'md', className: 'shrink-0' })}
          >
            認領這個社團
          </Link>
        </div>
      )}

      {publicClub.verification_status === 'suspended' && (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger-300 bg-danger-soft p-4 text-sm text-danger-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-fg" aria-hidden="true" />
          <div>
            <p className="font-bold">此社團目前暫停發布與更新權限</p>
          </div>
        </div>
      )}

      <section className="space-y-6">
        {realMediaUrl(publicClub.cover_url) && (
          <div className="flex justify-center overflow-hidden rounded-xl bg-surface-sunken">
            <img
              src={publicClub.cover_url!}
              alt={`${publicClub.name} 封面`}
              className="max-h-72 w-auto max-w-full object-contain"
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
              <ClubMark name={publicClub.name} seed={publicClub.slug} category={publicClub.category} size="lg" className="sm:h-20 sm:w-20 sm:text-3xl" />
            )}
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-2xl font-bold text-fg sm:text-3xl">{publicClub.name}</h1>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-fg-muted">
                <span>{publicClub.university.name}</span>
                <span aria-hidden="true">·</span>
                <span>{categoryMeta.label}</span>
                {publicClub.verification_status === 'verified' ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-brand-soft-fg">
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                      官方認證
                    </span>
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
            {publicClub.tagline && <p className="text-lg font-medium text-fg">{publicClub.tagline}</p>}
            {publicClub.description && (
              <p className="whitespace-pre-line text-base text-fg-secondary">{publicClub.description}</p>
            )}
          </div>
        )}

        {(trustSignals.length > 0 || questions.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {trustSignals.map((label) => (
              <Badge key={label}>{label}</Badge>
            ))}
            {questions.length > 0 && (
              <a
                href="#faq"
                className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-brand-soft-fg underline-offset-4 hover:underline"
              >
                先看新手 FAQ
              </a>
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
                className={buttonClasses({ variant: 'secondary', size: 'md' })}
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
            <Calendar className="h-5 w-5 text-brand-soft-fg" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-fg">近期活動</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {eventRows.map((ev) => (
              <Link
                key={ev.id}
                href={`/e/${ev.shortCode}`}
                className={buttonClasses({ variant: 'secondary', size: 'md', className: 'flex-col justify-between' })}
              >
                <h3 className="text-sm font-semibold text-fg">{ev.title}</h3>
                <div className="flex flex-wrap gap-2 text-sm text-fg-muted">
                  <span>
                    {ev.scheduleMode === 'voting'
                      ? '時間待定・投票中'
                      : ev.startsAt
                        ? formatTaipeiDateTime(ev.startsAt)
                        : '時間待定'}
                  </span>
                  <span>· {ev.locationText}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge>{ev.feeNtd === 0 ? '免費' : `NT$${ev.feeNtd}`}</Badge>
                  {ev.beginnerFriendly && <Badge>零基礎可</Badge>}
                  {ev.nonMembersWelcome && <Badge>非社員可</Badge>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section id="faq" className="rounded-xl border border-border-strong bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold text-fg">新手常問</h2>
          <div className="mt-4 space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl bg-surface-sunken p-4">
                <p className="text-sm font-semibold text-fg">
                  Q（{q.display_asker}）：{q.question_text}
                </p>
                {q.answer_text && (
                  <p className="mt-1.5 text-sm text-fg-secondary">A：{q.answer_text}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-fg">社團日常與代表作品牆</h2>
          {publicClub.verification_status === 'verified' && (
            <span className="rounded-full bg-brand-soft-hover px-3 py-1 text-sm font-semibold text-accent-900">
              本學期社員一起留下 {nrcCount} 則日常
            </span>
          )}
        </div>

        {publicPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface p-8 text-center">
            <p className="text-sm font-semibold text-fg">這個社團目前還沒有公開作品或日常紀錄</p>
            <p className="mt-1 text-sm text-fg-muted">
              {publicClub.verification_status === 'unclaimed_directory'
                ? '等現任幹部完成認領後，就會陸續放上社團簡介、體驗活動與日常照片。'
                : '社團剛開通主頁，歡迎先從下方問答箱提問或稍後再回來看看。'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {publicClub.verification_status === 'unclaimed_directory' && (
                <Link
                  href={`/clubs/apply?claim=${encodeURIComponent(publicClub.slug)}`}
                  className={buttonClasses({ variant: 'secondary', size: 'md' })}
                >
                  我是幹部，立即認領
                </Link>
              )}
              <Link
                href="/"
                className={buttonClasses({ variant: 'ghost', size: 'md' })}
              >
                回別的聚看其他社團
              </Link>
            </div>
          </div>
        ) : (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {publicPosts.map((post) => {
              const kindMeta = POST_KIND_LABELS[post.post_kind];
              const firstMedia = post.media_items[0];
              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="group mb-5 block break-inside-avoid overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-border-strong"
                >
                  <div
                    className="relative bg-surface-sunken"
                    style={{
                      aspectRatio:
                        firstMedia?.width && firstMedia?.height
                          ? `${firstMedia.width} / ${firstMedia.height}`
                          : clampedAspectRatio(firstMedia?.width, firstMedia?.height),
                    }}
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
                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-fg">
                      {post.headline}
                    </h3>
                    <span className="mt-auto text-sm text-fg-subtle">
                      {formatTaipeiDate(post.published_at)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>


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
