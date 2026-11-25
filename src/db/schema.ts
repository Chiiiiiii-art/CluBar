import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
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
  type?: 'ig' | 'fb' | 'email' | 'website' | 'form' | 'other';
  label: string;
  url: string;
}

export interface MediaItem {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

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
  'platform_admin',
  'school_admin',
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
  'alumni',
]);

export const handoverStatusEnum = pgEnum('handover_status', [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'expired',
]);

export const postTypeEnum = pgEnum('post_type', [
  'work',
  'event',
  'workshop',
  'competition',
]);

export const postStatusEnum = pgEnum('post_status', [
  'draft',
  'published',
  'hidden_by_owner',
  'removed_by_admin',
]);

export const forumTagEnum = pgEnum('forum_tag', [
  'event_exp',
  'equipment',
  'venue',
  'management',
  'collab',
]);

export const forumStatusEnum = pgEnum('forum_status', [
  'published',
  'removed_by_admin',
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
  'club',
  'forum_thread',
  'forum_reply',
]);

export const reportReasonEnum = pgEnum('report_reason', [
  'impersonation',
  'copyright',
  'privacy_leak',
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
  'discover_card_click',
  'club_page_view',
  'official_link_click',
  'opportunity_link_click',
  'club_follow',
  'post_bookmark',
  'discover_query_submit',
]);

export const universities = pgTable('universities', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  emailDomains: text('email_domains').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  platformRole: platformRoleEnum('platform_role').notNull().default('user'),
  campusEmail: text('campus_email').unique(),
  universityId: uuid('university_id').references(() => universities.id),
  campusVerifiedAt: timestamp('campus_verified_at', { withTimezone: true }),
  managedUniversityId: uuid('managed_university_id').references(() => universities.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('clubs_university_name_unique').on(t.universityId, t.name),
    index('idx_clubs_category_status').on(t.category, t.verificationStatus),
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
    note: text('note'),
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

export const clubOpportunities = pgTable(
  'club_opportunities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    scheduleText: text('schedule_text'),
    deadlineAt: timestamp('deadline_at', { withTimezone: true }),
    externalUrl: text('external_url').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_opportunities_club_active').on(t.clubId, t.isActive, t.deadlineAt)]
);

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
    academicYear: smallint('academic_year').notNull(),
    postType: postTypeEnum('post_type').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    contentMd: text('content_md').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    mediaUrls: jsonb('media_urls').$type<MediaItem[]>().notNull().default([]),
    externalLinks: jsonb('external_links').$type<ExternalLink[]>().notNull().default([]),
    collaborators: text('collaborators'),
    originalityConfirmed: boolean('originality_confirmed').notNull().default(false),
    status: postStatusEnum('status').notNull().default('draft'),
    embedding: vector('embedding', { dimensions: 1536 }),
    embeddingUpdatedAt: timestamp('embedding_updated_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_posts_club_year_status').on(t.clubId, t.academicYear, t.publishedAt),
    index('idx_posts_published_recent')
      .on(t.publishedAt)
      .where(sql`${t.status} = 'published'`),
    check(
      'chk_posts_originality_published',
      sql`${t.status} <> 'published' OR ${t.originalityConfirmed} = true`
    ),
  ]
);

export const userBookmarks = pgTable(
  'user_bookmarks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })]
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clubId] })]
);

export const forumThreads = pgTable(
  'forum_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    category: clubCategoryEnum('category').notNull(),
    discussionTag: forumTagEnum('discussion_tag').notNull(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    authorTitle: text('author_title'),
    title: text('title').notNull(),
    contentMd: text('content_md').notNull(),
    mediaUrls: jsonb('media_urls').$type<MediaItem[]>().notNull().default([]),
    externalUrl: text('external_url'),
    status: forumStatusEnum('status').notNull().default('published'),
    replyCount: integer('reply_count').notNull().default(0),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_forum_threads_cat_activity')
      .on(t.category, t.lastActivityAt)
      .where(sql`${t.status} = 'published'`),
  ]
);

export const forumReplies = pgTable(
  'forum_replies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    authorTitle: text('author_title'),
    contentMd: text('content_md').notNull(),
    status: forumStatusEnum('status').notNull().default('published'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_forum_replies_thread')
      .on(t.threadId, t.createdAt)
      .where(sql`${t.status} = 'published'`),
  ]
);

export const forumHelpfulMarks = pgTable(
  'forum_helpful_marks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    replyId: uuid('reply_id')
      .notNull()
      .references(() => forumReplies.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.replyId] })]
);

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

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    eventType: analyticsEventTypeEnum('event_type').notNull(),
    universityId: uuid('university_id').references(() => universities.id),
    clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
    category: clubCategoryEnum('category'),
    sourceSurface: text('source_surface'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_analytics_type_time').on(t.eventType, t.createdAt)]
);

export type ClubCategory = (typeof clubCategoryEnum.enumValues)[number];
export type PlatformRole = (typeof platformRoleEnum.enumValues)[number];
export type ClubVerificationStatus = (typeof clubVerificationStatusEnum.enumValues)[number];
export type ClubMemberRole = (typeof clubMemberRoleEnum.enumValues)[number];
export type HandoverStatus = (typeof handoverStatusEnum.enumValues)[number];
export type PostType = (typeof postTypeEnum.enumValues)[number];
export type PostStatus = (typeof postStatusEnum.enumValues)[number];
export type ForumTag = (typeof forumTagEnum.enumValues)[number];
export type ApplicationType = (typeof applicationTypeEnum.enumValues)[number];
export type ReportTargetType = (typeof reportTargetTypeEnum.enumValues)[number];
export type ReportReason = (typeof reportReasonEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type AnalyticsEventType = (typeof analyticsEventTypeEnum.enumValues)[number];

