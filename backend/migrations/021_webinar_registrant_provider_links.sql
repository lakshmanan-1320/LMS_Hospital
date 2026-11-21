-- Personal per-registrant meeting links (Zoom registrants).
-- Each registration stores the provider's own registrant ID and that person's personal join URL,
-- so the confirmation email carries one personal link instead of the shared meeting link.
-- provider_join_url is a credential: it is never returned by admin/public listing APIs.
ALTER TABLE webinar_registrations
    ADD COLUMN IF NOT EXISTS provider_registrant_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_join_url TEXT,
    ADD COLUMN IF NOT EXISTS provider_sync_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'synced', 'failed'
    ADD COLUMN IF NOT EXISTS provider_sync_error TEXT,
    ADD COLUMN IF NOT EXISTS provider_sync_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS provider_synced_at TIMESTAMPTZ;

-- Lets the retry job find registrations whose provider sync is still outstanding.
CREATE INDEX IF NOT EXISTS idx_webinar_reg_provider_sync
    ON webinar_registrations (webinar_id, provider_sync_status);
