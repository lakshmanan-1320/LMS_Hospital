-- ==========================================================
-- Migration: 016_create_payments_and_transactions.sql
-- Description: Phase 3 Payment Transactions and Webhook Logs
-- Follows strict LMS PostgreSQL conventions: No ORM, explicit UUIDs, snake_case
-- ==========================================================

-- 1. PAYMENT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS payment_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(100) NOT NULL UNIQUE,
    payment_id VARCHAR(100),
    signature VARCHAR(255),
    student_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    amount_in_paise INT NOT NULL CHECK (amount_in_paise >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'attempted', 'captured', 'failed', 'cancelled', 'refunded')),
    payment_method VARCHAR(50),
    receipt VARCHAR(100),
    error_code VARCHAR(100),
    error_description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_student_id ON payment_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- 2. PAYMENT WEBHOOKS LOG TABLE
CREATE TABLE IF NOT EXISTS payment_webhooks_log (
    webhook_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(100),
    event_name VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    signature VARCHAR(255),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_event ON payment_webhooks_log(event_name);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_received_at ON payment_webhooks_log(received_at DESC);

