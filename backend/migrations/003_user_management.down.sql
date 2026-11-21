
-- ==========================================================
-- Rollback: 003_user_management.sql
-- ==========================================================

DROP INDEX IF EXISTS idx_users_active_status;
DROP INDEX IF EXISTS idx_user_roles_role_user;
DROP INDEX IF EXISTS idx_users_active_created_at;

ALTER TABLE users
DROP COLUMN IF EXISTS deleted_at;
