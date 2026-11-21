-- ==========================================================
-- Migration: 022_course_refund_settings.sql
-- Description: Dynamic course refund settings (Udemy-style) allowing instructors & admins
-- to configure refund eligibility and guarantee period per course.
-- ==========================================================

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS is_refundable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS refund_period_days INT NOT NULL DEFAULT 30 CHECK (refund_period_days >= 0);

COMMENT ON COLUMN courses.is_refundable IS 'Whether students can request a refund for this course (default true, configurable by instructor/admin)';
COMMENT ON COLUMN courses.refund_period_days IS 'Number of days from purchase during which refunds are allowed (e.g. 30, 14, 7). 0 = non-refundable.';

