-- ==========================================================
-- Migration Rollback: 001_init_schema.down.sql
-- Safely drops all LMS tables in reverse foreign-key order
-- ==========================================================

DROP TABLE IF EXISTS email_otps CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
