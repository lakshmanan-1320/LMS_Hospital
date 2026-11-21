-- Rollback Certificate Management Schema Migration
DROP TABLE IF EXISTS certificate_audit_logs CASCADE;
DROP TABLE IF EXISTS issued_certificates CASCADE;
DROP TABLE IF EXISTS webinar_certificate_settings CASCADE;
DROP TABLE IF EXISTS certificate_templates CASCADE;
