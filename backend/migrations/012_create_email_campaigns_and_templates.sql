-- ==========================================================
-- Migration: 012_create_email_campaigns_and_templates.sql
-- Description: Responsive HTML Email Templates, SMTP Gateway Config,
--              Bulk Email Campaigns & Outbox Schema.
-- Strictly Native PostgreSQL (No ORM, meaningful UUIDs)
-- ==========================================================

-- 1. EMAIL CONFIGS TABLE (Super Admin SMTP gateway settings)
CREATE TABLE IF NOT EXISTS email_configs (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL DEFAULT 465,
    encryption VARCHAR(20) NOT NULL DEFAULT 'ssl' 
        CHECK (encryption IN ('ssl', 'tls', 'none')),
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,
    from_name VARCHAR(150) NOT NULL DEFAULT 'Elevate Learning',
    from_email VARCHAR(255) NOT NULL,
    redirect_to VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'validated', 'active', 'error')),
    last_validated_at TIMESTAMPTZ,
    last_error TEXT,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_configs_status ON email_configs(status);

-- 2. EMAIL TEMPLATES TABLE (Responsive HTML email templates)
CREATE TABLE IF NOT EXISTS email_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(300) NOT NULL,
    preview_text VARCHAR(255),
    category VARCHAR(50) NOT NULL DEFAULT 'announcement' 
        CHECK (category IN ('announcement', 'promotional', 'newsletter', 'transactional', 'alert')),
    html_content TEXT NOT NULL,
    plain_text TEXT,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(category);

-- 3. CAMPAIGNS SCHEMA ENHANCEMENTS FOR EMAIL
ALTER TABLE campaigns 
    DROP CONSTRAINT IF EXISTS campaigns_template_id_fkey;

ALTER TABLE campaigns 
    ALTER COLUMN template_id DROP NOT NULL;

ALTER TABLE campaigns 
    ADD COLUMN IF NOT EXISTS email_template_id UUID REFERENCES email_templates(template_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_campaigns_email_template ON campaigns(email_template_id);

-- 4. EMAIL OUTBOX TABLE (Per-recipient queue, retry & delivery logs)
CREATE TABLE IF NOT EXISTS email_outbox (
    outbox_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    template_id UUID REFERENCES email_templates(template_id) ON DELETE SET NULL,
    recipient_email VARCHAR(320) NOT NULL,
    recipient_name VARCHAR(200),
    subject VARCHAR(300) NOT NULL,
    rendered_html TEXT NOT NULL,
    variables JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    smtp_message_id VARCHAR(300),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_queue ON email_outbox(status, next_attempt_at) 
    WHERE status IN ('PENDING', 'SENDING');
CREATE INDEX IF NOT EXISTS idx_email_outbox_campaign ON email_outbox(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient ON email_outbox(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_outbox_created_at ON email_outbox(created_at DESC);

