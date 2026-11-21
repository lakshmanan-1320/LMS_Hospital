-- ==========================================================
-- Migration: 013_create_whatsapp_campaigns.sql
-- Description: Meta WhatsApp Cloud API Gateway Config, Templates,
--              Bulk WhatsApp Campaigns & Outbox Schema.
-- Strictly Native PostgreSQL (No ORM, meaningful UUIDs)
-- ==========================================================

-- 1. WHATSAPP CONFIGS TABLE (Super Admin Meta Cloud API settings)
CREATE TABLE IF NOT EXISTS whatsapp_configs (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id VARCHAR(100) NOT NULL,
    app_secret_encrypted TEXT NOT NULL,
    waba_id VARCHAR(100) NOT NULL,
    phone_number_id VARCHAR(100) NOT NULL,
    display_phone_number VARCHAR(50),
    business_name VARCHAR(255),
    access_token_encrypted TEXT NOT NULL,
    webhook_verify_token_encrypted TEXT,
    graph_version VARCHAR(20) NOT NULL DEFAULT 'v26.0',
    redirect_to VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'validated', 'active', 'error')),
    last_validated_at TIMESTAMPTZ,
    last_error TEXT,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_status ON whatsapp_configs(status);

-- 2. WHATSAPP TEMPLATES TABLE (Meta Cloud API Approved Message Templates)
CREATE TABLE IF NOT EXISTS whatsapp_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meta_template_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(20) NOT NULL DEFAULT 'en_US',
    category VARCHAR(50) NOT NULL DEFAULT 'UTILITY' 
        CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
    status VARCHAR(50) NOT NULL DEFAULT 'APPROVED' 
        CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED')),
    body_text TEXT NOT NULL,
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    rejected_reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status ON whatsapp_templates(status, is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_name ON whatsapp_templates(name);

-- 3. CAMPAIGNS SCHEMA ENHANCEMENT FOR WHATSAPP
ALTER TABLE campaigns 
    DROP CONSTRAINT IF EXISTS campaigns_channel_check;

ALTER TABLE campaigns 
    ADD CONSTRAINT campaigns_channel_check 
    CHECK (channel IN ('sms', 'email', 'whatsapp'));

ALTER TABLE campaigns 
    ADD COLUMN IF NOT EXISTS whatsapp_template_id UUID REFERENCES whatsapp_templates(template_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_campaigns_whatsapp_template ON campaigns(whatsapp_template_id);

-- 4. WHATSAPP OUTBOX TABLE (Per-recipient queue, retry & delivery logs)
CREATE TABLE IF NOT EXISTS whatsapp_outbox (
    outbox_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    template_id UUID REFERENCES whatsapp_templates(template_id) ON DELETE SET NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    recipient_name VARCHAR(200),
    rendered_body TEXT NOT NULL,
    parameters JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'REJECTED')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    meta_message_id VARCHAR(200),
    error_message TEXT,
    error_details JSONB,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_queue ON whatsapp_outbox(status, next_attempt_at) 
    WHERE status IN ('PENDING', 'SENDING');
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_campaign ON whatsapp_outbox(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_recipient ON whatsapp_outbox(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_meta_id ON whatsapp_outbox(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_created_at ON whatsapp_outbox(created_at DESC);

