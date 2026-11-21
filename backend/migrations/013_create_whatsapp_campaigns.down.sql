-- ==========================================================
-- Migration Rollback: 013_create_whatsapp_campaigns.down.sql
-- ==========================================================

DROP TABLE IF EXISTS whatsapp_outbox CASCADE;

ALTER TABLE campaigns DROP COLUMN IF EXISTS whatsapp_template_id;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_channel_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_channel_check CHECK (channel IN ('sms', 'email'));

DROP TABLE IF EXISTS whatsapp_templates CASCADE;
DROP TABLE IF EXISTS whatsapp_configs CASCADE;

