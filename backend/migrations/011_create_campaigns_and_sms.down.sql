-- ==========================================================
-- Migration Down: 011_create_campaigns_and_sms.down.sql
-- ==========================================================

DROP TABLE IF EXISTS sms_outbox CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS sms_templates CASCADE;
DROP TABLE IF EXISTS sms_configs CASCADE;

