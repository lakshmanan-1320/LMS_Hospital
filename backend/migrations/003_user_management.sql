
-- Migration: 003_user_management.sql
-- Description: Add User Management support
-- ==========================================================

-- 1. Soft-delete support
ALTER TABLE users
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Efficient user listing (excluding deleted accounts)
CREATE INDEX IF NOT EXISTS idx_users_active_created_at
ON users (created_at DESC)
WHERE deleted_at IS NULL;

-- 3. Efficient role-based user filtering
CREATE INDEX IF NOT EXISTS idx_user_roles_role_user
ON user_roles (role_id, user_id);

-- 4. Efficient active-user filtering
CREATE INDEX IF NOT EXISTS idx_users_active_status
ON users (is_active)
WHERE deleted_at IS NULL;
