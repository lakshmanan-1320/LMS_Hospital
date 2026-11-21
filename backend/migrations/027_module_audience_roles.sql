-- ==========================================================
-- 027: Which roles each module serves at all (informational, for the Module Management screen)
--
-- supported_roles = roles whose visibility Super Admin can switch (toggleable modules)
-- audience_roles  = every role that uses the module (incl. core modules, which are always on)
-- A role in neither list doesn't use the module (e.g. SMS Campaigns for Students).
-- ==========================================================
ALTER TABLE platform_modules ADD COLUMN IF NOT EXISTS audience_roles TEXT[] NOT NULL DEFAULT '{}';

UPDATE platform_modules SET audience_roles = CASE module_key
    -- Governance: Super Admin only
    WHEN 'platform_settings' THEN '{SUPER_ADMIN,ADMIN}'   -- refund policy is shared with Admin
    WHEN 'integrations' THEN '{SUPER_ADMIN}'
    WHEN 'module_management' THEN '{SUPER_ADMIN}'
    WHEN 'roles_permissions' THEN '{SUPER_ADMIN}'
    WHEN 'audit_logs' THEN '{SUPER_ADMIN}'
    WHEN 'admin_accounts' THEN '{SUPER_ADMIN}'
    -- Core, every signed-in account
    WHEN 'auth' THEN '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}'
    WHEN 'course_catalog' THEN '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}'
    WHEN 'categories' THEN '{STUDENT,INSTRUCTOR,ADMIN}'
    WHEN 'learning' THEN '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}'
    WHEN 'payments' THEN '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}'
    WHEN 'orders' THEN '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}'
    WHEN 'dashboard' THEN '{STUDENT,INSTRUCTOR,ADMIN,SUPER_ADMIN}'
    -- Core, role-specific
    WHEN 'teaching' THEN '{INSTRUCTOR,ADMIN}'
    WHEN 'user_management' THEN '{ADMIN,SUPER_ADMIN}'
    WHEN 'enrollments' THEN '{INSTRUCTOR,ADMIN}'
    -- Toggleable: the roles that can be shown the module
    ELSE supported_roles
END;
