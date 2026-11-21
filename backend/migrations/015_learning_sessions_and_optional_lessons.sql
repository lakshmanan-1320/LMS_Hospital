-- Migration 015: Student Learning Sessions, Activity Tracking & Optional Lessons
-- Up migration

-- 1. Add is_optional column to course_lessons if not exists
ALTER TABLE course_lessons
ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create student_learning_sessions table for tracking actual watch sessions
CREATE TABLE IF NOT EXISTS student_learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES course_lessons(lesson_id) ON DELETE CASCADE,
  session_id VARCHAR(64) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  seconds_watched INTEGER NOT NULL DEFAULT 0 CHECK (seconds_watched >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes for fast query performance and aggregation
CREATE INDEX IF NOT EXISTS idx_learning_sessions_student_date
ON student_learning_sessions (student_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_course
ON student_learning_sessions (course_id);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_lesson
ON student_learning_sessions (lesson_id);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_lookup
ON student_learning_sessions (student_id, lesson_id, session_id);
