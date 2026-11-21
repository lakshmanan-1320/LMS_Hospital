-- Migration 026: Course Reviews and Ratings Module
-- Down migration

-- 1. Revert platform module status
UPDATE platform_modules
SET lifecycle_status = 'coming_soon',
    is_enabled = FALSE,
    public_visible = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE module_key = 'reviews_ratings';

-- 2. Delete role permissions
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT permission_id FROM permissions
    WHERE code IN ('reviews:create', 'reviews:reply', 'reviews:moderate')
);

-- 3. Delete permissions
DELETE FROM permissions
WHERE code IN ('reviews:create', 'reviews:reply', 'reviews:moderate');

-- 4. Drop caching columns from courses
ALTER TABLE courses
    DROP COLUMN IF EXISTS average_rating,
    DROP COLUMN IF EXISTS total_reviews_count;

-- 5. Drop course_review_replies and course_reviews tables
DROP TABLE IF EXISTS course_review_replies CASCADE;
DROP TABLE IF EXISTS course_reviews CASCADE;
