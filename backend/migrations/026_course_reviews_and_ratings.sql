-- Migration 026: Course Reviews and Ratings Module
-- Up migration

-- 1. Create course_reviews table
CREATE TABLE IF NOT EXISTS course_reviews (
    review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_title VARCHAR(150),
    review_text TEXT,

    status VARCHAR(20) NOT NULL DEFAULT 'published'
        CHECK (status IN ('published', 'hidden', 'flagged')),
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,

    -- Admin moderation
    moderation_reason TEXT,
    moderated_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    moderated_at TIMESTAMPTZ,

    -- Audit timestamps and soft deletion
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,

    -- Exactly one review per student per course
    CONSTRAINT uq_course_reviews_student_course UNIQUE (course_id, student_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_course_reviews_course_status
    ON course_reviews(course_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_course_reviews_student
    ON course_reviews(student_id);

CREATE INDEX IF NOT EXISTS idx_course_reviews_rating
    ON course_reviews(course_id, rating);

CREATE INDEX IF NOT EXISTS idx_course_reviews_created_at
    ON course_reviews(course_id, created_at DESC);

-- 2. Create course_review_replies table (Instructors/Admin replying to reviews)
CREATE TABLE IF NOT EXISTS course_review_replies (
    review_reply_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES course_reviews(review_id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    instructor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

    reply_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published'
        CHECK (status IN ('published', 'hidden')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Exactly one official instructor reply per review
    CONSTRAINT uq_course_review_replies_review UNIQUE (review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_replies_review
    ON course_review_replies(review_id);

CREATE INDEX IF NOT EXISTS idx_review_replies_instructor
    ON course_review_replies(instructor_id);

CREATE INDEX IF NOT EXISTS idx_review_replies_course
    ON course_review_replies(course_id);

-- 3. Add rating aggregation caching columns to courses table
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_reviews_count INT NOT NULL DEFAULT 0;

-- 4. Register new Permissions for Reviews & Ratings
INSERT INTO permissions (code, description, module_key) VALUES
    ('reviews:create', 'Submit ratings and reviews for enrolled courses', 'reviews_ratings'),
    ('reviews:reply', 'Reply to reviews on own authored courses', 'reviews_ratings'),
    ('reviews:moderate', 'Moderate, hide, restore, and delete course reviews platform-wide', 'reviews_ratings')
ON CONFLICT (code) DO UPDATE SET module_key = EXCLUDED.module_key;

-- Map permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE (r.name = 'STUDENT' AND p.code = 'reviews:create')
   OR (r.name = 'INSTRUCTOR' AND p.code = 'reviews:reply')
   OR (r.name = 'ADMIN' AND p.code IN ('reviews:moderate', 'reviews:reply'))
ON CONFLICT DO NOTHING;
-- Super Admin gets none: who may moderate/reply is decided in Roles & Permissions.

-- 5. Activate platform module in platform_modules registry
UPDATE platform_modules
SET lifecycle_status = 'active',
    is_enabled = TRUE,
    supports_public = TRUE,
    public_visible = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE module_key = 'reviews_ratings';

-- Ensure role visibility entries are set
INSERT INTO module_role_access (module_key, role_id, is_visible)
SELECT 'reviews_ratings', r.role_id, TRUE
FROM roles r
WHERE r.name IN ('STUDENT', 'INSTRUCTOR', 'ADMIN')
ON CONFLICT (module_key, role_id) DO UPDATE SET is_visible = TRUE;
