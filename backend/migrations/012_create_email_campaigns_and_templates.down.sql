-- Down Migration: 012_create_email_campaigns_and_templates.down.sql

DROP TABLE IF EXISTS email_outbox;
ALTER TABLE campaigns DROP COLUMN IF EXISTS email_template_id;
DROP TABLE IF EXISTS email_templates;
DROP TABLE IF EXISTS email_configs;

