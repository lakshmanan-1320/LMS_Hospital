-- ==========================================================
-- Migration: 004_course_core.down.sql
-- DOWN: Rollback shared course core schema
-- ==========================================================

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT permission_id FROM permissions
    WHERE code IN ('media:upload', 'media:manage', 'courses:view_own', 'courses:manage')
);
DELETE FROM permissions WHERE code IN ('media:upload', 'media:manage', 'courses:view_own', 'courses:manage');

DROP TABLE IF EXISTS lesson_resources CASCADE;
DROP TABLE IF EXISTS course_lessons CASCADE;
DROP TABLE IF EXISTS course_sections CASCADE;
ALTER TABLE IF EXISTS courses DROP COLUMN IF EXISTS promo_video_asset_id;
DROP TABLE IF EXISTS media_assets CASCADE;
DROP TABLE IF EXISTS course_status_history CASCADE;
DROP TABLE IF EXISTS course_languages CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
