-- Migration 014: Enrollment Management and Post-Publication Course Enhancements

-- 1. ENHANCE COURSE_ENROLLMENTS STATUS AND TYPES
ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_enrollment_status_check;

ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_enrollment_status_check
    CHECK (enrollment_status IN ('active', 'completed', 'cancelled', 'suspended'));

ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_enrollment_type_check;

ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_enrollment_type_check
    CHECK (enrollment_type IN ('free', 'manual', 'paid'));

-- 2. ADD AUDIT AND TRACKING COLUMNS TO COURSE_ENROLLMENTS
ALTER TABLE course_enrollments
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
    ADD COLUMN IF NOT EXISTS enrolled_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- 3. INDEXES FOR FAST ADMIN ENROLLMENT DASHBOARD & LISTING
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status_enrolled
    ON course_enrollments(enrollment_status, enrolled_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_enrolled_by
    ON course_enrollments(enrolled_by);
