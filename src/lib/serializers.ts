import type {
  ClubCategory,
  ClubVerificationStatus,
  EventCoverMedia,
  EventScheduleMode,
  EventStatus,
  ExternalLink,
  LearningHoursCategory,
  MediaItem,
  PostKind,
  TogetherItemType,
} from '@/db/schema';

export const FORBIDDEN_PUBLIC_KEYS = new Set([
  'email',
  'campus_email',
  'campusEmail',
  'provider_account_id',
  'providerAccountId',
  'sso_subject_id',
  'ssoSubjectId',
  'asker_user_id',
  'askerUserId',
  'author_user_id',
  'authorUserId',
  'uploader_user_id',
  'uploaderUserId',
  'blob_path',
  'blobPath',
  'student_reach_hash',
  'studentReachHash',
  'like_count',
  'likeCount',
  'bookmark_count',
  'bookmarkCount',
  'follow_count',
  'followCount',
  'view_count',
  'viewCount',
  'helpful_count',
  'helpfulCount',
]);

export interface PublicClubDTO {
  id: string;
  slug: string;
  name: string;
  category: ClubCategory;
  domain_ids: string[];
  tagline: string;
  description: string;
  avatar_url: string | null;
  cover_url: string | null;
  external_links: ExternalLink[];
  verification_status: ClubVerificationStatus;
  is_demo: boolean;
  official_directory_url: string | null;
  pulse_label: string;
  university: {
    id: string;
    code: string;
    name: string;
    short_name: string;
  };
}

export interface DiscoverStreamCardDTO {
  id: string;
  post_kind: PostKind;
  headline: string;
  cover_media: MediaItem | null;
  pulse_label: string;
  published_at: string | null;
  reason?: string;
  contextual_event: {
    short_code: string;
    title: string;
    label: string;
  } | null;
  club: {
    id: string;
    slug: string;
    name: string;
    avatar_url: string | null;
    is_demo: boolean;
    verification_status: ClubVerificationStatus;
    university_id: string;
    university_short_name: string;
  };
}

export interface DiscoverEventCardDTO {
  id: string;
  short_code: string;
  title: string;
  cover_media: EventCoverMedia | null;
  theme_preset: string;
  schedule_mode: EventScheduleMode;
  starts_at: string | null;
  location_text: string;
  beginner_friendly: boolean;
  non_members_welcome: boolean;
  campus_only: boolean;
  fee_ntd: number;
  learning_hours_category: LearningHoursCategory;
  learning_hours_count: number;
  going_count: number;
  reason?: string;
  club: {
    id: string;
    slug: string;
    name: string;
    is_demo: boolean;
    university_id: string;
    university_short_name: string;
  };
  co_host_clubs?: { id: string; slug: string; name: string }[];
}

export interface PublicStreamPostDTO {
  id: string;
  club_id: string;
  post_kind: PostKind;
  headline: string;
  content_md: string;
  media_items: MediaItem[];
  mood_tag: string | null;
  published_at: string | null;
  contextual_event: {
    short_code: string;
    title: string;
    starts_at: string | null;
    location_text: string;
  } | null;
  club: {
    id: string;
    slug: string;
    name: string;
    avatar_url: string | null;
    is_demo: boolean;
    verification_status: ClubVerificationStatus;
    university_short_name: string;
  };
}

export interface PublicClubQuestionDTO {
  id: string;
  display_asker: string;
  question_text: string;
  answer_text: string | null;
  answered_at: string | null;
  is_pinned_faq: boolean;
}

export interface PublicEventDetailDTO {
  id: string;
  short_code: string;
  title: string;
  summary: string;
  description_md: string;
  theme_preset: string;
  cover_media: EventCoverMedia | null;
  schedule_mode: EventScheduleMode;
  starts_at: string | null;
  ends_at: string | null;
  location_text: string;
  share_hide_location: boolean;
  beginner_friendly: boolean;
  non_members_welcome: boolean;
  campus_only: boolean;
  fee_ntd: number;
  fee_note: string | null;
  learning_hours_category: LearningHoursCategory;
  learning_hours_count: number;
  pre_event_notes: string | null;
  capacity: number | null;
  external_registration_url: string | null;
  status: EventStatus;
  ics_sequence: number;
  going_count: number;
  interested_count: number;
  public_attendees: { display_name: string; avatar_url: string | null }[];
  club: {
    id: string;
    slug: string;
    name: string;
    avatar_url: string | null;
    is_demo: boolean;
    university_id: string;
    university_short_name: string;
  };
  co_host_clubs: { id: string; slug: string; name: string; university_short_name: string }[];
}

export interface PublicTogetherItemDTO {
  id: string;
  domain_id: string;
  domain_name: string;
  item_type: TogetherItemType;
  parent_item_id: string | null;
  title: string;
  content_md: string;
  media_items: MediaItem[];
  embed_url: string | null;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  club: {
    id: string;
    slug: string;
    name: string;
    is_demo: boolean;
    university_short_name: string;
  };
}

export function serializePublicClub(row: {
  id: string;
  slug: string;
  name: string;
  category: ClubCategory;
  domainIds: string[];
  tagline: string;
  description: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  externalLinks: ExternalLink[];
  verificationStatus: ClubVerificationStatus;
  isDemo: boolean;
  officialDirectoryUrl: string | null;
  pulseLabel: string;
  university: { id: string; code: string; name: string; shortName: string };
}): PublicClubDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    domain_ids: row.domainIds ?? [],
    tagline: row.tagline,
    description: row.description,
    avatar_url: row.avatarUrl,
    cover_url: row.coverUrl,
    external_links: row.externalLinks ?? [],
    verification_status: row.verificationStatus,
    is_demo: row.isDemo,
    official_directory_url: row.officialDirectoryUrl,
    pulse_label: row.pulseLabel,
    university: {
      id: row.university.id,
      code: row.university.code,
      name: row.university.name,
      short_name: row.university.shortName,
    },
  };
}

export function serializeDiscoverStreamCard(row: {
  id: string;
  postKind: PostKind;
  headline: string;
  mediaItems: MediaItem[];
  pulseLabel: string;
  publishedAt: Date | null;
  reason?: string;
  contextualEvent?: { shortCode: string; title: string; label: string } | null;
  club: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    isDemo: boolean;
    verificationStatus: ClubVerificationStatus;
    universityId: string;
    universityShortName: string;
  };
}): DiscoverStreamCardDTO {
  const shortHeadline =
    row.headline.length > 30 ? `${row.headline.slice(0, 29)}…` : row.headline;
  const dto: DiscoverStreamCardDTO = {
    id: row.id,
    post_kind: row.postKind,
    headline: shortHeadline,
    cover_media: row.mediaItems?.[0] ?? null,
    pulse_label: row.pulseLabel,
    published_at: row.publishedAt ? row.publishedAt.toISOString() : null,
    contextual_event: row.contextualEvent
      ? {
          short_code: row.contextualEvent.shortCode,
          title: row.contextualEvent.title,
          label: row.contextualEvent.label,
        }
      : null,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      avatar_url: row.club.avatarUrl,
      is_demo: row.club.isDemo,
      verification_status: row.club.verificationStatus,
      university_id: row.club.universityId,
      university_short_name: row.club.universityShortName,
    },
  };
  if (row.reason) dto.reason = row.reason;
  return dto;
}

export function serializeDiscoverEventCard(row: {
  id: string;
  shortCode: string;
  title: string;
  coverMedia: EventCoverMedia | null;
  themePreset: string;
  scheduleMode: EventScheduleMode;
  startsAt: Date | null;
  locationText: string;
  beginnerFriendly: boolean;
  nonMembersWelcome: boolean;
  campusOnly: boolean;
  feeNtd: number;
  learningHoursCategory: LearningHoursCategory;
  learningHoursCount: string | number;
  goingCount: number;
  reason?: string;
  club: {
    id: string;
    slug: string;
    name: string;
    isDemo: boolean;
    universityId: string;
    universityShortName: string;
  };
  coHostClubs?: { id: string; slug: string; name: string }[];
}): DiscoverEventCardDTO {
  const dto: DiscoverEventCardDTO = {
    id: row.id,
    short_code: row.shortCode,
    title: row.title,
    cover_media: row.coverMedia ?? null,
    theme_preset: row.themePreset,
    schedule_mode: row.scheduleMode,
    starts_at: row.startsAt ? row.startsAt.toISOString() : null,
    location_text: row.locationText,
    beginner_friendly: row.beginnerFriendly,
    non_members_welcome: row.nonMembersWelcome,
    campus_only: row.campusOnly,
    fee_ntd: row.feeNtd,
    learning_hours_category: row.learningHoursCategory,
    learning_hours_count: Number(row.learningHoursCount ?? 0),
    going_count: row.goingCount,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      is_demo: row.club.isDemo,
      university_id: row.club.universityId,
      university_short_name: row.club.universityShortName,
    },
    co_host_clubs: row.coHostClubs,
  };
  if (row.reason) dto.reason = row.reason;
  return dto;
}

export function serializePublicQuestion(row: {
  id: string;
  isAnonymous: boolean;
  displayAlias: string | null;
  questionText: string;
  answerText: string | null;
  answeredAt: Date | null;
  isPinnedFaq: boolean;
}): PublicClubQuestionDTO {
  return {
    id: row.id,
    display_asker: row.isAnonymous ? '匿名同學' : row.displayAlias?.trim() || '匿名同學',
    question_text: row.questionText,
    answer_text: row.answerText,
    answered_at: row.answeredAt ? row.answeredAt.toISOString() : null,
    is_pinned_faq: row.isPinnedFaq,
  };
}

export function serializePublicStreamPost(row: {
  id: string;
  clubId: string;
  postKind: PostKind;
  headline: string;
  contentMd: string;
  mediaItems: MediaItem[];
  moodTag: string | null;
  publishedAt: Date | null;
  contextualEvent?: {
    shortCode: string;
    title: string;
    startsAt: Date | null;
    locationText: string;
  } | null;
  club: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    isDemo: boolean;
    verificationStatus: ClubVerificationStatus;
    universityShortName: string;
  };
}): PublicStreamPostDTO {
  return {
    id: row.id,
    club_id: row.clubId,
    post_kind: row.postKind,
    headline: row.headline,
    content_md: row.contentMd,
    media_items: row.mediaItems ?? [],
    mood_tag: row.moodTag,
    published_at: row.publishedAt ? row.publishedAt.toISOString() : null,
    contextual_event: row.contextualEvent
      ? {
          short_code: row.contextualEvent.shortCode,
          title: row.contextualEvent.title,
          starts_at: row.contextualEvent.startsAt
            ? row.contextualEvent.startsAt.toISOString()
            : null,
          location_text: row.contextualEvent.locationText,
        }
      : null,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      avatar_url: row.club.avatarUrl,
      is_demo: row.club.isDemo,
      verification_status: row.club.verificationStatus,
      university_short_name: row.club.universityShortName,
    },
  };
}

export function serializePublicTogetherItem(row: {
  id: string;
  domainId: string;
  domainName: string;
  itemType: TogetherItemType;
  parentItemId: string | null;
  title: string;
  contentMd: string;
  mediaItems: MediaItem[];
  embedUrl: string | null;
  replyCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  club: {
    id: string;
    slug: string;
    name: string;
    isDemo: boolean;
    universityShortName: string;
  };
}): PublicTogetherItemDTO {
  return {
    id: row.id,
    domain_id: row.domainId,
    domain_name: row.domainName,
    item_type: row.itemType,
    parent_item_id: row.parentItemId,
    title: row.title,
    content_md: row.contentMd,
    media_items: row.mediaItems ?? [],
    embed_url: row.embedUrl,
    reply_count: row.replyCount,
    last_activity_at: row.lastActivityAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      is_demo: row.club.isDemo,
      university_short_name: row.club.universityShortName,
    },
  };
}


export function clampedAspectRatio(width?: number, height?: number): string {
  if (!width || !height || width <= 0 || height <= 0) return '4 / 5';
  const ratio = Math.min(1.91, Math.max(0.56, width / height));
  return `${ratio.toFixed(3)} / 1`;
}
