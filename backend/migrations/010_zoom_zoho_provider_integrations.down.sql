-- ==========================================================
-- Migration Down: 010_zoom_zoho_provider_integrations.down.sql
-- ==========================================================

DELETE FROM system_settings WHERE setting_key IN ('zoom_oauth', 'zoho_oauth');

