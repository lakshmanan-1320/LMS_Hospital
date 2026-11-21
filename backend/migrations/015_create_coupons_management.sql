-- ==========================================================
-- Migration: 015_create_coupons_management.sql
-- Description: Coupons, Coupon Usages, and Cart Coupon Association
-- Follows strict LMS PostgreSQL conventions: No ORM, explicit UUIDs, snake_case
-- ==========================================================

-- 1. COUPONS TABLE
CREATE TABLE IF NOT EXISTS coupons (
    coupon_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_value NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_order_value >= 0),
    max_discount_amount NUMERIC(10, 2) CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
    usage_limit INT CHECK (usage_limit IS NULL OR usage_limit > 0),
    per_user_limit INT NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
    used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    valid_from TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(UPPER(code));
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_validity ON coupons(valid_from, valid_until);

-- 2. COUPON USAGES TABLE (Tracks redemptions per student / order)
CREATE TABLE IF NOT EXISTS coupon_usages (
    usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id UUID NOT NULL REFERENCES coupons(coupon_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    order_id UUID,
    discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount >= 0),
    used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_student ON coupon_usages(coupon_id, student_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_student ON coupon_usages(student_id);

-- 3. CARTS TABLE ALTERATION (Associate applied coupon with student cart)
ALTER TABLE carts
    ADD COLUMN IF NOT EXISTS applied_coupon_id UUID REFERENCES coupons(coupon_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_carts_applied_coupon ON carts(applied_coupon_id);

