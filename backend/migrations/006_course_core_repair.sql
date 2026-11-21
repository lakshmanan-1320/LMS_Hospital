-- Migration 006: Repair missing Course Core objects.
-- Idempotent repair; preserves existing course data.

CREATE TABLE IF NOT EXISTS course_languages (
    language_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO course_languages
    (code, name, native_name, is_default, display_order, is_active)
VALUES
    ('en', 'English', 'English', TRUE, 1, TRUE),
    ('ta', 'Tamil', 'தமிழ்', FALSE, 2, TRUE),
    ('hi', 'Hindi', 'हिन्दी', FALSE, 3, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, description)
VALUES
    ('courses:view_own', 'List and view own courses, stats, and checklist'),
    ('courses:manage', 'Admin access: view and edit any course without ownership check')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE
    (r.name = 'ADMIN' AND p.code IN ('courses:view_own', 'courses:manage'))
    OR (r.name = 'INSTRUCTOR' AND p.code = 'courses:view_own')
    OR (r.name = 'SUPER_ADMIN' AND p.code IN ('courses:view_own', 'courses:manage'))
ON CONFLICT DO NOTHING;
