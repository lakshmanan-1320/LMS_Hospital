-- Certificate Management Schema Migration

-- Ensure course_enrollments supports 'manual' enrollment type
ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_enrollment_type_check;

ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_enrollment_type_check
    CHECK (enrollment_type IN ('free', 'manual', 'paid'));

-- 1. Certificate Templates Table
CREATE TABLE IF NOT EXISTS certificate_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    certificate_type VARCHAR(50) NOT NULL CHECK (certificate_type IN ('course_completion', 'webinar_participation')),
    description TEXT,
    template_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    logo_storage_key VARCHAR(500),
    signature_storage_key VARCHAR(500),
    is_default BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cert_templates_type_status ON certificate_templates(certificate_type, status);
CREATE INDEX IF NOT EXISTS idx_cert_templates_is_default ON certificate_templates(is_default);

-- 2. Webinar Certificate Settings Table
CREATE TABLE IF NOT EXISTS webinar_certificate_settings (
    setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webinar_id UUID NOT NULL UNIQUE REFERENCES webinars(webinar_id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    minimum_attendance_percentage NUMERIC(5, 2) NOT NULL DEFAULT 75.00,
    minimum_attendance_minutes INTEGER NULL,
    template_id UUID REFERENCES certificate_templates(template_id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webinar_cert_settings_webinar ON webinar_certificate_settings(webinar_id);

-- 3. Issued Certificates Table
CREATE TABLE IF NOT EXISTS issued_certificates (
    certificate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number VARCHAR(64) UNIQUE NOT NULL,
    certificate_type VARCHAR(50) NOT NULL CHECK (certificate_type IN ('course_completion', 'webinar_participation')),
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(course_id) ON DELETE CASCADE,
    webinar_id UUID REFERENCES webinars(webinar_id) ON DELETE CASCADE,
    template_id UUID REFERENCES certificate_templates(template_id) ON DELETE SET NULL,
    student_name_snapshot VARCHAR(255) NOT NULL,
    course_name_snapshot VARCHAR(255),
    webinar_name_snapshot VARCHAR(255),
    instructor_name_snapshot VARCHAR(255),
    completion_or_event_date TIMESTAMPTZ NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    certificate_file_storage_key VARCHAR(500) NOT NULL,
    verification_token_hash VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked')),
    revocation_reason TEXT,
    revoked_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    reissued_from_id UUID REFERENCES issued_certificates(certificate_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_cert_association CHECK (
        (course_id IS NOT NULL AND webinar_id IS NULL AND certificate_type = 'course_completion') OR
        (webinar_id IS NOT NULL AND course_id IS NULL AND certificate_type = 'webinar_participation')
    )
);

CREATE INDEX IF NOT EXISTS idx_issued_certs_student_id ON issued_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_course_id ON issued_certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_webinar_id ON issued_certificates(webinar_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_token_hash ON issued_certificates(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_issued_certs_status ON issued_certificates(status);
CREATE INDEX IF NOT EXISTS idx_issued_certs_cert_num ON issued_certificates(certificate_number);

-- Partial unique indexes: only one valid certificate per student for a given course or webinar
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_valid_course_cert
    ON issued_certificates(student_id, course_id)
    WHERE certificate_type = 'course_completion' AND status = 'valid';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_valid_webinar_cert
    ON issued_certificates(student_id, webinar_id)
    WHERE certificate_type = 'webinar_participation' AND status = 'valid';

-- 4. Certificate Audit Logs Table
CREATE TABLE IF NOT EXISTS certificate_audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID NOT NULL REFERENCES issued_certificates(certificate_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reason TEXT,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cert_audit_logs_cert_id ON certificate_audit_logs(certificate_id);
CREATE INDEX IF NOT EXISTS idx_cert_audit_logs_action ON certificate_audit_logs(action);

-- Seed Default Templates
INSERT INTO certificate_templates (
    template_id,
    name,
    certificate_type,
    description,
    template_configuration,
    is_default,
    status
) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'Standard Course Completion Template',
    'course_completion',
    'Default template used for all verified course completions.',
    '{
        "title": "Certificate of Completion",
        "subtitle": "This is proudly presented to",
        "statement": "for successfully completing the comprehensive course curriculum with verified achievement",
        "primaryColor": "#1E3A8A",
        "secondaryColor": "#2563EB",
        "accentColor": "#D97706",
        "footerText": "Verified & Authorized by LMS Platform",
        "showQrCode": true
    }'::jsonb,
    true,
    'active'
),
(
    '00000000-0000-0000-0000-000000000002',
    'Standard Webinar Participation Template',
    'webinar_participation',
    'Default template used for webinars that have enabled participation certificates.',
    '{
        "title": "Certificate of Participation",
        "subtitle": "This certificate is awarded to",
        "statement": "for active attendance and verified participation in the interactive webinar",
        "primaryColor": "#065F46",
        "secondaryColor": "#059669",
        "accentColor": "#F59E0B",
        "footerText": "Verified & Authorized by LMS Platform",
        "showQrCode": true
    }'::jsonb,
    true,
    'active'
)
ON CONFLICT (template_id) DO NOTHING;
