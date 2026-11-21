DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.role_id AND rp.permission_id = p.permission_id
  AND r.name = 'ADMIN' AND p.code IN ('courses:create', 'courses:edit_own');

DROP INDEX IF EXISTS idx_role_permission_audit_role;
DROP TABLE IF EXISTS role_permission_audit_logs;
