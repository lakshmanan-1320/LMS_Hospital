-- Migration: 022_course_refund_settings.down.sql
ALTER TABLE courses
    DROP COLUMN IF EXISTS is_refundable,
    DROP COLUMN IF EXISTS refund_period_days;

