-- ==========================================================
-- Migration Rollback: 014_create_cart_management.down.sql
-- ==========================================================

DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;

