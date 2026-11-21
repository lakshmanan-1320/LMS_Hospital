-- ==========================================================
-- Migration: 009_meeting_provider_integrations.sql
-- Description: System Settings (Super Admin Google OAuth App credentials),
--              Meeting Provider Accounts (Admin Google Meet/Calendar connections),
--              and Webinar Provider Account linking.
-- Meaningful IDs (setting_key, account_id)
-- Strictly Native PostgreSQL (No ORM)
-- ==========================================================

-- 1. SYSTEM_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);

-- Seed initial master Google OAuth configuration (placeholder values - set real credentials in Admin Settings)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES (
    'google_oauth',
    '{
        "client_id": "YOUR_GOOGLE_OAUTH_CLIENT_ID",
        "client_secret": "YOUR_GOOGLE_OAUTH_CLIENT_SECRET",
        "redirect_uri": "http://localhost:3000/dashboard/admin/settings"
    }'::jsonb,
    'Master Google OAuth 2.0 Client credentials used for Google Meet & Calendar integrations'
)
ON CONFLICT (setting_key) DO NOTHING;

-- 2. MEETING_PROVIDER_ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS meeting_provider_accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL, -- 'google_meet', 'zoom', 'zoho'
    account_email VARCHAR(255) NOT NULL,
    account_name VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    scope TEXT,
    credentials JSONB DEFAULT '{}'::jsonb,
    provider_metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT TRUE,
    connected_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_meeting_provider_account UNIQUE (provider, account_email)
);

CREATE INDEX IF NOT EXISTS idx_meeting_provider_lookup ON meeting_provider_accounts(provider, is_active);
CREATE INDEX IF NOT EXISTS idx_meeting_provider_user ON meeting_provider_accounts(connected_by);

-- 3. LINK WEBINARS TO MEETING PROVIDER ACCOUNT
ALTER TABLE webinars
    ADD COLUMN IF NOT EXISTS meeting_provider_account_id UUID REFERENCES meeting_provider_accounts(account_id) ON DELETE SET NULL;
