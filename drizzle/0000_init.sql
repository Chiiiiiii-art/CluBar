-- CluBar P0 Initial PostgreSQL 16 + pgvector + pg_trgm Migration
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE club_category AS ENUM ('academic', 'arts', 'recreation', 'sports', 'service', 'social');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_role AS ENUM ('user', 'platform_admin', 'school_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE club_verification_status AS ENUM ('unclaimed_directory', 'pending_review', 'verified', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE club_member_role AS ENUM ('owner', 'editor', 'alumni');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE handover_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_type AS ENUM ('work', 'event', 'workshop', 'competition');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_status AS ENUM ('draft', 'published', 'hidden_by_owner', 'removed_by_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forum_tag AS ENUM ('event_exp', 'equipment', 'venue', 'management', 'collab');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE forum_status AS ENUM ('published', 'removed_by_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_type AS ENUM ('directory_claim', 'new_club', 'owner_takeover');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_target_type AS ENUM ('post', 'club', 'forum_thread', 'forum_reply');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM ('impersonation', 'copyright', 'privacy_leak', 'inappropriate', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('open', 'resolved_takedown', 'resolved_keep', 'resolved_suspend_club');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE analytics_event_type AS ENUM (
    'discover_card_click',
    'club_page_view',
    'official_link_click',
    'opportunity_link_click',
    'club_follow',
    'post_bookmark',
    'discover_query_submit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS universities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  short_name    TEXT NOT NULL,
  email_domains TEXT[] NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  avatar_url            TEXT,
  platform_role         platform_role NOT NULL DEFAULT 'user',
  campus_email          TEXT UNIQUE,
  university_id         UUID REFERENCES universities(id),
  campus_verified_at    TIMESTAMPTZ,
  managed_university_id UUID REFERENCES universities(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS campus_email_otps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campus_email  TEXT NOT NULL,
  university_id UUID NOT NULL REFERENCES universities(id),
  otp_hash      TEXT NOT NULL,
  attempts      SMALLINT NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_user_active ON campus_email_otps(user_id, created_at DESC) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS clubs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id          UUID NOT NULL REFERENCES universities(id),
  slug                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  category               club_category NOT NULL,
  tagline                TEXT NOT NULL DEFAULT '',
  description            TEXT NOT NULL DEFAULT '',
  avatar_url             TEXT,
  cover_url              TEXT,
  external_links         JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status    club_verification_status NOT NULL DEFAULT 'pending_review',
  is_demo                BOOLEAN NOT NULL DEFAULT false,
  official_directory_url TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, name)
);
CREATE INDEX IF NOT EXISTS idx_clubs_category_status ON clubs(category, verification_status);

CREATE TABLE IF NOT EXISTS club_memberships (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      club_member_role NOT NULL,
  title     TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_single_active_owner
  ON club_memberships(club_id)
  WHERE role = 'owner' AND ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_active_member
  ON club_memberships(club_id, user_id)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS club_handovers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id   UUID NOT NULL REFERENCES users(id),
  status       handover_status NOT NULL DEFAULT 'pending',
  note         TEXT,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_pending_handover
  ON club_handovers(club_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS club_opportunities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  summary       TEXT NOT NULL,
  schedule_text TEXT,
  deadline_at   TIMESTAMPTZ,
  external_url  TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_opportunities_club_active ON club_opportunities(club_id, is_active, deadline_at);

CREATE TABLE IF NOT EXISTS posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  author_user_id        UUID NOT NULL REFERENCES users(id),
  academic_year         SMALLINT NOT NULL,
  post_type             post_type NOT NULL,
  title                 TEXT NOT NULL,
  summary               TEXT NOT NULL DEFAULT '',
  content_md            TEXT NOT NULL,
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  media_urls            JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_links        JSONB NOT NULL DEFAULT '[]'::jsonb,
  collaborators         TEXT,
  originality_confirmed BOOLEAN NOT NULL DEFAULT false,
  status                post_status NOT NULL DEFAULT 'draft',
  embedding             vector(1536),
  embedding_updated_at  TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'published' OR originality_confirmed = true)
);
CREATE INDEX IF NOT EXISTS idx_posts_club_year_status ON posts(club_id, academic_year DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_published_recent ON posts(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_posts_tags_gin ON posts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON posts USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_posts_embedding_hnsw ON posts USING hnsw (embedding vector_cosine_ops)
  WHERE status = 'published' AND embedding IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_bookmarks (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS user_follows (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, club_id)
);

CREATE TABLE IF NOT EXISTS forum_threads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         club_category NOT NULL,
  discussion_tag   forum_tag NOT NULL,
  club_id          UUID NOT NULL REFERENCES clubs(id),
  author_user_id   UUID NOT NULL REFERENCES users(id),
  author_title     TEXT,
  title            TEXT NOT NULL,
  content_md       TEXT NOT NULL,
  media_urls       JSONB NOT NULL DEFAULT '[]'::jsonb,
  external_url     TEXT,
  status           forum_status NOT NULL DEFAULT 'published',
  reply_count      INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forum_threads_cat_activity ON forum_threads(category, last_activity_at DESC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS forum_replies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id      UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  club_id        UUID NOT NULL REFERENCES clubs(id),
  author_user_id UUID NOT NULL REFERENCES users(id),
  author_title   TEXT,
  content_md     TEXT NOT NULL,
  status         forum_status NOT NULL DEFAULT 'published',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON forum_replies(thread_id, created_at ASC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS forum_helpful_marks (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reply_id   UUID NOT NULL REFERENCES forum_replies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reply_id)
);

CREATE TABLE IF NOT EXISTS club_applications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                   application_type NOT NULL,
  applicant_user_id      UUID NOT NULL REFERENCES users(id),
  target_club_id         UUID REFERENCES clubs(id),
  proposed_university_id UUID REFERENCES universities(id),
  proposed_name          TEXT,
  proposed_slug          TEXT,
  proposed_category      club_category,
  evidence_text          TEXT NOT NULL,
  evidence_urls          JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                 application_status NOT NULL DEFAULT 'pending',
  reviewer_user_id       UUID REFERENCES users(id),
  review_note            TEXT,
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_applications_status ON club_applications(status, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_club_application
  ON club_applications(applicant_user_id, target_club_id)
  WHERE status = 'pending' AND target_club_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_new_club_slug
  ON club_applications(proposed_slug)
  WHERE status = 'pending' AND proposed_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id),
  target_type      report_target_type NOT NULL,
  target_id        UUID NOT NULL,
  reason           report_reason NOT NULL,
  detail           TEXT,
  status           report_status NOT NULL DEFAULT 'open',
  handler_user_id  UUID REFERENCES users(id),
  resolution_note  TEXT,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at ASC);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  link_url   TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action        TEXT NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     UUID NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id             BIGSERIAL PRIMARY KEY,
  event_type     analytics_event_type NOT NULL,
  university_id  UUID REFERENCES universities(id),
  club_id        UUID REFERENCES clubs(id) ON DELETE SET NULL,
  post_id        UUID REFERENCES posts(id) ON DELETE SET NULL,
  category       club_category,
  source_surface TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_type_time ON analytics_events(event_type, created_at DESC);
