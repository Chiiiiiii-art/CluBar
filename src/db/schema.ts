import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export interface ExternalLink {
  type?: 'ig' | 'fb' | 'dc' | 'line' | 'email' | 'website' | 'form' | 'other';
  label: string;
  url: string;
}

export interface MediaItem {
  kind?: 'image' | 'video';
  url: string;
  poster_url?: string;
  alt?: string;
  width?: number;
  height?: number;
  duration_sec?: number;
}

export interface EventCoverMedia {
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface HandoverPitfallNote {
  venue_tips: string;
  hours_and_deadlines: string;
  contacts_and_vendors: string;
}

// ── 27 PostgreSQL Enums (SRS v2.0 §5.2.1) ─────────────────────────────────────

export const clubCategoryEnum = pgEnum('club_category', [
  'academic',
  'arts',
  'recreation',
  'sports',
  'service',
  'social',
]);

export const platformRoleEnum = pgEnum('platform_role', [
  'user',
  'school_admin',
  'platform_admin',
]);

export const clubVerificationStatusEnum = pgEnum('club_verification_status', [
  'unclaimed_directory',
  'pending_review',
  'verified',
  'suspended',
]);

export const clubMemberRoleEnum = pgEnum('club_member_role', [
  'owner',
  'editor',
  'member',
  'alumni',
]);

export const memberRequestStatusEnum = pgEnum('member_request_status', [
  'pending',
  'approved',
  'rejected',
]);

export const handoverStatusEnum = pgEnum('handover_status', [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'expired',
]);

export const postKindEnum = pgEnum('post_kind', [
  'nrc_moment',
  'wip_work',
  'album_highlight',
  'qa_highlight',
]);

export const postStatusEnum = pgEnum('post_status', [
  'draft',
  'published',
  'hidden_by_owner',
  'removed_by_admin',
]);

export const eventScheduleModeEnum = pgEnum('event_schedule_mode', [
  'scheduled',
  'tbd',
  'voting',
]);

export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'open',
  'completed',
  'cancelled',
]);

export const learningHoursCategoryEnum = pgEnum('learning_hours_category', [
  'none',
  'art',
  'life',
  'service',
]);

export const rsvpStatusEnum = pgEnum('rsvp_status', [
  'going',
  'interested',
  'cancelled',
]);

export const rsvpPrivacyModeEnum = pgEnum('rsvp_privacy_mode', [
  'public_to_attendees',
  'private_count_only',
]);

export const albumPhotoStatusEnum = pgEnum('album_photo_status', [
  'pending_review',
  'approved_album',
  'featured_stream',
  'rejected',
]);

export const clubQuestionStatusEnum = pgEnum('club_question_status', [
  'pending_reply',
  'answered_private',
  'published',
  'hidden',
]);

export const coClubTargetTypeEnum = pgEnum('co_club_target_type', [
  'event',
  'post',
]);

export const coClubStatusEnum = pgEnum('co_club_status', [
  'pending',
  'accepted',
  'rejected',
]);

export const archiveFileCategoryEnum = pgEnum('archive_file_category', [
  'meeting_minutes',
  'finance_ledger',
  'equipment_inventory',
  'evaluation_evidence',
  'other',
]);

export const togetherItemTypeEnum = pgEnum('together_item_type', [
  'showcase',
  'rebound',
  'field_log',
  'match_invite',
  'reading_notes',
]);

export const togetherStatusEnum = pgEnum('together_status', [
  'published',
  'hidden_by_author',
  'removed_by_admin',
]);

export const followModeEnum = pgEnum('follow_mode', ['all', 'events_only']);

export const portfolioVisibilityEnum = pgEnum('portfolio_visibility', [
  'private',
  'campus_only',
  'public',
]);

export const bookmarkTargetTypeEnum = pgEnum('bookmark_target_type', [
  'post',
  'event',
]);

export const applicationTypeEnum = pgEnum('application_type', [
  'directory_claim',
  'new_club',
  'owner_takeover',
]);

export const applicationStatusEnum = pgEnum('application_status', [
  'pending',
  'approved',
  'rejected',
]);

export const reportTargetTypeEnum = pgEnum('report_target_type', [
  'post',
  'event',
  'event_comment',
  'album_photo',
  'club_question',
  'together_item',
  'club',
]);

export const reportReasonEnum = pgEnum('report_reason', [
  'impersonation',
  'copyright',
  'privacy_leak',
  'portrait_violation',
  'inappropriate',
  'other',
]);

export const reportStatusEnum = pgEnum('report_status', [
  'open',
  'resolved_takedown',
  'resolved_keep',
  'resolved_suspend_club',
]);

export const analyticsEventTypeEnum = pgEnum('analytics_event_type', [
  'onboarding_complete',
  'blend_create',
  'blend_join',
  'discover_stream_click',
  'discover_event_click',
  'discover_query_submit',
  'club_page_view',
  'event_rsvp_going',
  'event_promo_copy',
  'album_upload',
  'nrc_publish',
  'together_item_click',
  'official_link_click',
  'club_follow',
  'bookmark_add',
]);

// ── 1. 學校、興趣領域、使用者、Onboarding 與 Blend ─────────────────────────

export const universities = pgTable('universities', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  emailDomains: text('email_domains').array().notNull(),
  ssoConfig: jsonb('sso_config').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const interestDomains = pgTable('interest_domains', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  nameZh: text('name_zh').notNull(),
  sortOrder: smallint('sort_order').notNull().default(0),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    handle: text('handle').unique(),
    avatarUrl: text('avatar_url'),
    platformRole: platformRoleEnum('platform_role').notNull().default('user'),
    campusEmail: text('campus_email').unique(),
    universityId: uuid('university_id').references(() => universities.id),
    campusVerifiedAt: timestamp('campus_verified_at', { withTimezone: true }),
    ssoSubjectId: text('sso_subject_id'),
    managedUniversityId: uuid('managed_university_id').references(() => universities.id),
    portfolioVisibility: portfolioVisibilityEnum('portfolio_visibility')
      .notNull()
      .default('campus_only'),
    talentDiscoveryOptIn: boolean('talent_discovery_opt_in').notNull().default(false),
    alumniPingEnabled: boolean('alumni_ping_enabled').notNull().default(false),
    alumniExpertiseTags: text('alumni_expertise_tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    calendarTokenVersion: smallint('calendar_token_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('chk_users_alumni_tags_max3', sql`cardinality(${t.alumniExpertiseTags}) <= 3`)]
);

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('oauth_accounts_provider_account_unique').on(t.provider, t.providerAccountId),
    index('idx_oauth_accounts_user').on(t.userId),
  ]
);

export const campusEmailOtps = pgTable(
  'campus_email_otps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    campusEmail: text('campus_email').notNull(),
    universityId: uuid('university_id')
      .notNull()
      .references(() => universities.id),
    otpHash: text('otp_hash').notNull(),
    attempts: smallint('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_otp_user_active')
      .on(t.userId, t.createdAt)
      .where(sql`${t.consumedAt} IS NULL`),
  ]
);

export const userOnboardingProfiles = pgTable('user_onboarding_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  selectedUniversityId: uuid('selected_university_id').references(() => universities.id),
  goals: text('goals').array().notNull().default(sql`'{}'::text[]`),
  domainIds: uuid('domain_ids').array().notNull().default(sql`'{}'::uuid[]`),
  vibe: text('vibe'),
  personaArchetype: text('persona_archetype'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const blendSessions = pgTable(
  'blend_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shortCode: text('short_code').notNull().unique(),
    creatorUserId: uuid('creator_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    partnerUserId: uuid('partner_user_id').references(() => users.id, { onDelete: 'set null' }),
    universityId: uuid('university_id')
      .notNull()
      .references(() => universities.id),
    sharedDomainIds: uuid('shared_domain_ids').array().notNull().default(sql`'{}'::uuid[]`),
    matchScore: smallint('match_score'),
    recommendedClubIds: uuid('recommended_club_ids').array().notNull().default(sql`'{}'::uuid[]`),
    recommendedEventIds: uuid('recommended_event_ids').array().notNull().default(sql`'{}'::uuid[]`),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`(now() + INTERVAL '30 days')`),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_blend_distinct_partner',
      sql`${t.partnerUserId} IS NULL OR ${t.partnerUserId} <> ${t.creatorUserId}`
    ),
  ]
);

// ── 2. 社團、認證社員雙軌制、預填 FAQ 與問答箱 ──────────────────────────────

export const clubs = pgTable(
  'clubs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    universityId: uuid('university_id')
      .notNull()
      .references(() => universities.id),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    category: clubCategoryEnum('category').notNull(),
    domainIds: uuid('domain_ids').array().notNull().default(sql`'{}'::uuid[]`),
    tagline: text('tagline').notNull().default(''),
    description: text('description').notNull().default(''),
    avatarUrl: text('avatar_url'),
    coverUrl: text('cover_url'),
    externalLinks: jsonb('external_links').$type<ExternalLink[]>().notNull().default([]),
    verificationStatus: clubVerificationStatusEnum('verification_status')
      .notNull()
      .default('pending_review'),
    isDemo: boolean('is_demo').notNull().default(false),
    officialDirectoryUrl: text('official_directory_url'),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    lastHandoverAt: timestamp('last_handover_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('clubs_university_name_unique').on(t.universityId, t.name),
    index('idx_clubs_univ_status').on(t.universityId, t.verificationStatus),
    index('idx_clubs_domains_gin').using('gin', t.domainIds),
  ]
);

export const clubMemberships = pgTable(
  'club_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: clubMemberRoleEnum('role').notNull(),
    title: text('title'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('uq_club_single_active_owner')
      .on(t.clubId)
      .where(sql`${t.role} = 'owner' AND ${t.endedAt} IS NULL`),
    uniqueIndex('uq_club_active_member')
      .on(t.clubId, t.userId)
      .where(sql`${t.endedAt} IS NULL`),
  ]
);

export const clubInviteCodes = pgTable(
  'club_invite_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    maxUses: integer('max_uses'),
    usedCount: integer('used_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_invite_codes_club_active')
      .on(t.clubId)
      .where(sql`${t.revokedAt} IS NULL`),
  ]
);

export const clubMemberRequests = pgTable(
  'club_member_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note'),
    status: memberRequestStatusEnum('status').notNull().default('pending'),
    reviewerId: uuid('reviewer_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_club_member_req_pending')
      .on(t.clubId, t.userId)
      .where(sql`${t.status} = 'pending'`),
  ]
);

export const clubQuestions = pgTable(
  'club_questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    askerUserId: uuid('asker_user_id').references(() => users.id, { onDelete: 'set null' }),
    isAnonymous: boolean('is_anonymous').notNull().default(true),
    displayAlias: text('display_alias'),
    questionText: text('question_text').notNull(),
    answerText: text('answer_text'),
    answeredBy: uuid('answered_by').references(() => users.id),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    status: clubQuestionStatusEnum('status').notNull().default('pending_reply'),
    isPinnedFaq: boolean('is_pinned_faq').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_club_questions_public')
      .on(t.clubId, t.isPinnedFaq, t.answeredAt)
      .where(sql`${t.status} = 'published'`),
  ]
);

// ── 3. Partiful 式活動引擎、喬時間、兩段隱私報名、留言與無損相簿池 ─────────

export const clubEvents = pgTable(
  'club_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'restrict' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    shortCode: text('short_code').notNull().unique(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    descriptionMd: text('description_md').notNull().default(''),
    themePreset: text('theme_preset').notNull().default('warm_paper'),
    coverMedia: jsonb('cover_media').$type<EventCoverMedia | null>(),
    scheduleMode: eventScheduleModeEnum('schedule_mode').notNull().default('scheduled'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    locationText: text('location_text').notNull().default('TBD 待定'),
    beginnerFriendly: boolean('beginner_friendly').notNull().default(true),
    nonMembersWelcome: boolean('non_members_welcome').notNull().default(true),
    campusOnly: boolean('campus_only').notNull().default(false),
    feeNtd: integer('fee_ntd').notNull().default(0),
    feeNote: text('fee_note'),
    learningHoursCategory: learningHoursCategoryEnum('learning_hours_category')
      .notNull()
      .default('none'),
    learningHoursCount: numeric('learning_hours_count', { precision: 4, scale: 1 })
      .notNull()
      .default('0'),
    preEventNotes: text('pre_event_notes'),
    capacity: integer('capacity'),
    externalRegistrationUrl: text('external_registration_url'),
    domainIds: uuid('domain_ids').array().notNull().default(sql`'{}'::uuid[]`),
    status: eventStatusEnum('status').notNull().default('open'),
    icsSequence: integer('ics_sequence').notNull().default(0),
    includeInEvaluation: boolean('include_in_evaluation').notNull().default(true),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_events_discover')
      .on(t.status, t.startsAt)
      .where(sql`${t.status} = 'open'`),
    index('idx_events_club').on(t.clubId, t.createdAt),
    check('chk_events_fee_non_negative', sql`${t.feeNtd} >= 0`),
    check('chk_events_hours_non_negative', sql`${t.learningHoursCount} >= 0`),
    check('chk_events_capacity_positive', sql`${t.capacity} IS NULL OR ${t.capacity} > 0`),
    check(
      'chk_events_scheduled_has_start',
      sql`${t.scheduleMode} <> 'scheduled' OR ${t.startsAt} IS NOT NULL`
    ),
  ]
);

export const eventPollOptions = pgTable(
  'event_poll_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => clubEvents.id, { onDelete: 'cascade' }),
    optionType: text('option_type').notNull(),
    label: text('label').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isSelected: boolean('is_selected').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('chk_poll_option_type', sql`${t.optionType} IN ('time_slot', 'topic')`)]
);

export const eventPollVotes = pgTable(
  'event_poll_votes',
  {
    optionId: uuid('option_id')
      .notNull()
      .references(() => eventPollOptions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.optionId, t.userId] })]
);

export const eventRsvps = pgTable(
  'event_rsvps',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => clubEvents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: rsvpStatusEnum('status').notNull().default('going'),
    privacyMode: rsvpPrivacyModeEnum('privacy_mode').notNull().default('public_to_attendees'),
    displayAlias: text('display_alias'),
    attended: boolean('attended').notNull().default(false),
    attendedAt: timestamp('attended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.userId] }),
    index('idx_rsvps_user').on(t.userId, t.status),
  ]
);

export const eventComments = pgTable(
  'event_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => clubEvents.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isDeleted: boolean('is_deleted').notNull().default(false),
    deletedBy: uuid('deleted_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_event_comments_active')
      .on(t.eventId, t.createdAt)
      .where(sql`${t.isDeleted} = false`),
  ]
);

export const eventAlbumPhotos = pgTable(
  'event_album_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => clubEvents.id, { onDelete: 'cascade' }),
    uploaderUserId: uuid('uploader_user_id')
      .notNull()
      .references(() => users.id),
    originalUrl: text('original_url').notNull(),
    previewUrl: text('preview_url').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    caption: text('caption'),
    status: albumPhotoStatusEnum('status').notNull().default('pending_review'),
    consentConfirmed: boolean('consent_confirmed').notNull().default(false),
    curatedBy: uuid('curated_by').references(() => users.id),
    includeInEvaluation: boolean('include_in_evaluation').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_album_event_status').on(t.eventId, t.status, t.createdAt),
    check('chk_album_dimensions_positive', sql`${t.width} > 0 AND ${t.height} > 0`),
    check(
      'chk_album_featured_consent',
      sql`${t.status} <> 'featured_stream' OR ${t.consentConfirmed} = true`
    ),
  ]
);

// ── 4. 探索現場流內容（NRC／WIP／精選相簿／QA 精華）與 Co-Club 共辦 ─────────

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'restrict' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    postKind: postKindEnum('post_kind').notNull(),
    headline: text('headline').notNull(),
    contentMd: text('content_md').notNull().default(''),
    mediaItems: jsonb('media_items').$type<MediaItem[]>().notNull().default([]),
    relatedEventId: uuid('related_event_id').references(() => clubEvents.id, {
      onDelete: 'set null',
    }),
    sourceAlbumPhotoId: uuid('source_album_photo_id').references(() => eventAlbumPhotos.id, {
      onDelete: 'set null',
    }),
    sourceQuestionId: uuid('source_question_id').references(() => clubQuestions.id, {
      onDelete: 'set null',
    }),
    moodTag: text('mood_tag'),
    domainIds: uuid('domain_ids').array().notNull().default(sql`'{}'::uuid[]`),
    originalityConfirmed: boolean('originality_confirmed').notNull().default(false),
    includeInEvaluation: boolean('include_in_evaluation').notNull().default(false),
    status: postStatusEnum('status').notNull().default('draft'),
    embedding: vector('embedding', { dimensions: 1536 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_posts_stream_recent')
      .on(t.publishedAt)
      .where(sql`${t.status} = 'published'`),
    index('idx_posts_club_eval').on(t.clubId, t.includeInEvaluation, t.publishedAt),
    check(
      'chk_posts_originality_published',
      sql`${t.status} <> 'published' OR ${t.originalityConfirmed} = true`
    ),
  ]
);

export const coClubLinks = pgTable(
  'co_club_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    targetType: coClubTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    hostClubId: uuid('host_club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    partnerClubId: uuid('partner_club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    status: coClubStatusEnum('status').notNull().default('pending'),
    partnerIncludeEval: boolean('partner_include_eval').notNull().default(true),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    respondedBy: uuid('responded_by').references(() => users.id),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_coclub_distinct_clubs', sql`${t.hostClubId} <> ${t.partnerClubId}`),
    unique('uq_coclub_target_partner').on(t.targetType, t.targetId, t.partnerClubId),
  ]
);

// ── 5. 私密評鑑歸檔層、3 步換屆與行政避雷便條 ─────────────────────────────

export const clubArchiveFiles = pgTable(
  'club_archive_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'restrict' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    archiveCategory: archiveFileCategoryEnum('archive_category').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    blobPath: text('blob_path').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    occurredOn: date('occurred_on').notNull(),
    retentionUntil: timestamp('retention_until', { withTimezone: true })
      .notNull()
      .default(sql`(now() + INTERVAL '6 years')`),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_archive_club_date').on(t.clubId, t.occurredOn)]
);

export const clubHandovers = pgTable(
  'club_handovers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id),
    toUserId: uuid('to_user_id')
      .notNull()
      .references(() => users.id),
    status: handoverStatusEnum('status').notNull().default('pending'),
    pendingNoteJson: jsonb('pending_note_json').$type<HandoverPitfallNote | null>(),
    shareDeidentified: boolean('share_deidentified').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`(now() + INTERVAL '7 days')`),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_club_pending_handover')
      .on(t.clubId)
      .where(sql`${t.status} = 'pending'`),
    check('chk_handover_distinct_users', sql`${t.fromUserId} <> ${t.toUserId}`),
  ]
);

export const clubHandoverNotes = pgTable('club_handover_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  clubId: uuid('club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  handoverId: uuid('handover_id').references(() => clubHandovers.id, { onDelete: 'set null' }),
  authorUserId: uuid('author_user_id')
    .notNull()
    .references(() => users.id),
  venueTips: text('venue_tips').notNull().default(''),
  hoursAndDeadlines: text('hours_and_deadlines').notNull().default(''),
  contactsAndVendors: text('contacts_and_vendors').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── 6. 一起聚（跨校舞台）、個人訂閱、Web Push、治理與匿名統計 ────────────

export const togetherItems = pgTable(
  'together_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => interestDomains.id),
    itemType: togetherItemTypeEnum('item_type').notNull(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'restrict' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    parentItemId: uuid('parent_item_id'),
    title: text('title').notNull(),
    contentMd: text('content_md').notNull(),
    mediaItems: jsonb('media_items').$type<MediaItem[]>().notNull().default([]),
    embedUrl: text('embed_url'),
    status: togetherStatusEnum('status').notNull().default('published'),
    replyCount: integer('reply_count').notNull().default(0),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_together_domain_activity')
      .on(t.domainId, t.lastActivityAt)
      .where(sql`${t.status} = 'published'`),
  ]
);

export const togetherReplies = pgTable('together_replies', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => togetherItems.id, { onDelete: 'cascade' }),
  clubId: uuid('club_id')
    .notNull()
    .references(() => clubs.id),
  authorUserId: uuid('author_user_id')
    .notNull()
    .references(() => users.id),
  contentMd: text('content_md').notNull(),
  status: togetherStatusEnum('status').notNull().default('published'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const togetherJams = pgTable(
  'together_jams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hostClubId: uuid('host_club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => interestDomains.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    targetSchoolsCount: smallint('target_schools_count').notNull().default(2),
    neededRoles: text('needed_roles').array().notNull().default(sql`'{}'::text[]`),
    collabFormat: text('collab_format').notNull(),
    deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_jam_target_schools', sql`${t.targetSchoolsCount} >= 2`),
    check('chk_jam_status', sql`${t.status} IN ('open', 'closed', 'removed_by_admin')`),
  ]
);

export const alumniPings = pgTable(
  'alumni_pings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fromUserId: uuid('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toAlumniId: uuid('to_alumni_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => interestDomains.id),
    expertiseTag: text('expertise_tag').notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('chk_alumni_ping_distinct', sql`${t.fromUserId} <> ${t.toAlumniId}`)]
);

export const practicalResources = pgTable(
  'practical_resources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    domainId: uuid('domain_id')
      .notNull()
      .references(() => interestDomains.id),
    sourceUniversityId: uuid('source_university_id').references(() => universities.id),
    title: text('title').notNull(),
    contentMd: text('content_md').notNull(),
    status: text('status').notNull().default('published'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('chk_resource_status', sql`${t.status} IN ('published', 'removed_by_admin')`)]
);

export const userBookmarks = pgTable(
  'user_bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: bookmarkTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })]
);

export const userFollows = pgTable(
  'user_follows',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    followMode: followModeEnum('follow_mode').notNull().default('all'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clubId] })]
);

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clubApplications = pgTable(
  'club_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: applicationTypeEnum('type').notNull(),
    applicantUserId: uuid('applicant_user_id')
      .notNull()
      .references(() => users.id),
    targetClubId: uuid('target_club_id').references(() => clubs.id),
    proposedUniversityId: uuid('proposed_university_id').references(() => universities.id),
    proposedName: text('proposed_name'),
    proposedSlug: text('proposed_slug'),
    proposedCategory: clubCategoryEnum('proposed_category'),
    evidenceText: text('evidence_text').notNull(),
    evidenceUrls: jsonb('evidence_urls').$type<string[]>().notNull().default([]),
    status: applicationStatusEnum('status').notNull().default('pending'),
    reviewerUserId: uuid('reviewer_user_id').references(() => users.id),
    reviewNote: text('review_note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_applications_status').on(t.status, t.createdAt),
    uniqueIndex('uq_pending_club_application')
      .on(t.applicantUserId, t.targetClubId)
      .where(sql`${t.status} = 'pending' AND ${t.targetClubId} IS NOT NULL`),
    uniqueIndex('uq_pending_new_club_slug')
      .on(t.proposedSlug)
      .where(sql`${t.status} = 'pending' AND ${t.proposedSlug} IS NOT NULL`),
  ]
);

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterUserId: uuid('reporter_user_id')
      .notNull()
      .references(() => users.id),
    targetType: reportTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    detail: text('detail'),
    status: reportStatusEnum('status').notNull().default('open'),
    handlerUserId: uuid('handler_user_id').references(() => users.id),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_reports_status').on(t.status, t.createdAt)]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    linkUrl: text('link_url'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_notifications_user_unread')
      .on(t.userId, t.createdAt)
      .where(sql`${t.readAt} IS NULL`),
  ]
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_audit_target').on(t.targetType, t.targetId, t.createdAt)]
);

export const evaluationSubmissions = pgTable(
  'evaluation_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'restrict' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    status: text('status').notNull().default('draft'),
    submittedBy: uuid('submitted_by').references(() => users.id),
    reviewerUserId: uuid('reviewer_user_id').references(() => users.id),
    reviewComment: text('review_comment'),
    retentionUntil: timestamp('retention_until', { withTimezone: true })
      .notNull()
      .default(sql`(now() + INTERVAL '6 years')`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_eval_submission_status',
      sql`${t.status} IN ('draft', 'submitted', 'under_review', 'approved', 'revision_requested')`
    ),
  ]
);

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    eventType: analyticsEventTypeEnum('event_type').notNull(),
    universityId: uuid('university_id').references(() => universities.id),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    targetId: uuid('target_id'),
    sourceSurface: text('source_surface'),
    studentReachHash: text('student_reach_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_analytics_type_time').on(t.eventType, t.createdAt)]
);

// ── Exported Types ─────────────────────────────────────────────────────────────

export type ClubCategory = (typeof clubCategoryEnum.enumValues)[number];
export type PlatformRole = (typeof platformRoleEnum.enumValues)[number];
export type ClubVerificationStatus = (typeof clubVerificationStatusEnum.enumValues)[number];
export type ClubMemberRole = (typeof clubMemberRoleEnum.enumValues)[number];
export type MemberRequestStatus = (typeof memberRequestStatusEnum.enumValues)[number];
export type HandoverStatus = (typeof handoverStatusEnum.enumValues)[number];
export type PostKind = (typeof postKindEnum.enumValues)[number];
export type PostStatus = (typeof postStatusEnum.enumValues)[number];
export type EventScheduleMode = (typeof eventScheduleModeEnum.enumValues)[number];
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];
export type LearningHoursCategory = (typeof learningHoursCategoryEnum.enumValues)[number];
export type RsvpStatus = (typeof rsvpStatusEnum.enumValues)[number];
export type RsvpPrivacyMode = (typeof rsvpPrivacyModeEnum.enumValues)[number];
export type AlbumPhotoStatus = (typeof albumPhotoStatusEnum.enumValues)[number];
export type ClubQuestionStatus = (typeof clubQuestionStatusEnum.enumValues)[number];
export type CoClubTargetType = (typeof coClubTargetTypeEnum.enumValues)[number];
export type CoClubStatus = (typeof coClubStatusEnum.enumValues)[number];
export type ArchiveFileCategory = (typeof archiveFileCategoryEnum.enumValues)[number];
export type TogetherItemType = (typeof togetherItemTypeEnum.enumValues)[number];
export type TogetherStatus = (typeof togetherStatusEnum.enumValues)[number];
export type FollowMode = (typeof followModeEnum.enumValues)[number];
export type PortfolioVisibility = (typeof portfolioVisibilityEnum.enumValues)[number];
export type BookmarkTargetType = (typeof bookmarkTargetTypeEnum.enumValues)[number];
export type ApplicationType = (typeof applicationTypeEnum.enumValues)[number];
export type ApplicationStatus = (typeof applicationStatusEnum.enumValues)[number];
export type ReportTargetType = (typeof reportTargetTypeEnum.enumValues)[number];
export type ReportReason = (typeof reportReasonEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type AnalyticsEventType = (typeof analyticsEventTypeEnum.enumValues)[number];
