import crypto from 'node:crypto';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { db } from '@/db';
import {
  clubEvents,
  clubMemberships,
  clubs,
  coClubLinks,
  eventAlbumPhotos,
  eventComments,
  eventPollOptions,
  eventPollVotes,
  eventRsvps,
  universities,
  users,
  posts,
  type AlbumPhotoStatus,
  type EventScheduleMode,
  type EventStatus,
  type RsvpPrivacyMode,
  type RsvpStatus,
} from '@/db/schema';
import { formatTaipeiDateTime } from '@/lib/academic-year';
import type { AuthenticatedUser } from '@/lib/auth/guards';
import { LEARNING_HOURS_LABELS } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import { recordAnalyticsEvent } from '@/lib/services/analytics';
import type { PublicEventDetailDTO } from '@/lib/serializers';
import { eventWriteSchema } from '@/lib/validators';

export type EventWriteInput = z.infer<typeof eventWriteSchema>;

export interface EventPollOptionDTO {
  id: string;
  option_type: 'time_slot' | 'topic';
  label: string;
  starts_at: string | null;
  ends_at: string | null;
  is_selected: boolean;
  vote_count: number;
  viewer_voted: boolean;
}

export interface EventCommentDTO {
  id: string;
  display_author: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
  is_mine: boolean;
}

export interface EventAlbumPhotoDTO {
  id: string;
  preview_url: string;
  original_url: string;
  width: number;
  height: number;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  status: AlbumPhotoStatus;
  include_in_evaluation: boolean;
  created_at: string;
}

export interface EventFullViewDTO {
  detail: PublicEventDetailDTO;
  poll_options: EventPollOptionDTO[];
  comments: EventCommentDTO[];
  album_photos: EventAlbumPhotoDTO[];
  pending_album_photos: EventAlbumPhotoDTO[];
  viewer_rsvp: {
    status: RsvpStatus;
    privacy_mode: RsvpPrivacyMode;
    display_alias: string | null;
    attended: boolean;
  } | null;
  permissions: {
    is_officer: boolean;
    is_going: boolean;
    can_participate: boolean;
  };
}

export async function getEventRowByShortCode(shortCode: string) {
  const [row] = await db
    .select({
      event: clubEvents,
      club: clubs,
      university: universities,
    })
    .from(clubEvents)
    .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(eq(clubEvents.shortCode, shortCode))
    .limit(1);

  if (!row) {
    throw new AppError(404, 'EVENT_NOT_FOUND', '找不到指定活動。');
  }
  return row;
}

async function generateUniqueShortCode(clubSlug: string): Promise<string> {
  const prefix = clubSlug
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 6)
    .toLowerCase();
  for (let i = 0; i < 6; i += 1) {
    const token = crypto.randomBytes(2).toString('hex');
    const candidate = `${prefix || 'ev'}-${token}`;
    const [existing] = await db
      .select({ id: clubEvents.id })
      .from(clubEvents)
      .where(eq(clubEvents.shortCode, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `ev-${crypto.randomBytes(4).toString('hex')}`;
}

export async function createClubEvent(params: {
  clubId: string;
  clubSlug: string;
  universityId: string;
  userId: string;
  input: EventWriteInput;
}) {
  const { input } = params;
  const startsAt = input.starts_at ? new Date(input.starts_at) : null;
  const endsAt = input.ends_at ? new Date(input.ends_at) : null;

  if (input.schedule_mode === 'scheduled' && !startsAt) {
    throw new AppError(400, 'SCHEDULE_START_REQUIRED', '排定時段活動必須填寫開始時間。');
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new AppError(400, 'INVALID_TIME_RANGE', '活動結束時間不可早於開始時間。');
  }

  const shortCode = await generateUniqueShortCode(params.clubSlug);

  const created = await db.transaction(async (tx) => {
    const [event] = await tx
      .insert(clubEvents)
      .values({
        clubId: params.clubId,
        createdBy: params.userId,
        shortCode,
        title: input.title,
        summary: input.summary,
        descriptionMd: input.description_md,
        themePreset: input.theme_preset,
        coverMedia: input.cover_media ?? null,
        scheduleMode: input.schedule_mode,
        startsAt,
        endsAt,
        locationText: input.location_text,
        beginnerFriendly: input.beginner_friendly,
        nonMembersWelcome: input.non_members_welcome,
        campusOnly: input.campus_only,
        feeNtd: input.fee_ntd,
        feeNote: input.fee_note ?? null,
        learningHoursCategory: input.learning_hours_category,
        learningHoursCount: String(input.learning_hours_count),
        preEventNotes: input.pre_event_notes ?? null,
        capacity: input.capacity ?? null,
        externalRegistrationUrl: input.external_registration_url ?? null,
        domainIds: input.domain_ids,
        status: 'open',
        icsSequence: 0,
        includeInEvaluation: input.include_in_evaluation,
      })
      .returning();

    if (input.poll_options && input.poll_options.length > 0) {
      await tx.insert(eventPollOptions).values(
        input.poll_options.map((opt) => ({
          eventId: event.id,
          optionType: opt.option_type,
          label: opt.label,
          startsAt: opt.starts_at ? new Date(opt.starts_at) : null,
          endsAt: opt.ends_at ? new Date(opt.ends_at) : null,
        }))
      );
    }

    await tx
      .update(clubs)
      .set({ lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(clubs.id, params.clubId));

    return event;
  });

  return created;
}

export async function updateClubEvent(params: {
  eventId: string;
  input: Partial<EventWriteInput> & {
    status?: EventStatus;
    lock_poll_option_id?: string;
  };
}) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(clubEvents)
      .where(eq(clubEvents.id, params.eventId))
      .limit(1);

    if (!current) {
      throw new AppError(404, 'EVENT_NOT_FOUND', '找不到指定活動。');
    }

    const { input } = params;
    let nextMode: EventScheduleMode = input.schedule_mode ?? current.scheduleMode;
    let nextStartsAt =
      input.starts_at !== undefined
        ? input.starts_at
          ? new Date(input.starts_at)
          : null
        : current.startsAt;
    let nextEndsAt =
      input.ends_at !== undefined
        ? input.ends_at
          ? new Date(input.ends_at)
          : null
        : current.endsAt;

    let bumpSequence = false;

    if (input.lock_poll_option_id) {
      const [opt] = await tx
        .select()
        .from(eventPollOptions)
        .where(
          and(
            eq(eventPollOptions.id, input.lock_poll_option_id),
            eq(eventPollOptions.eventId, current.id)
          )
        )
        .limit(1);

      if (!opt) {
        throw new AppError(404, 'POLL_OPTION_NOT_FOUND', '找不到指定的投票選項。');
      }

      await tx
        .update(eventPollOptions)
        .set({ isSelected: false })
        .where(eq(eventPollOptions.eventId, current.id));

      await tx
        .update(eventPollOptions)
        .set({ isSelected: true })
        .where(eq(eventPollOptions.id, opt.id));

      if (opt.optionType === 'time_slot' && opt.startsAt) {
        nextMode = 'scheduled';
        nextStartsAt = opt.startsAt;
        nextEndsAt = opt.endsAt ?? current.endsAt;
        bumpSequence = true;
      }
    }

    if (nextMode === 'scheduled' && !nextStartsAt) {
      throw new AppError(400, 'SCHEDULE_START_REQUIRED', '排定時段活動必須有開始時間。');
    }
    if (nextStartsAt && nextEndsAt && nextEndsAt < nextStartsAt) {
      throw new AppError(400, 'INVALID_TIME_RANGE', '活動結束時間不可早於開始時間。');
    }

    const nextTitle = input.title ?? current.title;
    const nextLocation = input.location_text ?? current.locationText;
    const nextStatus = input.status ?? current.status;

    if (
      nextTitle !== current.title ||
      nextLocation !== current.locationText ||
      nextMode !== current.scheduleMode ||
      nextStartsAt?.getTime() !== current.startsAt?.getTime() ||
      nextEndsAt?.getTime() !== current.endsAt?.getTime() ||
      (nextStatus === 'cancelled' && current.status !== 'cancelled')
    ) {
      bumpSequence = true;
    }

    const [updated] = await tx
      .update(clubEvents)
      .set({
        title: nextTitle,
        summary: input.summary ?? current.summary,
        descriptionMd: input.description_md ?? current.descriptionMd,
        themePreset: input.theme_preset ?? current.themePreset,
        coverMedia: input.cover_media !== undefined ? input.cover_media : current.coverMedia,
        scheduleMode: nextMode,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        locationText: nextLocation,
        beginnerFriendly: input.beginner_friendly ?? current.beginnerFriendly,
        nonMembersWelcome: input.non_members_welcome ?? current.nonMembersWelcome,
        campusOnly: input.campus_only ?? current.campusOnly,
        feeNtd: input.fee_ntd ?? current.feeNtd,
        feeNote: input.fee_note !== undefined ? input.fee_note : current.feeNote,
        learningHoursCategory: input.learning_hours_category ?? current.learningHoursCategory,
        learningHoursCount:
          input.learning_hours_count !== undefined
            ? String(input.learning_hours_count)
            : current.learningHoursCount,
        preEventNotes:
          input.pre_event_notes !== undefined ? input.pre_event_notes : current.preEventNotes,
        capacity: input.capacity !== undefined ? input.capacity : current.capacity,
        externalRegistrationUrl:
          input.external_registration_url !== undefined
            ? input.external_registration_url
            : current.externalRegistrationUrl,
        domainIds: input.domain_ids ?? current.domainIds,
        includeInEvaluation: input.include_in_evaluation ?? current.includeInEvaluation,
        status: nextStatus,
        icsSequence: bumpSequence ? current.icsSequence + 1 : current.icsSequence,
        updatedAt: new Date(),
      })
      .where(eq(clubEvents.id, current.id))
      .returning();

    return updated;
  });
}

export async function getPublicEventDetail(
  shortCode: string,
  viewer?: AuthenticatedUser | null
): Promise<EventFullViewDTO | null> {
  const [found] = await db
    .select({
      event: clubEvents,
      club: clubs,
      university: universities,
    })
    .from(clubEvents)
    .innerJoin(clubs, eq(clubEvents.clubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(eq(clubEvents.shortCode, shortCode))
    .limit(1);

  if (!found) return null;
  const { event, club, university } = found;

  // Accepted Co-Host clubs
  const coHostRows = await db
    .select({
      id: clubs.id,
      slug: clubs.slug,
      name: clubs.name,
      universityShortName: universities.shortName,
    })
    .from(coClubLinks)
    .innerJoin(clubs, eq(coClubLinks.partnerClubId, clubs.id))
    .innerJoin(universities, eq(clubs.universityId, universities.id))
    .where(
      and(
        eq(coClubLinks.targetType, 'event'),
        eq(coClubLinks.targetId, event.id),
        eq(coClubLinks.status, 'accepted')
      )
    );

  // Determine officer status across host + accepted co-host clubs
  let isOfficer = false;
  if (viewer) {
    const hostClubIds = [club.id, ...coHostRows.map((c) => c.id)];
    const [officerRow] = await db
      .select({ id: clubMemberships.id })
      .from(clubMemberships)
      .where(
        and(
          inArray(clubMemberships.clubId, hostClubIds),
          eq(clubMemberships.userId, viewer.id),
          sql`${clubMemberships.endedAt} IS NULL`,
          inArray(clubMemberships.role, ['owner', 'editor'])
        )
      )
      .limit(1);
    isOfficer = Boolean(officerRow);
  }

  // RSVPs: aggregate counts & strictly omit private_count_only user identities
  const rsvpRows = await db
    .select({
      userId: eventRsvps.userId,
      status: eventRsvps.status,
      privacyMode: eventRsvps.privacyMode,
      displayAlias: eventRsvps.displayAlias,
      attended: eventRsvps.attended,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(eventRsvps)
    .innerJoin(users, eq(eventRsvps.userId, users.id))
    .where(eq(eventRsvps.eventId, event.id));

  let goingCount = 0;
  let interestedCount = 0;
  const publicAttendees: { display_name: string; avatar_url: string | null }[] = [];
  let viewerRsvp: EventFullViewDTO['viewer_rsvp'] = null;

  for (const row of rsvpRows) {
    if (row.status === 'going') goingCount += 1;
    if (row.status === 'interested') interestedCount += 1;

    if (row.status === 'going' && row.privacyMode === 'public_to_attendees') {
      publicAttendees.push({
        display_name: row.displayAlias?.trim() || row.displayName,
        avatar_url: row.avatarUrl,
      });
    }

    if (viewer && row.userId === viewer.id) {
      viewerRsvp = {
        status: row.status,
        privacy_mode: row.privacyMode,
        display_alias: row.displayAlias,
        attended: row.attended,
      };
    }
  }

  // Poll options + aggregated votes
  const pollRows = await db
    .select()
    .from(eventPollOptions)
    .where(eq(eventPollOptions.eventId, event.id))
    .orderBy(asc(eventPollOptions.createdAt));

  let pollOptionsDto: EventPollOptionDTO[] = [];
  if (pollRows.length > 0) {
    const optionIds = pollRows.map((p) => p.id);
    const votes = await db
      .select({
        optionId: eventPollVotes.optionId,
        userId: eventPollVotes.userId,
      })
      .from(eventPollVotes)
      .where(inArray(eventPollVotes.optionId, optionIds));

    pollOptionsDto = pollRows.map((opt) => {
      const optVotes = votes.filter((v) => v.optionId === opt.id);
      return {
        id: opt.id,
        option_type: opt.optionType === 'topic' ? 'topic' : 'time_slot',
        label: opt.label,
        starts_at: opt.startsAt ? opt.startsAt.toISOString() : null,
        ends_at: opt.endsAt ? opt.endsAt.toISOString() : null,
        is_selected: opt.isSelected,
        vote_count: optVotes.length,
        viewer_voted: viewer ? optVotes.some((v) => v.userId === viewer.id) : false,
      };
    });
  }

  // Comments (zero-PII public DTO)
  const commentRows = await db
    .select({
      id: eventComments.id,
      authorUserId: eventComments.authorUserId,
      content: eventComments.content,
      createdAt: eventComments.createdAt,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(eventComments)
    .innerJoin(users, eq(eventComments.authorUserId, users.id))
    .where(and(eq(eventComments.eventId, event.id), eq(eventComments.isDeleted, false)))
    .orderBy(desc(eventComments.createdAt))
    .limit(60);

  const comments: EventCommentDTO[] = commentRows.map((c) => ({
    id: c.id,
    display_author: c.displayName,
    avatar_url: c.avatarUrl,
    content: c.content,
    created_at: c.createdAt.toISOString(),
    is_mine: Boolean(viewer && c.authorUserId === viewer.id),
  }));

  // Album photos: public sees ONLY approved_album & featured_stream
  const albumRows = await db
    .select()
    .from(eventAlbumPhotos)
    .where(
      and(
        eq(eventAlbumPhotos.eventId, event.id),
        inArray(
          eventAlbumPhotos.status,
          isOfficer
            ? ['featured_stream', 'approved_album', 'pending_review']
            : ['featured_stream', 'approved_album']
        )
      )
    )
    .orderBy(desc(eventAlbumPhotos.createdAt));

  const mapPhoto = (p: typeof eventAlbumPhotos.$inferSelect): EventAlbumPhotoDTO => ({
    id: p.id,
    preview_url: p.previewUrl,
    original_url: p.originalUrl,
    width: p.width,
    height: p.height,
    mime_type: p.mimeType,
    size_bytes: p.sizeBytes,
    caption: p.caption,
    status: p.status,
    include_in_evaluation: p.includeInEvaluation,
    created_at: p.createdAt.toISOString(),
  });

  const albumPhotos = albumRows
    .filter((p) => p.status === 'featured_stream' || p.status === 'approved_album')
    .map(mapPhoto);
  const pendingAlbumPhotos = isOfficer
    ? albumRows.filter((p) => p.status === 'pending_review').map(mapPhoto)
    : [];

  const isGoing = viewerRsvp?.status === 'going';

  return {
    detail: {
      id: event.id,
      short_code: event.shortCode,
      title: event.title,
      summary: event.summary,
      description_md: event.descriptionMd,
      theme_preset: event.themePreset,
      cover_media: event.coverMedia,
      schedule_mode: event.scheduleMode,
      starts_at: event.startsAt ? event.startsAt.toISOString() : null,
      ends_at: event.endsAt ? event.endsAt.toISOString() : null,
      location_text: event.locationText,
      beginner_friendly: event.beginnerFriendly,
      non_members_welcome: event.nonMembersWelcome,
      campus_only: event.campusOnly,
      fee_ntd: event.feeNtd,
      fee_note: event.feeNote,
      learning_hours_category: event.learningHoursCategory,
      learning_hours_count: Number(event.learningHoursCount || 0),
      pre_event_notes: event.preEventNotes,
      capacity: event.capacity,
      external_registration_url: event.externalRegistrationUrl,
      status: event.status,
      ics_sequence: event.icsSequence,
      going_count: goingCount,
      interested_count: interestedCount,
      public_attendees: publicAttendees,
      club: {
        id: club.id,
        slug: club.slug,
        name: club.name,
        avatar_url: club.avatarUrl,
        is_demo: club.isDemo,
        university_id: university.id,
        university_short_name: university.shortName,
      },
      co_host_clubs: coHostRows.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        university_short_name: c.universityShortName,
      })),
    },
    poll_options: pollOptionsDto,
    comments,
    album_photos: albumPhotos,
    pending_album_photos: pendingAlbumPhotos,
    viewer_rsvp: viewerRsvp,
    permissions: {
      is_officer: isOfficer,
      is_going: isGoing,
      can_participate: isOfficer || isGoing,
    },
  };
}

export async function upsertEventRsvp(params: {
  event: typeof clubEvents.$inferSelect;
  clubUniversityId: string;
  user: AuthenticatedUser;
  status: RsvpStatus;
  privacyMode: RsvpPrivacyMode;
  displayAlias?: string | null;
}) {
  const { event, user } = params;

  if (event.status === 'cancelled' || event.status === 'completed') {
    throw new AppError(400, 'EVENT_CLOSED', '此活動已結束或取消，無法變更報名狀態。');
  }

  if (event.campusOnly) {
    if (!user.campusVerifiedAt || user.universityId !== params.clubUniversityId) {
      throw new AppError(
        403,
        'CAMPUS_ONLY_EVENT',
        '此活動僅限該校已完成 .edu.tw 校園驗證的學生報名。'
      );
    }
  }

  const saved = await db.transaction(async (tx) => {
    if (params.status === 'going' && event.capacity !== null) {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(eventRsvps)
        .where(
          and(
            eq(eventRsvps.eventId, event.id),
            eq(eventRsvps.status, 'going'),
            ne(eventRsvps.userId, user.id)
          )
        );
      if (count >= event.capacity) {
        throw new AppError(409, 'EVENT_FULL', '此活動已達報名人數上限。');
      }
    }

    const cleanAlias =
      params.privacyMode === 'public_to_attendees' && params.displayAlias?.trim()
        ? params.displayAlias.trim().slice(0, 40)
        : null;

    const [row] = await tx
      .insert(eventRsvps)
      .values({
        eventId: event.id,
        userId: user.id,
        status: params.status,
        privacyMode: params.privacyMode,
        displayAlias: cleanAlias,
      })
      .onConflictDoUpdate({
        target: [eventRsvps.eventId, eventRsvps.userId],
        set: {
          status: params.status,
          privacyMode: params.privacyMode,
          displayAlias: cleanAlias,
          updatedAt: new Date(),
        },
      })
      .returning();

    return row;
  });

  if (params.status === 'going') {
    await recordAnalyticsEvent({
      eventType: 'event_rsvp_going',
      clubId: event.clubId,
      targetId: event.id,
      universityId: params.clubUniversityId,
      sourceSurface: 'event_page',
      userId: user.id,
    });
  }

  return saved;
}

export async function curateAlbumPhoto(params: {
  event: typeof clubEvents.$inferSelect;
  photoId: string;
  officerUserId: string;
  action: 'approve' | 'feature' | 'reject';
  includeInEvaluation?: boolean;
}) {
  return db.transaction(async (tx) => {
    const [photo] = await tx
      .select()
      .from(eventAlbumPhotos)
      .where(
        and(eq(eventAlbumPhotos.id, params.photoId), eq(eventAlbumPhotos.eventId, params.event.id))
      )
      .limit(1);

    if (!photo) {
      throw new AppError(404, 'ALBUM_PHOTO_NOT_FOUND', '找不到指定相簿照片。');
    }

    if (params.action === 'feature') {
      if (!photo.consentConfirmed) {
        throw new AppError(400, 'CONSENT_REQUIRED', '此照片未經上傳者肖像與公開授權，無法精選。');
      }

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(eventAlbumPhotos)
        .where(
          and(
            eq(eventAlbumPhotos.eventId, params.event.id),
            eq(eventAlbumPhotos.status, 'featured_stream'),
            ne(eventAlbumPhotos.id, photo.id)
          )
        );

      if (count >= 3) {
        throw new AppError(
          409,
          'MAX_FEATURED_PHOTOS_REACHED',
          '單場活動最多精選 3 張照片登上探索現場流。'
        );
      }

      const includeEval = params.includeInEvaluation ?? photo.includeInEvaluation;
      const [updatedPhoto] = await tx
        .update(eventAlbumPhotos)
        .set({
          status: 'featured_stream',
          curatedBy: params.officerUserId,
          includeInEvaluation: includeEval,
        })
        .where(eq(eventAlbumPhotos.id, photo.id))
        .returning();

      const [existingPost] = await tx
        .select()
        .from(posts)
        .where(eq(posts.sourceAlbumPhotoId, photo.id))
        .limit(1);

      const headline = photo.caption?.trim()
        ? `${params.event.title}｜${photo.caption.trim()}`.slice(0, 120)
        : `${params.event.title} 現場精選瞬間`.slice(0, 120);

      if (existingPost) {
        await tx
          .update(posts)
          .set({
            status: 'published',
            headline,
            includeInEvaluation: includeEval,
            publishedAt: existingPost.publishedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(posts.id, existingPost.id));
      } else {
        await tx.insert(posts).values({
          clubId: params.event.clubId,
          authorUserId: params.officerUserId,
          postKind: 'album_highlight',
          headline,
          contentMd: photo.caption?.trim() || `來自活動《${params.event.title}》的現場精選照片。`,
          mediaItems: [
            {
              kind: 'image',
              url: photo.previewUrl,
              width: photo.width,
              height: photo.height,
              alt: photo.caption || params.event.title,
            },
          ],
          relatedEventId: params.event.id,
          sourceAlbumPhotoId: photo.id,
          domainIds: params.event.domainIds,
          originalityConfirmed: true,
          includeInEvaluation: includeEval,
          status: 'published',
          publishedAt: new Date(),
        });
      }

      return updatedPhoto;
    }

    const nextStatus: AlbumPhotoStatus =
      params.action === 'approve' ? 'approved_album' : 'rejected';

    const [updatedPhoto] = await tx
      .update(eventAlbumPhotos)
      .set({
        status: nextStatus,
        curatedBy: params.officerUserId,
        includeInEvaluation:
          params.action === 'reject'
            ? false
            : (params.includeInEvaluation ?? photo.includeInEvaluation),
      })
      .where(eq(eventAlbumPhotos.id, photo.id))
      .returning();

    await tx
      .update(posts)
      .set({ status: 'hidden_by_owner', updatedAt: new Date() })
      .where(eq(posts.sourceAlbumPhotoId, photo.id));

    return updatedPhoto;
  });
}

export function buildEventPromoPack(params: {
  event: typeof clubEvents.$inferSelect;
  club: typeof clubs.$inferSelect;
  universityShortName: string;
  baseUrl: string;
}) {
  const { event, club, universityShortName, baseUrl } = params;
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const eventUrl = `${cleanBase}/e/${event.shortCode}`;
  const ogStoryImageUrl = `${cleanBase}/api/og/events/${event.shortCode}?format=story`;
  const ogLandscapeImageUrl = `${cleanBase}/api/og/events/${event.shortCode}`;
  const timeText = event.startsAt
    ? formatTaipeiDateTime(event.startsAt)
    : event.scheduleMode === 'voting'
      ? '時間投票中（點連結投票喬時間）'
      : '時間待定（TBD）';
  const feeText = event.feeNtd > 0 ? `NT$ ${event.feeNtd}` : '免費參加';
  const hoursText =
    event.learningHoursCategory !== 'none' && Number(event.learningHoursCount) > 0
      ? `｜可登錄${LEARNING_HOURS_LABELS[event.learningHoursCategory]} ${Number(event.learningHoursCount)} 小時`
      : '';

  const lineMessage = [
    `【${universityShortName} ${club.name}｜${event.title}】`,
    event.summary || null,
    `時間：${timeText}`,
    `地點：${event.locationText}`,
    `條件：${event.beginnerFriendly ? '零基礎友善' : '進階體驗'}／${event.nonMembersWelcome ? '非社員歡迎' : '限社員'}／${feeText}${hoursText}`,
    `1-Click 報名與行事曆：${eventUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const discordMarkdown = [
    `### 📣 ${club.name}｜${event.title}`,
    event.summary ? `> ${event.summary}` : null,
    `- **時間**：${timeText}`,
    `- **地點**：${event.locationText}`,
    `- **費用與認證**：${feeText}${hoursText}`,
    `- **新手指標**：${event.beginnerFriendly ? '零基礎友善' : '需基礎'} ・ ${event.nonMembersWelcome ? '歡迎非社員' : '限社員'}`,
    `👉 **立即報名／加入行事曆**：${eventUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  const igCaption = [
    `${event.title} ✨`,
    `${universityShortName} ${club.name} 誠摯邀請！`,
    event.summary || null,
    `⏰ ${timeText}`,
    `📍 ${event.locationText}`,
    `💰 ${feeText}${hoursText}`,
    '',
    `報名與詳細行前指南請點主頁連結或限動貼紙：${eventUrl}`,
    `#CluBar #${universityShortName} #${club.name.replace(/\s+/g, '')} #大學社團`,
  ]
    .filter((v) => v !== null)
    .join('\n');

  return {
    event_url: eventUrl,
    og_story_image_url: ogStoryImageUrl,
    og_landscape_image_url: ogLandscapeImageUrl,
    line_message: lineMessage,
    discord_markdown: discordMarkdown,
    ig_caption: igCaption,
  };
}
