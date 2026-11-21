-- ==========================================================
-- Rollback Migration: 018_create_refunds_and_audit_logs.down.sql
-- ==========================================================

DROP TABLE IF EXISTS financial_audit_logs CASCADE;
DROP TABLE IF EXISTS order_refunds CASCADE;

