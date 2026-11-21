INSERT INTO platform_modules
    (module_key, name, description, module_group, lifecycle_status, is_core, is_enabled,
     supports_public, public_visible, supported_roles, audience_roles, depends_on, sort_order)
VALUES
    ('auth', 'Authentication', 'Sign up, login, password reset.', 'public', 'active', TRUE, TRUE, TRUE, TRUE,
     '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}', '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}', '{}', 100)
ON CONFLICT (module_key) DO NOTHING;

INSERT INTO module_role_access (module_key, role_id, is_visible)
SELECT 'auth', r.role_id, TRUE FROM roles r
WHERE r.name IN ('STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN')
ON CONFLICT (module_key, role_id) DO NOTHING;
