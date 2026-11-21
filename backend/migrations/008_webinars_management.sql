-- ==========================================================
-- Migration: 008_webinars_management.sql
-- Description: Complete Webinars, Multi-Host, Public Registrations, Multi-Interval Attendances, and Audit Schema
-- Meaningful IDs (webinar_id, webinar_host_id, webinar_registration_id, webinar_attendance_id, webinar_audit_log_id, webinar_webhook_event_id)
-- Strictly Native PostgreSQL (No ORM)
-- ==========================================================

-- 1. WEBINARS TABLE
CREATE TABLE IF NOT EXISTS webinars (
    webinar_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    cover_image_url TEXT,
    provider VARCHAR(50) NOT NULL DEFAULT 'google_meet', -- 'google_meet', 'zoom', 'zoho'
    provider_session_id VARCHAR(255),
    provider_metadata JSONB DEFAULT '{}',
    meeting_link TEXT,
    host_join_url TEXT, -- Strictly private, never returned in public APIs
    passcode VARCHAR(100),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC',
    max_participants INTEGER NOT NULL DEFAULT 100,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'live', 'completed', 'cancelled'
    is_public_registration BOOLEAN DEFAULT TRUE,
    custom_registration_fields JSONB DEFAULT '[]', -- Admin-configured dynamic fields: [{id, label, type, required}]
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webinars_slug ON webinars(slug);
CREATE INDEX IF NOT EXISTS idx_webinars_status_start ON webinars(status, start_time);
CREATE INDEX IF NOT EXISTS idx_webinars_created_by ON webinars(created_by);

-- 2. WEBINAR_HOSTS TABLE (Normalized Host & Co-Hosts)
CREATE TABLE IF NOT EXISTS webinar_hosts (
    webinar_host_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webinar_id UUID NOT NULL REFERENCES webinars(webinar_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    host_role VARCHAR(50) NOT NULL DEFAULT 'primary_host', -- 'primary_host', 'co_host', 'moderator'
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_webinar_host_user UNIQUE (webinar_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_webinar_hosts_webinar ON webinar_hosts(webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_hosts_user ON webinar_hosts(user_id);

-- 3. WEBINAR_REGISTRATIONS TABLE (Completely Decoupled - NO user_id)
CREATE TABLE IF NOT EXISTS webinar_registrations (
    webinar_registration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webinar_id UUID NOT NULL REFERENCES webinars(webinar_id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50), -- Non-unique: shared family/office phones allowed
    custom_field_responses JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed', -- 'confirmed', 'cancelled'
    join_token_hash VARCHAR(255) NOT NULL, -- SHA-256 hash of high-entropy 256-bit join token
    join_token_expires_at TIMESTAMPTZ NOT NULL,
    
    -- Traffic & Marketing Attribution (Raw, never invented)
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),
    referrer TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Email Lifecycle Tracking
    confirmation_sent_at TIMESTAMPTZ, -- Updated ONLY after successful delivery
    confirmation_delivery_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'delivered', 'failed'
    confirmation_error_message TEXT,
    resend_count INTEGER DEFAULT 0,
    
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Partial Unique Index on Email per Webinar (Cancelled registrations do not block re-registration)
CREATE UNIQUE INDEX IF NOT EXISTS uq_webinar_reg_email 
    ON webinar_registrations(webinar_id, LOWER(email)) 
    WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_webinar_reg_token_hash 
    ON webinar_registrations(join_token_hash);
CREATE INDEX IF NOT EXISTS idx_webinar_reg_webinar_status 
    ON webinar_registrations(webinar_id, status);
CREATE INDEX IF NOT EXISTS idx_webinar_reg_created_at 
    ON webinar_registrations(created_at);

-- 4. WEBINAR_ATTENDANCES TABLE (Multiple Join/Leave Intervals)
CREATE TABLE IF NOT EXISTS webinar_attendances (
    webinar_attendance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webinar_id UUID NOT NULL REFERENCES webinars(webinar_id) ON DELETE CASCADE,
    webinar_registration_id UUID NOT NULL REFERENCES webinar_registrations(webinar_registration_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webinar_attendance_reg 
    ON webinar_attendances(webinar_registration_id);
CREATE INDEX IF NOT EXISTS idx_webinar_attendance_webinar 
    ON webinar_attendances(webinar_id, joined_at);

-- 5. WEBINAR_AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS webinar_audit_logs (
    webinar_audit_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webinar_id UUID REFERENCES webinars(webinar_id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL, -- 'WEBINAR_CREATED', 'WEBINAR_UPDATED', 'WEBINAR_RESCHEDULED', 'WEBINAR_CANCELLED', 'SESSION_STARTED', 'SESSION_ENDED'
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webinar_audit_webinar 
    ON webinar_audit_logs(webinar_id, created_at);

-- 6. WEBINAR_WEBHOOK_EVENTS TABLE
CREATE TABLE IF NOT EXISTS webinar_webhook_events (
    webinar_webhook_event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'failed'
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webinar_webhook_provider 
    ON webinar_webhook_events(provider, provider_event_id);

-- 7. ROLE PERMISSIONS SEEDING (ADMIN alone manages webinars)
INSERT INTO permissions (code, description) VALUES
    ('webinars:create', 'Create and schedule webinars'),
    ('webinars:manage', 'Update, reschedule, and cancel webinars'),
    ('webinars:read_all', 'Read all webinars, rosters, and analytics')
ON CONFLICT (code) DO NOTHING;

-- Map Webinar Permissions to ADMIN ONLY
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.code IN (
    'webinars:create',
    'webinars:manage',
    'webinars:read_all'
)
ON CONFLICT DO NOTHING;

