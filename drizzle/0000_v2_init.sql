-- CluBar v2.0 Full Initial Schema (SRS v2.0 §5.2)
SET search_path TO public, extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 27 Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE club_category AS ENUM ('academic', 'arts', 'recreation', 'sports', 'service', 'social');
CREATE TYPE platform_role AS ENUM ('user', 'school_admin', 'platform_admin');
CREATE TYPE club_verification_status AS ENUM ('unclaimed_directory', 'pending_review', 'verified', 'suspended');
CREATE TYPE club_member_role AS ENUM ('owner', 'editor', 'member', 'alumni');
CREATE TYPE member_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE handover_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');

CREATE TYPE post_kind AS ENUM ('nrc_moment', 'wip_work', 'album_highlight', 'qa_highlight');
CREATE TYPE post_status AS ENUM ('draft', 'published', 'hidden_by_owner', 'removed_by_admin');

CREATE TYPE event_schedule_mode AS ENUM ('scheduled', 'tbd', 'voting');
CREATE TYPE event_status AS ENUM ('draft', 'open', 'completed', 'cancelled');
CREATE TYPE learning_hours_category AS ENUM ('none', 'art', 'life', 'service');
CREATE TYPE rsvp_status AS ENUM ('going', 'interested', 'cancelled');
CREATE TYPE rsvp_privacy_mode AS ENUM ('public_to_attendees', 'private_count_only');
CREATE TYPE album_photo_status AS ENUM ('pending_review', 'approved_album', 'featured_stream', 'rejected');

CREATE TYPE club_question_status AS ENUM ('pending_reply', 'answered_private', 'published', 'hidden');
CREATE TYPE co_club_target_type AS ENUM ('event', 'post');
CREATE TYPE co_club_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE archive_file_category AS ENUM ('meeting_minutes', 'finance_ledger', 'equipment_inventory', 'evaluation_evidence', 'other');

CREATE TYPE together_item_type AS ENUM ('showcase', 'rebound', 'field_log', 'match_invite', 'reading_notes');
CREATE TYPE together_status AS ENUM ('published', 'hidden_by_author', 'removed_by_admin');

CREATE TYPE follow_mode AS ENUM ('all', 'events_only');
CREATE TYPE portfolio_visibility AS ENUM ('private', 'campus_only', 'public');
CREATE TYPE bookmark_target_type AS ENUM ('post', 'event');
CREATE TYPE application_type AS ENUM ('directory_claim', 'new_club', 'owner_takeover');
CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE report_target_type AS ENUM ('post', 'event', 'event_comment', 'album_photo', 'club_question', 'together_item', 'club');
CREATE TYPE report_reason AS ENUM ('impersonation', 'copyright', 'privacy_leak', 'portrait_violation', 'inappropriate', 'other');
CREATE TYPE report_status AS ENUM ('open', 'resolved_takedown', 'resolved_keep', 'resolved_suspend_club');
CREATE TYPE analytics_event_type AS ENUM (
  'onboarding_complete', 'blend_create', 'blend_join',
  'discover_stream_click', 'discover_event_click', 'discover_query_submit',
  'club_page_view', 'event_rsvp_going', 'event_promo_copy',
  'album_upload', 'nrc_publish', 'together_item_click',
  'official_link_click', 'club_follow', 'bookmark_add'
);

-- ── 1. 學校、興趣領域、使用者、Onboarding 與 Blend ────────────────────────

CREATE TABLE universities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  short_name      TEXT NOT NULL,
  email_domains   TEXT[] NOT NULL,
  sso_config      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE interest_domains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name_zh         TEXT NOT NULL,
  sort_order      SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   TEXT NOT NULL UNIQUE,
  display_name            TEXT NOT NULL,
  handle                  TEXT UNIQUE,
  avatar_url              TEXT,
  platform_role           platform_role NOT NULL DEFAULT 'user',
  campus_email            TEXT UNIQUE,
  university_id           UUID REFERENCES universities(id),
  campus_verified_at      TIMESTAMPTZ,
  sso_subject_id          TEXT,
  managed_university_id   UUID REFERENCES universities(id),
  portfolio_visibility    portfolio_visibility NOT NULL DEFAULT 'campus_only',
  talent_discovery_opt_in BOOLEAN NOT NULL DEFAULT false,
  alumni_ping_enabled     BOOLEAN NOT NULL DEFAULT false,
  alumni_expertise_tags   TEXT[] NOT NULL DEFAULT '{}',
  calendar_token_version  SMALLINT NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_alumni_tags_max3 CHECK (cardinality(alumni_expertise_tags) <= 3)
);

CREATE TABLE oauth_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oauth_accounts_provider_account_unique UNIQUE (provider, provider_account_id)
);
CREATE INDEX idx_oauth_accounts_user ON oauth_accounts(user_id);

CREATE TABLE campus_email_otps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campus_email    TEXT NOT NULL,
  university_id   UUID NOT NULL REFERENCES universities(id),
  otp_hash        TEXT NOT NULL,
  attempts        SMALLINT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_user_active ON campus_email_otps(user_id, created_at DESC) WHERE consumed_at IS NULL;

CREATE TABLE user_onboarding_profiles (
  user_id                UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  selected_university_id UUID REFERENCES universities(id),
  goals                  TEXT[] NOT NULL DEFAULT '{}',
  domain_ids             UUID[] NOT NULL DEFAULT '{}',
  vibe                   TEXT,
  persona_archetype      TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE blend_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code            TEXT NOT NULL UNIQUE,
  creator_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  university_id         UUID NOT NULL REFERENCES universities(id),
  shared_domain_ids     UUID[] NOT NULL DEFAULT '{}',
  match_score           SMALLINT,
  recommended_club_ids  UUID[] NOT NULL DEFAULT '{}',
  recommended_event_ids UUID[] NOT NULL DEFAULT '{}',
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  joined_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_blend_distinct_partner CHECK (partner_user_id IS NULL OR partner_user_id <> creator_user_id)
);

-- ── 2. 社團、認證社員雙軌制、預填 FAQ 與問答箱 ──────────────────────────────

CREATE TABLE clubs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id           UUID NOT NULL REFERENCES universities(id),
  slug                    TEXT NOT NULL UNIQUE,
  name                    TEXT NOT NULL,
  category                club_category NOT NULL,
  domain_ids              UUID[] NOT NULL DEFAULT '{}',
  tagline                 TEXT NOT NULL DEFAULT '',
  description             TEXT NOT NULL DEFAULT '',
  avatar_url              TEXT,
  cover_url               TEXT,
  external_links          JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status     club_verification_status NOT NULL DEFAULT 'pending_review',
  is_demo                 BOOLEAN NOT NULL DEFAULT false,
  official_directory_url  TEXT,
  last_activity_at        TIMESTAMPTZ,
  last_handover_at        TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clubs_university_name_unique UNIQUE (university_id, name)
);
CREATE INDEX idx_clubs_univ_status ON clubs(university_id, verification_status);
CREATE INDEX idx_clubs_domains_gin ON clubs USING GIN (domain_ids);

CREATE TABLE club_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        club_member_role NOT NULL,
  title       TEXT,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_club_single_active_owner ON club_memberships(club_id) WHERE role = 'owner' AND ended_at IS NULL;
CREATE UNIQUE INDEX uq_club_active_member ON club_memberships(club_id, user_id) WHERE ended_at IS NULL;

CREATE TABLE club_invite_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  code          TEXT NOT NULL UNIQUE,
  created_by    UUID NOT NULL REFERENCES users(id),
  max_uses      INTEGER,
  used_count    INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invite_codes_club_active ON club_invite_codes(club_id) WHERE revoked_at IS NULL;

CREATE TABLE club_member_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note            TEXT,
  status          member_request_status NOT NULL DEFAULT 'pending',
  reviewer_id     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_club_member_req_pending ON club_member_requests(club_id, user_id) WHERE status = 'pending';

CREATE TABLE club_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  asker_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  is_anonymous    BOOLEAN NOT NULL DEFAULT true,
  display_alias   TEXT,
  question_text   TEXT NOT NULL,
  answer_text     TEXT,
  answered_by     UUID REFERENCES users(id),
  answered_at     TIMESTAMPTZ,
  status          club_question_status NOT NULL DEFAULT 'pending_reply',
  is_pinned_faq   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_club_questions_public ON club_questions(club_id, is_pinned_faq DESC, answered_at DESC)
  WHERE status = 'published';

-- ── 3. Partiful 式活動引擎、喬時間、兩段隱私報名、留言與無損相簿池 ────────

CREATE TABLE club_events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                   UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  created_by                UUID NOT NULL REFERENCES users(id),
  short_code                TEXT NOT NULL UNIQUE,
  title                     TEXT NOT NULL,
  summary                   TEXT NOT NULL DEFAULT '',
  description_md            TEXT NOT NULL DEFAULT '',
  theme_preset              TEXT NOT NULL DEFAULT 'warm_paper',
  cover_media               JSONB,
  schedule_mode             event_schedule_mode NOT NULL DEFAULT 'scheduled',
  starts_at                 TIMESTAMPTZ,
  ends_at                   TIMESTAMPTZ,
  location_text             TEXT NOT NULL DEFAULT 'TBD 待定',
  beginner_friendly         BOOLEAN NOT NULL DEFAULT true,
  non_members_welcome       BOOLEAN NOT NULL DEFAULT true,
  campus_only               BOOLEAN NOT NULL DEFAULT false,
  fee_ntd                   INTEGER NOT NULL DEFAULT 0,
  fee_note                  TEXT,
  learning_hours_category   learning_hours_category NOT NULL DEFAULT 'none',
  learning_hours_count      NUMERIC(4,1) NOT NULL DEFAULT 0,
  pre_event_notes           TEXT,
  capacity                  INTEGER,
  external_registration_url TEXT,
  domain_ids                UUID[] NOT NULL DEFAULT '{}',
  status                    event_status NOT NULL DEFAULT 'open',
  ics_sequence              INTEGER NOT NULL DEFAULT 0,
  include_in_evaluation     BOOLEAN NOT NULL DEFAULT true,
  embedding                 vector(1536),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_events_fee_non_negative CHECK (fee_ntd >= 0),
  CONSTRAINT chk_events_hours_non_negative CHECK (learning_hours_count >= 0),
  CONSTRAINT chk_events_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT chk_events_scheduled_has_start CHECK (schedule_mode <> 'scheduled' OR starts_at IS NOT NULL)
);
CREATE INDEX idx_events_discover ON club_events(status, starts_at ASC) WHERE status = 'open';
CREATE INDEX idx_events_club ON club_events(club_id, created_at DESC);
CREATE INDEX idx_events_title_trgm ON club_events USING GIN (title gin_trgm_ops);
CREATE INDEX idx_events_embedding_hnsw ON club_events USING hnsw (embedding vector_cosine_ops)
  WHERE status = 'open' AND embedding IS NOT NULL;

CREATE TABLE event_poll_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES club_events(id) ON DELETE CASCADE,
  option_type   TEXT NOT NULL,
  label         TEXT NOT NULL,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  is_selected   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_poll_option_type CHECK (option_type IN ('time_slot', 'topic'))
);

CREATE TABLE event_poll_votes (
  option_id     UUID NOT NULL REFERENCES event_poll_options(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (option_id, user_id)
);

CREATE TABLE event_rsvps (
  event_id          UUID NOT NULL REFERENCES club_events(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            rsvp_status NOT NULL DEFAULT 'going',
  privacy_mode      rsvp_privacy_mode NOT NULL DEFAULT 'public_to_attendees',
  display_alias     TEXT,
  attended          BOOLEAN NOT NULL DEFAULT false,
  attended_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX idx_rsvps_user ON event_rsvps(user_id, status);

CREATE TABLE event_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES club_events(id) ON DELETE CASCADE,
  author_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  deleted_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_comments_active ON event_comments(event_id, created_at ASC) WHERE is_deleted = false;

CREATE TABLE event_album_photos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES club_events(id) ON DELETE CASCADE,
  uploader_user_id      UUID NOT NULL REFERENCES users(id),
  original_url          TEXT NOT NULL,
  preview_url           TEXT NOT NULL,
  width                 INTEGER NOT NULL,
  height                INTEGER NOT NULL,
  mime_type             TEXT NOT NULL,
  size_bytes            INTEGER NOT NULL,
  caption               TEXT,
  status                album_photo_status NOT NULL DEFAULT 'pending_review',
  consent_confirmed     BOOLEAN NOT NULL DEFAULT false,
  curated_by            UUID REFERENCES users(id),
  include_in_evaluation BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_album_dimensions_positive CHECK (width > 0 AND height > 0),
  CONSTRAINT chk_album_featured_consent CHECK (status <> 'featured_stream' OR consent_confirmed = true)
);
CREATE INDEX idx_album_event_status ON event_album_photos(event_id, status, created_at DESC);

-- ── 4. 探索現場流內容（NRC／WIP／精選相簿／QA 精華）與 Co-Club 共辦 ────────

CREATE TABLE posts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  author_user_id        UUID NOT NULL REFERENCES users(id),
  post_kind             post_kind NOT NULL,
  headline              TEXT NOT NULL,
  content_md            TEXT NOT NULL DEFAULT '',
  media_items           JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_event_id      UUID REFERENCES club_events(id) ON DELETE SET NULL,
  source_album_photo_id UUID REFERENCES event_album_photos(id) ON DELETE SET NULL,
  source_question_id    UUID REFERENCES club_questions(id) ON DELETE SET NULL,
  mood_tag              TEXT,
  domain_ids            UUID[] NOT NULL DEFAULT '{}',
  originality_confirmed BOOLEAN NOT NULL DEFAULT false,
  include_in_evaluation BOOLEAN NOT NULL DEFAULT false,
  status                post_status NOT NULL DEFAULT 'draft',
  embedding             vector(1536),
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_posts_originality_published CHECK (status <> 'published' OR originality_confirmed = true)
);
CREATE INDEX idx_posts_stream_recent ON posts(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_posts_club_eval ON posts(club_id, include_in_evaluation, published_at DESC);
CREATE INDEX idx_posts_headline_trgm ON posts USING GIN (headline gin_trgm_ops);
CREATE INDEX idx_posts_embedding_hnsw ON posts USING hnsw (embedding vector_cosine_ops)
  WHERE status = 'published' AND embedding IS NOT NULL;

CREATE TABLE co_club_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type           co_club_target_type NOT NULL,
  target_id             UUID NOT NULL,
  host_club_id          UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  partner_club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  status                co_club_status NOT NULL DEFAULT 'pending',
  partner_include_eval  BOOLEAN NOT NULL DEFAULT true,
  invited_by            UUID NOT NULL REFERENCES users(id),
  responded_by          UUID REFERENCES users(id),
  responded_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_coclub_distinct_clubs CHECK (host_club_id <> partner_club_id),
  CONSTRAINT uq_coclub_target_partner UNIQUE (target_type, target_id, partner_club_id)
);

-- ── 5. 私密評鑑歸檔層、3 步換屆與行政避雷便條 ─────────────────────────────

CREATE TABLE club_archive_files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  uploaded_by       UUID NOT NULL REFERENCES users(id),
  archive_category  archive_file_category NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  blob_path         TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL,
  occurred_on       DATE NOT NULL,
  retention_until   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 years'),
  is_archived       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_archive_club_date ON club_archive_files(club_id, occurred_on DESC);

CREATE TABLE club_handovers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id            UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  from_user_id       UUID NOT NULL REFERENCES users(id),
  to_user_id         UUID NOT NULL REFERENCES users(id),
  status             handover_status NOT NULL DEFAULT 'pending',
  pending_note_json  JSONB,
  share_deidentified BOOLEAN NOT NULL DEFAULT false,
  expires_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_handover_distinct_users CHECK (from_user_id <> to_user_id)
);
CREATE UNIQUE INDEX uq_club_pending_handover ON club_handovers(club_id) WHERE status = 'pending';

CREATE TABLE club_handover_notes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  handover_id           UUID REFERENCES club_handovers(id) ON DELETE SET NULL,
  author_user_id        UUID NOT NULL REFERENCES users(id),
  venue_tips            TEXT NOT NULL DEFAULT '',
  hours_and_deadlines   TEXT NOT NULL DEFAULT '',
  contacts_and_vendors  TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. 一起聚（跨校舞台）、個人訂閱、Web Push、治理與匿名統計 ───────────

CREATE TABLE together_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id         UUID NOT NULL REFERENCES interest_domains(id),
  item_type         together_item_type NOT NULL,
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  author_user_id    UUID NOT NULL REFERENCES users(id),
  parent_item_id    UUID REFERENCES together_items(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  content_md        TEXT NOT NULL,
  media_items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  embed_url         TEXT,
  status            together_status NOT NULL DEFAULT 'published',
  reply_count       INTEGER NOT NULL DEFAULT 0,
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_together_domain_activity ON together_items(domain_id, last_activity_at DESC) WHERE status = 'published';

CREATE TABLE together_replies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES together_items(id) ON DELETE CASCADE,
  club_id         UUID NOT NULL REFERENCES clubs(id),
  author_user_id  UUID NOT NULL REFERENCES users(id),
  content_md      TEXT NOT NULL,
  status          together_status NOT NULL DEFAULT 'published',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE together_jams (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_club_id          UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  domain_id             UUID NOT NULL REFERENCES interest_domains(id),
  created_by            UUID NOT NULL REFERENCES users(id),
  title                 TEXT NOT NULL,
  summary               TEXT NOT NULL,
  target_schools_count  SMALLINT NOT NULL DEFAULT 2,
  needed_roles          TEXT[] NOT NULL DEFAULT '{}',
  collab_format         TEXT NOT NULL,
  deadline_at           TIMESTAMPTZ NOT NULL,
  status                TEXT NOT NULL DEFAULT 'open',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_jam_target_schools CHECK (target_schools_count >= 2),
  CONSTRAINT chk_jam_status CHECK (status IN ('open', 'closed', 'removed_by_admin'))
);

CREATE TABLE alumni_pings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_alumni_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id       UUID NOT NULL REFERENCES interest_domains(id),
  expertise_tag   TEXT NOT NULL,
  message         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_alumni_ping_distinct CHECK (from_user_id <> to_alumni_id)
);

CREATE TABLE practical_resources (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id            UUID NOT NULL REFERENCES interest_domains(id),
  source_university_id UUID REFERENCES universities(id),
  title                TEXT NOT NULL,
  content_md           TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'published',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_resource_status CHECK (status IN ('published', 'removed_by_admin'))
);

CREATE TABLE user_bookmarks (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type   bookmark_target_type NOT NULL,
  target_id     UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE user_follows (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  follow_mode   follow_mode NOT NULL DEFAULT 'all',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, club_id)
);

CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE club_applications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                    application_type NOT NULL,
  applicant_user_id       UUID NOT NULL REFERENCES users(id),
  target_club_id          UUID REFERENCES clubs(id),
  proposed_university_id  UUID REFERENCES universities(id),
  proposed_name           TEXT,
  proposed_slug           TEXT,
  proposed_category       club_category,
  evidence_text           TEXT NOT NULL,
  evidence_urls           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status                  application_status NOT NULL DEFAULT 'pending',
  reviewer_user_id        UUID REFERENCES users(id),
  review_note             TEXT,
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_applications_status ON club_applications(status, created_at ASC);
CREATE UNIQUE INDEX uq_pending_club_application ON club_applications(applicant_user_id, target_club_id)
  WHERE status = 'pending' AND target_club_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pending_new_club_slug ON club_applications(proposed_slug)
  WHERE status = 'pending' AND proposed_slug IS NOT NULL;

CREATE TABLE reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id  UUID NOT NULL REFERENCES users(id),
  target_type       report_target_type NOT NULL,
  target_id         UUID NOT NULL,
  reason            report_reason NOT NULL,
  detail            TEXT,
  status            report_status NOT NULL DEFAULT 'open',
  handler_user_id   UUID REFERENCES users(id),
  resolution_note   TEXT,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_status ON reports(status, created_at ASC);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  link_url    TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID REFERENCES users(id),
  action          TEXT NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       UUID NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id, created_at DESC);

CREATE TABLE evaluation_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft',
  submitted_by      UUID REFERENCES users(id),
  reviewer_user_id  UUID REFERENCES users(id),
  review_comment    TEXT,
  retention_until   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 years'),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_eval_submission_status CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'revision_requested'))
);

CREATE TABLE analytics_events (
  id                  BIGSERIAL PRIMARY KEY,
  event_type          analytics_event_type NOT NULL,
  university_id       UUID REFERENCES universities(id),
  club_id             UUID REFERENCES clubs(id) ON DELETE SET NULL,
  target_id           UUID,
  source_surface      TEXT,
  student_reach_hash  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_type_time ON analytics_events(event_type, created_at DESC);
