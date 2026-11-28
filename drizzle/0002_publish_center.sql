-- Publish center phase 1 (docs/one-stop-publish-solution.md): additive only; old code ignores them.
-- Rollback: ALTER TABLE clubs DROP COLUMN discord_webhook_enc; enum values cannot be dropped (harmless if unused).

-- Discord channel webhook, AES-256-GCM encrypted at rest; never returned to the client.
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS discord_webhook_enc text;

ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'event_share';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'event_publish_started';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'event_publish_channel';
