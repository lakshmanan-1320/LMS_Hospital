-- ==========================================================
-- 023: Dynamic Module Management (Phase 1: registry + backend enforcement)
-- Rules: docs/module-access-rules.md
--
-- Module availability (this file) is separate from role permissions (role_permissions):
--   1. module enabled?  2. visible to this audience?  3. role has permission?  4. owns the record?
-- ==========================================================

-- 1. PLATFORM_MODULES: one row per platform module
CREATE TABLE IF NOT EXISTS platform_modules (
    module_key VARCHAR(60) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    module_group VARCHAR(30) NOT NULL
        CHECK (module_group IN ('governance', 'public', 'learning', 'teaching', 'operations')),
    lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (lifecycle_status IN ('active', 'coming_soon')),
    is_core BOOLEAN NOT NULL DEFAULT FALSE,         -- always on, audiences fixed
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    supports_public BOOLEAN NOT NULL DEFAULT FALSE, -- has a public-website audience
    public_visible BOOLEAN NOT NULL DEFAULT FALSE,
    supported_roles TEXT[] NOT NULL DEFAULT '{}',   -- roles whose visibility can be configured
    depends_on TEXT[] NOT NULL DEFAULT '{}',        -- module_keys that must be enabled first
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_core_always_enabled CHECK (NOT is_core OR is_enabled),
    CONSTRAINT chk_coming_soon_disabled CHECK (lifecycle_status <> 'coming_soon' OR NOT is_enabled),
    CONSTRAINT chk_public_supported CHECK (supports_public OR NOT public_visible)
);

-- 2. MODULE_ROLE_ACCESS: per-role visibility of a module (no per-user overrides)
CREATE TABLE IF NOT EXISTS module_role_access (
    module_key VARCHAR(60) NOT NULL REFERENCES platform_modules(module_key) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (module_key, role_id)
);

-- 3. MODULE_AUDIT_LOGS: every change, with before/after and the reason given
CREATE TABLE IF NOT EXISTS module_audit_logs (
    module_audit_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_key VARCHAR(60) NOT NULL REFERENCES platform_modules(module_key) ON DELETE CASCADE,
    action VARCHAR(40) NOT NULL, -- 'MODULE_UPDATED'
    previous_state JSONB NOT NULL,
    new_state JSONB NOT NULL,
    reason TEXT NOT NULL,
    actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_module_audit_logs_module ON module_audit_logs (module_key, created_at DESC);

-- 4. Group permissions by module (used by the future Roles & Permissions screen)
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS module_key VARCHAR(60)
    REFERENCES platform_modules(module_key) ON DELETE SET NULL;

-- ==========================================================
-- SEED: defaults mirror today's behaviour exactly (no access changes on deploy)
-- ==========================================================
INSERT INTO platform_modules
    (module_key, name, description, module_group, lifecycle_status, is_core, is_enabled,
     supports_public, public_visible, supported_roles, depends_on, sort_order)
VALUES
    -- Governance (Super Admin), core
    ('platform_settings', 'Platform Settings', 'Refund policy and general platform settings.', 'governance', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 10),
    ('integrations', 'Integrations', 'Payment, email, SMS, WhatsApp and meeting provider configuration.', 'governance', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 20),
    ('module_management', 'Module Management', 'Enable or disable platform modules and their audiences.', 'governance', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 30),
    ('roles_permissions', 'Roles & Permissions', 'Define what each role is allowed to do.', 'governance', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 40),
    ('audit_logs', 'Audit Logs', 'Platform audit trail.', 'governance', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 50),
    ('admin_accounts', 'Admin Accounts', 'Create and deactivate Admin users.', 'governance', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 60),

    -- Platform core
    ('auth', 'Authentication', 'Sign up, login, password reset.', 'public', 'active', TRUE, TRUE, TRUE, TRUE, '{}', '{}', 100),
    ('course_catalog', 'Course Catalog & Search', 'Public course catalog, search and course pages.', 'public', 'active', TRUE, TRUE, TRUE, TRUE, '{}', '{}', 110),
    ('categories', 'Categories', 'Course categories.', 'public', 'active', TRUE, TRUE, TRUE, TRUE, '{}', '{}', 120),
    ('learning', 'My Learning & Course Player', 'Enrolled courses, player, progress and resources. Paid access is never blocked.', 'learning', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 200),
    ('payments', 'Payments', 'Razorpay payment verification and webhooks.', 'learning', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 210),
    ('orders', 'Orders & Invoices', 'Orders, checkout completion and invoices.', 'learning', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 220),
    ('teaching', 'Teaching Workspace', 'Course authoring and approval, curriculum and media, instructor own profile.', 'teaching', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 300),
    ('user_management', 'User Management', 'Admin manages Students and Instructors.', 'operations', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 400),
    ('enrollments', 'Enrollments', 'Enrollment management.', 'operations', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 410),
    ('dashboard', 'Dashboard Overview', 'Role dashboards overview.', 'operations', 'active', TRUE, TRUE, FALSE, FALSE, '{}', '{}', 420),

    -- Toggleable, active
    ('instructor_profiles', 'Instructor Profiles', 'Public instructor directory and profile pages.', 'public', 'active', FALSE, TRUE, TRUE, TRUE, '{INSTRUCTOR,ADMIN}', '{}', 130),
    ('webinars', 'Live Webinars', 'Public webinars, registration, hosting and management.', 'public', 'active', FALSE, TRUE, TRUE, TRUE, '{INSTRUCTOR,ADMIN}', '{}', 140),
    ('cart_checkout', 'Cart & Checkout', 'Cart and starting new purchases. Turning it off pauses sales; payments in progress still complete.', 'learning', 'active', FALSE, TRUE, TRUE, TRUE, '{STUDENT,INSTRUCTOR,ADMIN}', '{}', 230),
    ('coupons', 'Coupons & Discounts', 'Platform and instructor coupons, applying coupons at checkout.', 'learning', 'active', FALSE, TRUE, FALSE, FALSE, '{STUDENT,INSTRUCTOR,ADMIN}', '{cart_checkout}', 240),
    ('refunds', 'Refunds', 'Refund requests and review.', 'learning', 'active', FALSE, TRUE, FALSE, FALSE, '{STUDENT,INSTRUCTOR,ADMIN}', '{}', 250),
    ('instructor_students', 'Instructor Students', 'Instructors see learners in their courses.', 'teaching', 'active', FALSE, TRUE, FALSE, FALSE, '{INSTRUCTOR}', '{}', 310),
    ('instructor_performance', 'Instructor Performance', 'Instructor course statistics.', 'teaching', 'active', FALSE, TRUE, FALSE, FALSE, '{INSTRUCTOR}', '{}', 320),
    ('sms_campaigns', 'SMS Campaigns', 'Bulk SMS campaigns.', 'operations', 'active', FALSE, TRUE, FALSE, FALSE, '{ADMIN}', '{}', 430),
    ('email_campaigns', 'Email Campaigns', 'Bulk email campaigns.', 'operations', 'active', FALSE, TRUE, FALSE, FALSE, '{ADMIN}', '{}', 440),
    ('whatsapp_campaigns', 'WhatsApp Campaigns', 'WhatsApp campaigns.', 'operations', 'active', FALSE, TRUE, FALSE, FALSE, '{ADMIN}', '{}', 450),
    ('reports', 'Reports', 'Platform reports and analytics.', 'operations', 'active', FALSE, TRUE, FALSE, FALSE, '{ADMIN}', '{}', 460),

    -- Coming soon: registered, disabled, cannot be enabled until built
    ('reviews_ratings', 'Reviews & Ratings', 'Course reviews and ratings.', 'learning', 'coming_soon', FALSE, FALSE, TRUE, FALSE, '{STUDENT,INSTRUCTOR,ADMIN}', '{}', 260),
    ('certificates', 'Certificates', 'Certificates of completion and verification.', 'learning', 'coming_soon', FALSE, FALSE, TRUE, FALSE, '{STUDENT,ADMIN}', '{}', 270),
    ('wishlist', 'Wishlist', 'Save courses for later.', 'learning', 'coming_soon', FALSE, FALSE, FALSE, FALSE, '{STUDENT,INSTRUCTOR}', '{}', 280),
    ('notifications', 'Notifications', 'In-app notifications.', 'learning', 'coming_soon', FALSE, FALSE, FALSE, FALSE, '{STUDENT,INSTRUCTOR,ADMIN}', '{}', 290),
    ('instructor_earnings', 'Instructor Earnings', 'Earnings report for instructors (no payouts).', 'teaching', 'coming_soon', FALSE, FALSE, FALSE, FALSE, '{INSTRUCTOR,ADMIN}', '{}', 330)
ON CONFLICT (module_key) DO NOTHING;

-- Role visibility: every supported role visible by default (matches today's access)
INSERT INTO module_role_access (module_key, role_id, is_visible)
SELECT m.module_key, r.role_id, TRUE
FROM platform_modules m
JOIN roles r ON r.name = ANY (m.supported_roles)
ON CONFLICT (module_key, role_id) DO NOTHING;

-- Map existing permission codes to modules
UPDATE permissions SET module_key = CASE
    WHEN code IN ('courses:approve', 'courses:create', 'courses:edit_own', 'courses:manage',
                  'courses:publish', 'courses:view_own', 'media:manage', 'media:upload',
                  'instructors:manage_own') THEN 'teaching'
    WHEN code = 'courses:enroll' THEN 'learning'
    WHEN code LIKE 'categories:%' THEN 'categories'
    WHEN code LIKE 'webinars:%' THEN 'webinars'
    WHEN code = 'instructors:manage' THEN 'instructor_profiles'
    WHEN code = 'users:manage' THEN 'user_management'
    WHEN code = 'admins:manage' THEN 'admin_accounts'
    WHEN code = 'platform:manage' THEN 'platform_settings'
    WHEN code = 'audit_logs:read' THEN 'audit_logs'
    WHEN code = 'reports:view' THEN 'reports'
    WHEN code = 'certificates:view' THEN 'certificates'
    ELSE module_key -- quizzes:submit / assignments:grade stay unmapped (out of scope, removed in Phase 2)
END
WHERE module_key IS NULL;
