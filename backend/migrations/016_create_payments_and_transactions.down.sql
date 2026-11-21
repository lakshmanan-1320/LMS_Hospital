-- ==========================================================
-- Rollback Migration: 016_create_payments_and_transactions.down.sql
-- ==========================================================

DROP TABLE IF EXISTS payment_webhooks_log CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;

