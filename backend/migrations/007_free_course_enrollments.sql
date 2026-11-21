-- Migration 007: free_course_enrollments

-- Migration 007: Free Course Enrollments
-- Phase 1: Free courses only. No payment gateway or checkout.

CREATE TABLE IF NOT EXISTS course_enrollments (
    enrollment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    student_id UUID NOT NULL
        REFERENCES users(user_id) ON DELETE RESTRICT,

    course_id UUID NOT NULL
        REFERENCES courses(course_id) ON DELETE RESTRICT,

    enrollment_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (enrollment_status IN ('active', 'completed', 'cancelled')),

    enrollment_type VARCHAR(20) NOT NULL DEFAULT 'free'
        CHECK (enrollment_type = 'free'),

    amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0
        CHECK (amount_paid = 0),

    currency CHAR(3) NOT NULL DEFAULT 'INR',

    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_course_enrollment_student_course
        UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_student
    ON course_enrollments(student_id, enrolled_at DESC);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_course
    ON course_enrollments(course_id);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_status
    ON course_enrollments(student_id, enrollment_status);