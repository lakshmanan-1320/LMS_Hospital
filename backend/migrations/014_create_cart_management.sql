-- ==========================================================
-- Migration: 014_create_cart_management.sql
-- Description: Shopping Cart & Cart Items schema for LMS
-- Follows strict LMS PostgreSQL conventions: No ORM, explicit UUIDs, snake_case
-- ==========================================================

-- 1. CARTS TABLE (One persistent cart per student)
CREATE TABLE IF NOT EXISTS carts (
    cart_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_carts_student ON carts(student_id);

-- 2. CART ITEMS TABLE (Courses added to cart by student)
CREATE TABLE IF NOT EXISTS cart_items (
    cart_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    price_at_addition NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_at_addition >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cart_items_cart_course UNIQUE (cart_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_course ON cart_items(course_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_created_at ON cart_items(created_at DESC);

