-- ==========================================================
-- Down Migration: 007_instructor_slug.down.sql
-- ==========================================================

DROP INDEX IF EXISTS idx_instructor_profiles_slug;

ALTER TABLE instructor_profiles
DROP COLUMN IF EXISTS slug;

