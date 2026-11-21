-- ==========================================================
-- Migration: 011_create_campaigns_and_sms.sql
-- Description: Strictly Template-Based SMS Campaigns & Outbox Schema
-- Providers: MSG91 Flow API v5, BulkSMS, and Mock Simulator
-- Strictly Native PostgreSQL (No ORM, meaningful UUIDs)
-- ==========================================================

-- 1. SMS CONFIGS TABLE (Provider settings & encrypted auth keys)
CREATE TABLE IF NOT EXISTS sms_configs (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_key VARCHAR(50) NOT NULL DEFAULT 'msg91',
    credentials_encrypted TEXT NOT NULL,
    sender_id VARCHAR(50) NOT NULL,
    dlt_entity_id VARCHAR(100),
    default_country_code VARCHAR(10) NOT NULL DEFAULT '91',
    status VARCHAR(30) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'validated', 'active', 'suspended', 'error')),
    last_validated_at TIMESTAMPTZ,
    last_error TEXT,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_configs_provider ON sms_configs(provider_key, status);

-- 2. SMS TEMPLATES TABLE (DLT & MSG91 Flow registered templates)
CREATE TABLE IF NOT EXISTS sms_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_template_id VARCHAR(100) NOT NULL UNIQUE,
    dlt_template_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'transactional',
    body TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON sms_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_sms_templates_provider_id ON sms_templates(provider_template_id);

-- 3. CAMPAIGNS TABLE (Template-bound campaign dispatch management)
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(30) NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'email')),
    template_id UUID NOT NULL REFERENCES sms_templates(template_id) ON DELETE RESTRICT,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('webinar_registrants', 'course_students', 'all_users', 'custom_list')),
    target_id UUID,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
    total_recipients INT NOT NULL DEFAULT 0,
    sent_count INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_channel_status ON campaigns(channel, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_template ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_target ON campaigns(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);

-- 4. SMS OUTBOX TABLE (Individual message queue, retry state & delivery logs)
CREATE TABLE IF NOT EXISTS sms_outbox (
    outbox_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    template_id UUID REFERENCES sms_templates(template_id) ON DELETE SET NULL,
    recipient_phone VARCHAR(50) NOT NULL,
    recipient_name VARCHAR(200),
    rendered_body TEXT NOT NULL,
    variables JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'REJECTED')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    provider_key VARCHAR(50) NOT NULL,
    provider_request_id VARCHAR(150),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sms_outbox_queue ON sms_outbox(status, next_attempt_at) 
    WHERE status IN ('PENDING', 'SENDING');
CREATE INDEX IF NOT EXISTS idx_sms_outbox_campaign ON sms_outbox(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_sms_outbox_provider_req ON sms_outbox(provider_key, provider_request_id);
CREATE INDEX IF NOT EXISTS idx_sms_outbox_created_at ON sms_outbox(created_at DESC);

