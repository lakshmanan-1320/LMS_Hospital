-- Restore Super Admin's pre-024 permissions, the quiz/assignment permissions, and buyer-module audiences.

DELETE FROM module_role_access mra
USING roles r
WHERE mra.role_id = r.role_id AND r.name = 'SUPER_ADMIN'
  AND mra.module_key IN ('cart_checkout', 'coupons', 'refunds');

UPDATE platform_modules
SET supported_roles = array_remove(supported_roles, 'SUPER_ADMIN'), updated_at = CURRENT_TIMESTAMP
WHERE module_key IN ('cart_checkout', 'coupons', 'refunds');

INSERT INTO permissions (code, description)
VALUES ('quizzes:submit', 'Submit quizzes'), ('assignments:grade', 'Grade assignments')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r JOIN permissions p ON (
     (r.name = 'STUDENT' AND p.code = 'quizzes:submit')
  OR (r.name = 'INSTRUCTOR' AND p.code = 'assignments:grade')
  OR (r.name = 'SUPER_ADMIN' AND p.code IN (
        'admins:manage', 'assignments:grade', 'audit_logs:read', 'categories:manage', 'categories:view',
        'certificates:view', 'courses:approve', 'courses:create', 'courses:edit_own', 'courses:enroll',
        'courses:manage', 'courses:publish', 'courses:view_own', 'instructors:manage',
        'instructors:manage_own', 'media:manage', 'media:upload', 'platform:manage', 'quizzes:submit',
        'reports:view', 'users:manage'))
)
ON CONFLICT DO NOTHING;
