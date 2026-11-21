-- ==========================================================
-- 025: Roles & Permissions management (Phase 4 of Dynamic Module Management)
-- Rules: docs/module-access-rules.md
--
-- Super Admin edits which permissions each operational role holds (Admin, Instructor,
-- Student). The Super Admin role and the governance permissions are locked.
-- ==========================================================

-- 1. Audit trail for permission changes
CREATE TABLE IF NOT EXISTS role_permission_audit_logs (
    role_permission_audit_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    action VARCHAR(40) NOT NULL, -- 'PERMISSIONS_UPDATED'
    added_permissions TEXT[] NOT NULL DEFAULT '{}',
    removed_permissions TEXT[] NOT NULL DEFAULT '{}',
    reason TEXT NOT NULL,
    actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_role_permission_audit_role
    ON role_permission_audit_logs (role_id, created_at DESC);

-- 2. Admin can author courses (the Admin course screen offers "New Course", but ADMIN was
--    never granted courses:create / courses:edit_own). Super Admin can change this later.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.code IN ('courses:create', 'courses:edit_own')
ON CONFLICT DO NOTHING;
