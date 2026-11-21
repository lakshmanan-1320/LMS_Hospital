-- Down migration 013

DROP TABLE IF EXISTS media_audit_logs CASCADE;
DROP TABLE IF EXISTS student_lesson_progress CASCADE;
DROP TABLE IF EXISTS lesson_media_replacement_requests CASCADE;

ALTER TABLE media_assets
    DROP COLUMN IF EXISTS has_audio,
    DROP COLUMN IF EXISTS audio_codec;
