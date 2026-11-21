-- ==========================================================
-- Migration Rollback: 015_create_coupons_management.down.sql
-- ==========================================================

ALTER TABLE carts DROP COLUMN IF EXISTS applied_coupon_id;
DROP TABLE IF EXISTS coupon_usages CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;

