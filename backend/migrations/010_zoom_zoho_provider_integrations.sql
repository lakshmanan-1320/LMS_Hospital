-- ==========================================================
-- Migration: 010_zoom_zoho_provider_integrations.sql
-- Description: Seed master system_settings for Zoom Meetings and Zoho Meeting integrations
-- ==========================================================

-- 1. Seed Zoom OAuth configuration in system_settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'zoom_oauth',
    '{
        "account_id": "",
        "client_id": "",
        "client_secret": "",
        "webhook_secret_token": "",
        "auth_type": "server_to_server"
    }'::jsonb,
    'Master Zoom OAuth 2.0 / Server-to-Server credentials and Webhook Secret Token'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 2. Seed Zoho Meeting configuration in system_settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'zoho_oauth',
    '{
        "client_id": "",
        "client_secret": "",
        "data_center": "com",
        "redirect_uri": "http://localhost:3000/dashboard/admin/settings"
    }'::jsonb,
    'Master Zoho Meeting OAuth 2.0 Client credentials and Data Center configuration'
)
ON CONFLICT (setting_key) DO NOTHING;

