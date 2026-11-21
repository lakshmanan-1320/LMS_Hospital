-- ==========================================================
-- Migration: 001_init_schema.sql
-- Description: Complete Unified LMS Baseline & Auth Schema
-- Meaningful IDs (user_id, role_id, permission_id, email_otp_id, etc.)
-- Strictly Native PostgreSQL (No ORM)
-- ==========================================================

-- Enable standard UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROLES TABLE (role_id)
CREATE TABLE IF NOT EXISTS roles (
    role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. PERMISSIONS TABLE (permission_id)
CREATE TABLE IF NOT EXISTS permissions (
    permission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. ROLE_PERMISSIONS TABLE (Composite PK: role_id, permission_id)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. USERS TABLE (user_id)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. USER_ROLES TABLE (Composite PK: user_id, role_id)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- 6. REFRESH_TOKENS TABLE (refresh_token_id)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    refresh_token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    replaced_by_hash VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. PASSWORD_RESET_TOKENS TABLE (password_reset_token_id)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    password_reset_token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. EMAIL_OTPS TABLE (email_otp_id)
CREATE TABLE IF NOT EXISTS email_otps (
    email_otp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'EMAIL_VERIFICATION',
    attempts INTEGER DEFAULT 0,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- INDEXES
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_otps_lookup ON email_otps(LOWER(email), purpose, is_used);
CREATE INDEX IF NOT EXISTS idx_email_otps_hash ON email_otps(otp_hash);

-- ==========================================================
-- IDEMPOTENT SEED DATA: ROLES & PERMISSIONS
-- ==========================================================
INSERT INTO roles (name, description) VALUES
    ('SUPER_ADMIN', 'Platform owner with full system-wide permissions'),
    ('ADMIN', 'Institute/organization administrator managing courses and instructors'),
    ('INSTRUCTOR', 'Course author who creates content, curriculum, and grades students'),
    ('STUDENT', 'Enrolled learner accessing courses, quizzes, and certificates')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (code, description) VALUES
    ('platform:manage', 'Manage system settings, global configs, and maintenance'),
    ('admins:manage', 'Create, update, and manage Admin accounts'),
    ('audit_logs:read', 'Read system and security audit logs'),
    ('users:manage', 'Manage instructor and student accounts'),
    ('courses:approve', 'Approve and publish courses submitted by instructors'),
    ('categories:manage', 'Manage LMS departments, tracks, and categories'),
    ('reports:view', 'View enrollment and revenue analytics'),
    ('courses:create', 'Create and author courses and lessons'),
    ('courses:edit_own', 'Edit own courses, curriculum, and assignments'),
    ('assignments:grade', 'Grade student assignments and quizzes'),
    ('courses:enroll', 'Enroll in published courses'),
    ('quizzes:submit', 'Take quizzes and submit assignments'),
    ('certificates:view', 'View and download earned certificates')
ON CONFLICT (code) DO NOTHING;

-- Map Permissions to Roles
-- SUPER_ADMIN: All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- ADMIN: Management permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.code IN (
    'users:manage',
    'courses:approve',
    'categories:manage',
    'reports:view'
)
ON CONFLICT DO NOTHING;

-- INSTRUCTOR: Teaching permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r, permissions p
WHERE r.name = 'INSTRUCTOR' AND p.code IN (
    'courses:create',
    'courses:edit_own',
    'assignments:grade'
)
ON CONFLICT DO NOTHING;

-- STUDENT: Learning permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r, permissions p
WHERE r.name = 'STUDENT' AND p.code IN (
    'courses:enroll',
    'quizzes:submit',
    'certificates:view'
)
ON CONFLICT DO NOTHING;

-- ==========================================================
-- IDEMPOTENT SEED DATA: SUPER ADMIN & ADMIN (PRE-HASHED BCRYPT)
-- One-way bcrypt hash (Cost: 12)
-- Plaintext password is NEVER stored in database or source code!
-- ==========================================================

-- 1. Seed Super Admin (Pre-verified)
INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
VALUES (
    'superadmin@insighttech.in',
    '$2b$12$/zMb3zELtZvdbUdI5qjxYenIrMvSFGgLrgbNTCKvtLnoBdpe9YNeG',
    'Super',
    'Admin',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    is_verified = TRUE,
    updated_at = CURRENT_TIMESTAMP;

-- Assign SUPER_ADMIN role
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.email = 'superadmin@insighttech.in' AND r.name = 'SUPER_ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 2. Seed Admin (Pre-verified)
INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
VALUES (
    'admin@insighttech.in',
    '$2b$12$/zMb3zELtZvdbUdI5qjxYenIrMvSFGgLrgbNTCKvtLnoBdpe9YNeG',
    'System',
    'Admin',
    TRUE,
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = TRUE,
    is_verified = TRUE,
    updated_at = CURRENT_TIMESTAMP;

-- Assign ADMIN role
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.email = 'admin@insighttech.in' AND r.name = 'ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;
