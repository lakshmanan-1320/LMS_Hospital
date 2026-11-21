-- Migration: 002_auth_schema.down.sql
-- DOWN (Rollback)

DROP TABLE IF EXISTS email_otps CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
