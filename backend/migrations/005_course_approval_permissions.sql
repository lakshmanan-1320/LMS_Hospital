-- ==========================================================
-- Migration: 005_course_approval_permissions.sql
-- Description: Course Approval (Module 7) permissions and role mappings
-- Strictly Native PostgreSQL (No ORM)
-- ==========================================================

-- 1. Insert courses:publish permission
INSERT INTO permissions (code, description) VALUES
    ('courses:publish', 'Publish, archive, restore and feature courses')
ON CONFLICT (code) DO NOTHING;

-- 2. Map courses:publish and courses:approve to ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'ADMIN'
  AND p.code IN ('courses:approve', 'courses:publish')
ON CONFLICT DO NOTHING;

-- 3. Map courses:publish, courses:approve, courses:edit_own, courses:view_own to SUPER_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'SUPER_ADMIN'
  AND p.code IN ('courses:approve', 'courses:publish', 'courses:edit_own', 'courses:view_own')
ON CONFLICT DO NOTHING;

-- 4. Ensure INSTRUCTOR has courses:edit_own and courses:view_own
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.name = 'INSTRUCTOR'
  AND p.code IN ('courses:edit_own', 'courses:view_own')
ON CONFLICT DO NOTHING;

