-- Migration 013: Media Management, Published Course Replacement, and Student Progress Tracking

-- 1. ENHANCE MEDIA_ASSETS WITH AUDIO DETAILS
ALTER TABLE media_assets
    ADD COLUMN IF NOT EXISTS has_audio BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS audio_codec VARCHAR(50);

-- 2. PUBLISHED-COURSE LESSON MEDIA REPLACEMENT REQUESTS
CREATE TABLE IF NOT EXISTS lesson_media_replacement_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES course_lessons(lesson_id) ON DELETE CASCADE,
    instructor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    current_asset_id UUID REFERENCES media_assets(asset_id) ON DELETE SET NULL,
    replacement_asset_id UUID REFERENCES media_assets(asset_id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'cancelled')),
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_repl_req_course_lesson
    ON lesson_media_replacement_requests(course_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_repl_req_instructor
    ON lesson_media_replacement_requests(instructor_id);

CREATE INDEX IF NOT EXISTS idx_repl_req_status
    ON lesson_media_replacement_requests(status);

-- 3. STUDENT LESSON PROGRESS TRACKING
CREATE TABLE IF NOT EXISTS student_lesson_progress (
    progress_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES course_lessons(lesson_id) ON DELETE CASCADE,
    last_position_seconds INT NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
    max_watched_seconds INT NOT NULL DEFAULT 0 CHECK (max_watched_seconds >= 0),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_lesson_progress UNIQUE (student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_student_progress_student_course
    ON student_lesson_progress(student_id, course_id);

CREATE INDEX IF NOT EXISTS idx_student_progress_lesson
    ON student_lesson_progress(lesson_id);

-- 4. MEDIA AUDIT LOGS
CREATE TABLE IF NOT EXISTS media_audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(50) NOT NULL,
    actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    course_id UUID REFERENCES courses(course_id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES course_lessons(lesson_id) ON DELETE SET NULL,
    asset_id UUID REFERENCES media_assets(asset_id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_audit_course
    ON media_audit_logs(course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_audit_actor
    ON media_audit_logs(actor_id, created_at DESC);
