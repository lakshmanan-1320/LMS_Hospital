-- ==========================================================
-- Rollback Migration: 017_create_orders_and_invoices.down.sql
-- ==========================================================

ALTER TABLE course_enrollments DROP COLUMN IF EXISTS order_id;

DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Re-apply previous constraints
ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_amount_paid_check;
ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_amount_paid_check CHECK (amount_paid = 0);

ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_enrollment_type_check;
ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_enrollment_type_check CHECK (enrollment_type = 'free');

