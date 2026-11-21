-- ==========================================================
-- Migration: 018_create_refunds_and_audit_logs.sql
-- Description: Phase 5 Refunds, Enrollment Revocation, and Financial Audit Ledger
-- Follows strict LMS PostgreSQL conventions: No ORM, explicit UUIDs, snake_case
-- ==========================================================

-- 1. ORDER REFUNDS TABLE
CREATE TABLE IF NOT EXISTS order_refunds (
    refund_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE RESTRICT,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    refund_number VARCHAR(50) UNIQUE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    amount_in_paise INT NOT NULL CHECK (amount_in_paise > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processed', 'rejected', 'failed')),
    reason TEXT NOT NULL,
    admin_notes TEXT,
    gateway_refund_id VARCHAR(100),
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id ON order_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_student_id ON order_refunds(student_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_status ON order_refunds(status);
CREATE INDEX IF NOT EXISTS idx_order_refunds_created_at ON order_refunds(created_at DESC);

-- 2. FINANCIAL AUDIT LOGS / LEDGER TABLE
CREATE TABLE IF NOT EXISTS financial_audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    refund_id UUID REFERENCES order_refunds(refund_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2),
    currency VARCHAR(10) DEFAULT 'INR',
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_order ON financial_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_refund ON financial_audit_logs(refund_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_student ON financial_audit_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_event ON financial_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_created_at ON financial_audit_logs(created_at DESC);

