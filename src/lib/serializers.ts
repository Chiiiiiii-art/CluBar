import type {
  ClubCategory,
  ClubVerificationStatus,
  ExternalLink,
  ForumTag,
  MediaItem,
  PostType,
} from '@/db/schema';

export const FORBIDDEN_PUBLIC_KEYS = new Set([
  'email',
  'campus_email',
  'campusEmail',
  'provider_account_id',
  'providerAccountId',
  'author_user_id',
  'authorUserId',
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
  tagline: string;
  description: string;
  avatar_url: string | null;
  cover_url: string | null;
  external_links: ExternalLink[];
  verification_status: ClubVerificationStatus;
  is_demo: boolean;
  official_directory_url: string | null;
  university: {
    id: string;
    code: string;
    name: string;
    short_name: string;
  };
}

export interface PublicOpportunityDTO {
  id: string;
  club_id: string;
  title: string;
  summary: string;
  schedule_text: string | null;
  deadline_at: string | null;
  external_url: string;
}

export interface PublicPostDTO {
  id: string;
  club_id: string;
  academic_year: number;
  post_type: PostType;
  title: string;
  summary: string;
  content_md: string;
  tags: string[];
  media_urls: MediaItem[];
  external_links: ExternalLink[];
  collaborators: string | null;
  published_at: string | null;
  club: {
    id: string;
    slug: string;
    name: string;
    category: ClubCategory;
    avatar_url: string | null;
    verification_status: ClubVerificationStatus;
    is_demo: boolean;
    university_short_name: string;
  };
}

export interface DiscoverCardDTO {
  post_id: string;
  title: string;
  summary: string;
  post_type: PostType;
  academic_year: number;
  tags: string[];
  cover_image: MediaItem | null;
  published_at: string | null;
  reason?: string;
  club: {
    id: string;
    slug: string;
    name: string;
    category: ClubCategory;
    avatar_url: string | null;
    is_demo: boolean;
    verification_status: ClubVerificationStatus;
    university_id: string;
    university_short_name: string;
  };
}

export interface PublicForumThreadDTO {
  id: string;
  category: ClubCategory;
  discussion_tag: ForumTag;
  author_title: string | null;
  title: string;
  content_md: string;
  media_urls: MediaItem[];
  external_url: string | null;
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

export interface PublicForumReplyDTO {
  id: string;
  thread_id: string;
  author_title: string | null;
  content_md: string;
  created_at: string;
  marked_helpful_by_me: boolean;
  has_helpful_marks: boolean;
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
  tagline: string;
  description: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  externalLinks: ExternalLink[];
  verificationStatus: ClubVerificationStatus;
  isDemo: boolean;
  officialDirectoryUrl: string | null;
  university: { id: string; code: string; name: string; shortName: string };
}): PublicClubDTO {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    tagline: row.tagline,
    description: row.description,
    avatar_url: row.avatarUrl,
    cover_url: row.coverUrl,
    external_links: row.externalLinks ?? [],
    verification_status: row.verificationStatus,
    is_demo: row.isDemo,
    official_directory_url: row.officialDirectoryUrl,
    university: {
      id: row.university.id,
      code: row.university.code,
      name: row.university.name,
      short_name: row.university.shortName,
    },
  };
}

export function serializePublicOpportunity(row: {
  id: string;
  clubId: string;
  title: string;
  summary: string;
  scheduleText: string | null;
  deadlineAt: Date | null;
  externalUrl: string;
}): PublicOpportunityDTO {
  return {
    id: row.id,
    club_id: row.clubId,
    title: row.title,
    summary: row.summary,
    schedule_text: row.scheduleText,
    deadline_at: row.deadlineAt ? row.deadlineAt.toISOString() : null,
    external_url: row.externalUrl,
  };
}

export function serializePublicPost(row: {
  id: string;
  clubId: string;
  academicYear: number;
  postType: PostType;
  title: string;
  summary: string;
  contentMd: string;
  tags: string[];
  mediaUrls: MediaItem[];
  externalLinks: ExternalLink[];
  collaborators: string | null;
  publishedAt: Date | null;
  club: {
    id: string;
    slug: string;
    name: string;
    category: ClubCategory;
    avatarUrl: string | null;
    verificationStatus: ClubVerificationStatus;
    isDemo: boolean;
    universityShortName: string;
  };
}): PublicPostDTO {
  return {
    id: row.id,
    club_id: row.clubId,
    academic_year: row.academicYear,
    post_type: row.postType,
    title: row.title,
    summary: row.summary,
    content_md: row.contentMd,
    tags: row.tags ?? [],
    media_urls: row.mediaUrls ?? [],
    external_links: row.externalLinks ?? [],
    collaborators: row.collaborators,
    published_at: row.publishedAt ? row.publishedAt.toISOString() : null,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      category: row.club.category,
      avatar_url: row.club.avatarUrl,
      verification_status: row.club.verificationStatus,
      is_demo: row.club.isDemo,
      university_short_name: row.club.universityShortName,
    },
  };
}

export function serializeDiscoverCard(row: {
  postId: string;
  title: string;
  summary: string;
  postType: PostType;
  academicYear: number;
  tags: string[];
  mediaUrls: MediaItem[];
  publishedAt: Date | null;
  reason?: string;
  club: {
    id: string;
    slug: string;
    name: string;
    category: ClubCategory;
    avatarUrl: string | null;
    isDemo: boolean;
    verificationStatus: ClubVerificationStatus;
    universityId: string;
    universityShortName: string;
  };
}): DiscoverCardDTO {
  const dto: DiscoverCardDTO = {
    post_id: row.postId,
    title: row.title,
    summary: row.summary,
    post_type: row.postType,
    academic_year: row.academicYear,
    tags: row.tags ?? [],
    cover_image: row.mediaUrls?.[0] ?? null,
    published_at: row.publishedAt ? row.publishedAt.toISOString() : null,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      category: row.club.category,
      avatar_url: row.club.avatarUrl,
      is_demo: row.club.isDemo,
      verification_status: row.club.verificationStatus,
      university_id: row.club.universityId,
      university_short_name: row.club.universityShortName,
    },
  };
  if (row.reason) {
    dto.reason = row.reason;
  }
  return dto;
}

export function serializeForumThread(row: {
  id: string;
  category: ClubCategory;
  discussionTag: ForumTag;
  authorTitle: string | null;
  title: string;
  contentMd: string;
  mediaUrls: MediaItem[];
  externalUrl: string | null;
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
}): PublicForumThreadDTO {
  return {
    id: row.id,
    category: row.category,
    discussion_tag: row.discussionTag,
    author_title: row.authorTitle,
    title: row.title,
    content_md: row.contentMd,
    media_urls: row.mediaUrls ?? [],
    external_url: row.externalUrl,
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

export function serializeForumReply(row: {
  id: string;
  threadId: string;
  authorTitle: string | null;
  contentMd: string;
  createdAt: Date;
  markedHelpfulByMe: boolean;
  hasHelpfulMarks: boolean;
  club: {
    id: string;
    slug: string;
    name: string;
    isDemo: boolean;
    universityShortName: string;
  };
}): PublicForumReplyDTO {
  return {
    id: row.id,
    thread_id: row.threadId,
    author_title: row.authorTitle,
    content_md: row.contentMd,
    created_at: row.createdAt.toISOString(),
    marked_helpful_by_me: row.markedHelpfulByMe,
    has_helpful_marks: row.hasHelpfulMarks,
    club: {
      id: row.club.id,
      slug: row.club.slug,
      name: row.club.name,
      is_demo: row.club.isDemo,
      university_short_name: row.club.universityShortName,
    },
  };
}
