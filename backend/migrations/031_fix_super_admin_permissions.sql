-- ==========================================================
-- 031: Restore Super Admin to its governance permissions.
-- Migration 026 (course reviews) granted SUPER_ADMIN every permission. That file is fixed for new
-- installs; this corrects databases where it already ran. The Super Admin role is locked in
-- Roles & Permissions, so it can't legitimately hold anything else.
-- ==========================================================
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.role_id
  AND rp.permission_id = p.permission_id
  AND r.name = 'SUPER_ADMIN'
  AND p.code NOT IN ('admins:manage', 'audit_logs:read', 'platform:manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'SUPER_ADMIN' AND p.code IN ('admins:manage', 'audit_logs:read', 'platform:manage')
ON CONFLICT DO NOTHING;
