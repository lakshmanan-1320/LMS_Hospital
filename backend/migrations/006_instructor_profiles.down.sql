-- ==========================================================
-- Down Migration: 006_instructor_profiles.down.sql
-- Description: Rollback Instructor Profile module and strictly its permissions
-- ==========================================================

-- 1. Drop instructor_profiles table
DROP TABLE IF EXISTS instructor_profiles CASCADE;

-- 2. Remove role_permissions mappings introduced by this module only
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT permission_id FROM permissions WHERE code IN ('instructors:manage_own', 'instructors:manage')
);

-- 3. Remove permissions introduced by this module only
DELETE FROM permissions
WHERE code IN ('instructors:manage_own', 'instructors:manage');

