-- ==========================================================
-- Migration: 007_instructor_slug.sql
-- Description: Add vanity SEO slug for Instructor Profiles (avoiding UUIDs in public URLs)
-- ==========================================================

-- 1. Add slug column to instructor_profiles
ALTER TABLE instructor_profiles
ADD COLUMN IF NOT EXISTS slug VARCHAR(120) UNIQUE;

-- 2. Index for instant slug lookups
CREATE INDEX IF NOT EXISTS idx_instructor_profiles_slug ON instructor_profiles(slug);

-- 3. Populate existing instructor profiles with clean slug from their name
UPDATE instructor_profiles ip
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(u.first_name || '-' || u.last_name), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s_-]+', '-', 'g'))
FROM users u
WHERE ip.user_id = u.user_id AND ip.slug IS NULL;

-- 4. Fallback for any records where name was blank
UPDATE instructor_profiles
SET slug = 'instructor-' || SUBSTRING(user_id::text, 1, 8)
WHERE slug IS NULL OR slug = '';

