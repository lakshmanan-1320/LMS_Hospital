-- ==========================================================
-- 028: Fully dynamic modules
-- Super Admin can turn any module on/off and show/hide it for any role from Module Management.
-- Only two safety locks remain, enforced in code (PlatformModulesService):
--   * auth:              always on and visible to everyone (otherwise nobody can log in)
--   * module_management: always on and visible to Super Admin (so changes can always be undone)
-- is_core is kept as an "essential" hint for warnings in the UI; it no longer locks anything.
-- Starting visibility mirrors today's access exactly (no behaviour change on deploy).
-- ==========================================================

-- 1. Core modules may now be turned off (safety locks are enforced in code)
ALTER TABLE platform_modules DROP CONSTRAINT IF EXISTS chk_core_always_enabled;

-- 2. Correct who uses each core module (verified against controllers)
UPDATE platform_modules SET audience_roles = '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}'
WHERE module_key IN ('enrollments', 'categories');            -- buyers enroll and list their enrollments
UPDATE platform_modules SET audience_roles = '{SUPER_ADMIN,ADMIN}'
WHERE module_key = 'integrations';                             -- Admin connects meeting accounts, SMS templates

-- 3. Course preview pages for visitors belong to "My Learning & Course Player"
UPDATE platform_modules SET supports_public = TRUE, public_visible = TRUE
WHERE module_key = 'learning';

-- 4. Every module can be configured for every role
UPDATE platform_modules SET supported_roles = '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}', updated_at = CURRENT_TIMESTAMP;

-- 5. Visibility rows for every module x role. Existing rows are kept; new rows start visible
--    only for roles that use the module today (other roles were already refused by role checks).
INSERT INTO module_role_access (module_key, role_id, is_visible)
SELECT m.module_key, r.role_id, (r.name = ANY (m.audience_roles))
FROM platform_modules m
CROSS JOIN roles r
WHERE r.name IN ('STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN')
ON CONFLICT (module_key, role_id) DO NOTHING;

-- 6. Safety locks hold from the start
UPDATE platform_modules SET is_enabled = TRUE, public_visible = TRUE WHERE module_key = 'auth';
UPDATE platform_modules SET is_enabled = TRUE WHERE module_key = 'module_management';
UPDATE module_role_access mra SET is_visible = TRUE
FROM roles r
WHERE mra.role_id = r.role_id
  AND (mra.module_key = 'auth' OR (mra.module_key = 'module_management' AND r.name = 'SUPER_ADMIN'));
