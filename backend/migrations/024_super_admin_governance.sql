-- ==========================================================
-- 024: Super Admin is governance-only (Phase 2 of Dynamic Module Management)
-- Rules: docs/module-access-rules.md
--
-- Super Admin keeps: settings, integrations, module management, roles & permissions,
-- audit logs, admin accounts. Day-to-day operations (orders, refunds, coupons, enrollments,
-- courses, curriculum, campaign sending) belong to Admin.
-- Super Admin can still buy courses like any account (cart, coupons at checkout, own refunds).
-- ==========================================================

-- 1. Super Admin keeps governance permissions only
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.role_id
  AND rp.permission_id = p.permission_id
  AND r.name = 'SUPER_ADMIN'
  AND p.code NOT IN ('admins:manage', 'audit_logs:read', 'platform:manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'SUPER_ADMIN'
  AND p.code IN ('admins:manage', 'audit_logs:read', 'platform:manage')
ON CONFLICT DO NOTHING;

-- 2. Quizzes and assignments are out of scope: remove their unused permissions
DELETE FROM permissions WHERE code IN ('quizzes:submit', 'assignments:grade');

-- 3. Super Admin as a buyer: cart & checkout, applying coupons, requesting own refunds
UPDATE platform_modules
SET supported_roles = array_append(supported_roles, 'SUPER_ADMIN'), updated_at = CURRENT_TIMESTAMP
WHERE module_key IN ('cart_checkout', 'coupons', 'refunds')
  AND NOT ('SUPER_ADMIN' = ANY (supported_roles));

INSERT INTO module_role_access (module_key, role_id, is_visible)
SELECT m.module_key, r.role_id, TRUE
FROM platform_modules m JOIN roles r ON r.name = 'SUPER_ADMIN'
WHERE m.module_key IN ('cart_checkout', 'coupons', 'refunds')
ON CONFLICT (module_key, role_id) DO NOTHING;
