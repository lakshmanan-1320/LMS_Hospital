-- ==========================================================
-- Migration: 019_enhance_coupons_udemy_style.sql
-- Description: Adds course_id and scope to support Udemy-style 
--              self-service instructor coupons & platform promotions
-- Follows strict LMS PostgreSQL conventions: No ORM, snake_case
-- ==========================================================

-- 1. ADD course_id AND scope TO coupons TABLE
ALTER TABLE coupons
    ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(course_id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'platform'
        CHECK (scope IN ('platform', 'course'));

-- 2. CREATE PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_coupons_course_id ON coupons(course_id);
CREATE INDEX IF NOT EXISTS idx_coupons_scope ON coupons(scope);
CREATE INDEX IF NOT EXISTS idx_coupons_created_by ON coupons(created_by);

