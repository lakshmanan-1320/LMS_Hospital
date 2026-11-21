-- ==========================================================
-- Migration Down: 009_meeting_provider_integrations.down.sql
-- ==========================================================

ALTER TABLE webinars DROP COLUMN IF EXISTS meeting_provider_account_id;
DROP TABLE IF EXISTS meeting_provider_accounts;
DROP TABLE IF EXISTS system_settings;
