-- Rollback for 019_enhance_coupons_udemy_style.sql
DROP INDEX IF EXISTS idx_coupons_created_by;
DROP INDEX IF EXISTS idx_coupons_scope;
DROP INDEX IF EXISTS idx_coupons_course_id;

ALTER TABLE coupons
    DROP COLUMN IF EXISTS course_id,
    DROP COLUMN IF EXISTS scope;

