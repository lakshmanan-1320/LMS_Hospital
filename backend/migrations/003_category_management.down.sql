-- ==========================================================
-- Migration: 003_category_management.down.sql
-- DOWN: Rollback categories schema
-- ==========================================================

DROP TABLE IF EXISTS categories CASCADE;

