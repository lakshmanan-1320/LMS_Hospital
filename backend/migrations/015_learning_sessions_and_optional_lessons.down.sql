-- Migration 015: Student Learning Sessions, Activity Tracking & Optional Lessons
-- Down migration

DROP TABLE IF EXISTS student_learning_sessions CASCADE;

ALTER TABLE course_lessons
DROP COLUMN IF EXISTS is_optional;
