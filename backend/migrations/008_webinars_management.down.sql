-- ==========================================================
-- Migration Down: 008_webinars_management.down.sql
-- Description: Revert Webinars and Live Sessions Management Schema
-- ==========================================================

-- Remove webinar permissions mapping from roles
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT permission_id FROM permissions
    WHERE code IN ('webinars:create', 'webinars:manage', 'webinars:read_all')
);

-- Delete permissions
DELETE FROM permissions
WHERE code IN ('webinars:create', 'webinars:manage', 'webinars:read_all');

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS webinar_webhook_events CASCADE;
DROP TABLE IF EXISTS webinar_audit_logs CASCADE;
DROP TABLE IF EXISTS webinar_attendances CASCADE;
DROP TABLE IF EXISTS webinar_registrations CASCADE;
DROP TABLE IF EXISTS webinar_hosts CASCADE;
DROP TABLE IF EXISTS webinars CASCADE;

