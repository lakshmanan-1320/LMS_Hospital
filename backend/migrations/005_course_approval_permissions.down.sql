-- ==========================================================
-- Rollback Migration: 005_course_approval_permissions.down.sql
-- Description: Revert Course Approval permissions
-- ==========================================================

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT permission_id FROM permissions WHERE code = 'courses:publish'
);

DELETE FROM permissions
WHERE code = 'courses:publish';

