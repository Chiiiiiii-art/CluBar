-- UX round 2 (docs/design/04-patterns.md): additive columns only; old code ignores them.
-- Rollback: ALTER TABLE ... DROP COLUMN for each column below.

-- U-05: officers pin up to 4 representative works to the top of the club page.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

-- U-09: host can keep the location out of the share card / link preview.
ALTER TABLE club_events ADD COLUMN IF NOT EXISTS share_hide_location boolean NOT NULL DEFAULT false;

-- U-14: hide a single event or club from the owner's public footprint.
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS hidden_from_portfolio boolean NOT NULL DEFAULT false;
ALTER TABLE club_memberships ADD COLUMN IF NOT EXISTS hidden_from_portfolio boolean NOT NULL DEFAULT false;
