-- ==========================================================
-- Migration: 017_create_orders_and_invoices.sql
-- Description: Phase 4 Orders, Order Items, Paid Course Enrollments, and Invoicing
-- Follows strict LMS PostgreSQL conventions: No ORM, explicit UUIDs, snake_case
-- ==========================================================

-- 1. UPDATE COURSE_ENROLLMENTS CONSTRAINTS
-- Remove free-only check and amount_paid = 0 check to allow paid enrollments
ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_amount_paid_check;
ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_amount_paid_check CHECK (amount_paid >= 0);

ALTER TABLE course_enrollments
    DROP CONSTRAINT IF EXISTS course_enrollments_enrollment_type_check;
ALTER TABLE course_enrollments
    ADD CONSTRAINT course_enrollments_enrollment_type_check CHECK (enrollment_type IN ('free', 'paid'));

-- 2. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled')),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    course_discount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (course_discount >= 0),
    coupon_id UUID REFERENCES coupons(coupon_id) ON DELETE SET NULL,
    coupon_code VARCHAR(50),
    coupon_discount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (coupon_discount >= 0),
    total_discount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_discount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    total_in_paise INT NOT NULL CHECK (total_in_paise >= 0),
    payment_order_id VARCHAR(100),
    payment_id VARCHAR(100),
    payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(50) DEFAULT 'mock',
    paid_at TIMESTAMPTZ,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    billing_details JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_order_id ON orders(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 3. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
    order_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE RESTRICT,
    instructor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    regular_price NUMERIC(10, 2) NOT NULL CHECK (regular_price >= 0),
    sale_price NUMERIC(10, 2) CHECK (sale_price IS NULL OR sale_price >= 0),
    final_price NUMERIC(10, 2) NOT NULL CHECK (final_price >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    enrollment_id UUID REFERENCES course_enrollments(enrollment_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_course_id ON order_items(course_id);
CREATE INDEX IF NOT EXISTS idx_order_items_instructor_id ON order_items(instructor_id);

-- 4. LINK ENROLLMENTS TO ORDERS
ALTER TABLE course_enrollments
    ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(order_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_enrollments_order_id ON course_enrollments(order_id);

