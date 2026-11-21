export type PaymentStatus =
  | 'created'
  | 'attempted'
  | 'captured'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet' | 'mock';

export interface PaymentTransactionRecord {
  transaction_id: string;
  order_id: string;
  payment_id: string | null;
  signature: string | null;
  student_id: string;
  amount: string | number;
  amount_in_paise: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string | null;
  receipt: string | null;
  error_code: string | null;
  error_description: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentWebhookLogRecord {
  webhook_id: string;
  event_id: string | null;
  event_name: string;
  payload: Record<string, any>;
  signature: string | null;
  is_verified: boolean;
  processed: boolean;
  received_at: Date;
}

export interface RazorpayOrderResult {
  id: string; // Razorpay order id e.g. order_mock_... or order_...
  entity: 'order';
  amount: number; // in paise
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes: Record<string, any>;
  created_at: number;
}

export interface RazorpayPaymentResult {
  id: string; // e.g. pay_mock_...
  entity: 'payment';
  amount: number;
  currency: string;
  status: 'captured' | 'failed' | 'refunded';
  order_id: string;
  method: PaymentMethod;
  email?: string;
  contact?: string;
  error_code?: string | null;
  error_description?: string | null;
  created_at: number;
}

export interface ClientCheckoutConfig {
  keyId: string;
  orderId: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  receipt: string;
  prefill: {
    name?: string;
    email?: string;
  };
  notes: Record<string, any>;
  isMockMode: boolean;
}

