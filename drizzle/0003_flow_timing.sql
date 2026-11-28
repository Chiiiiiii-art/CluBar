-- Task-level timing (docs/ux-journey-gap-analysis.md, audit P0-2): additive only.
-- flow_id is a short-lived random id created when a task starts (sessionStorage, 30 min);
-- never linked to an account. Rows are anonymised (flow_id cleared) after 90 days.
-- Rollback: ALTER TABLE analytics_events DROP COLUMN flow_id, DROP COLUMN flow_elapsed_ms.
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS flow_id text;
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS flow_elapsed_ms integer;

ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'flow_start';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'flow_done';
