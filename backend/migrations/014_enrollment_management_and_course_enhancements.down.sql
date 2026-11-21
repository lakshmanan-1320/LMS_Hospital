-- Migration 014 Down: Revert Enrollment Management Enhancements

DROP INDEX IF EXISTS idx_course_enrollments_enrolled_by;
DROP INDEX IF EXISTS idx_course_enrollments_status_enrolled;

ALTER TABLE course_enrollments
    DROP COLUMN IF EXISTS status_changed_by,
    DROP COLUMN IF EXISTS status_changed_at,
    DROP COLUMN IF EXISTS enrolled_by,
    DROP COLUMN IF EXISTS cancellation_reason;

ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_enrollment_type_check;

ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_enrollment_type_check
    CHECK (enrollment_type = 'free');

ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_enrollment_status_check;

ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_enrollment_status_check
    CHECK (enrollment_status IN ('active', 'completed', 'cancelled'));
