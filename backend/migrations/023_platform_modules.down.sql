ALTER TABLE permissions DROP COLUMN IF EXISTS module_key;
DROP INDEX IF EXISTS idx_module_audit_logs_module;
DROP TABLE IF EXISTS module_audit_logs;
DROP TABLE IF EXISTS module_role_access;
DROP TABLE IF EXISTS platform_modules;
