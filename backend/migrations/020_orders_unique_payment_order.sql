-- One verified payment can create at most one order.
-- Backstop for OrdersService.checkout's "payment already used" check, so two concurrent checkouts
-- with the same Razorpay order can't both succeed. Free orders have no payment_order_id (NULL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_payment_order_id
    ON orders (payment_order_id)
    WHERE payment_order_id IS NOT NULL;
