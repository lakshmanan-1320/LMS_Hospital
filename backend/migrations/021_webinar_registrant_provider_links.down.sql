DROP INDEX IF EXISTS idx_webinar_reg_provider_sync;

ALTER TABLE webinar_registrations
    DROP COLUMN IF EXISTS provider_synced_at,
    DROP COLUMN IF EXISTS provider_sync_attempts,
    DROP COLUMN IF EXISTS provider_sync_error,
    DROP COLUMN IF EXISTS provider_sync_status,
    DROP COLUMN IF EXISTS provider_join_url,
    DROP COLUMN IF EXISTS provider_registrant_id;
