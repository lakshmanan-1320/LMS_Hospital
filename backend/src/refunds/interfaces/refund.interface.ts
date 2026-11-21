export type RefundStatus =
  | 'pending'
  | 'approved'
  | 'processed'
  | 'rejected'
  | 'failed';

export type FinancialEventType =
  | 'ORDER_CREATED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_FAILED'
  | 'REFUND_REQUESTED'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED'
  | 'REFUND_PROCESSED'
  | 'ENROLLMENT_REVOKED';

export interface RefundRecord {
  refund_id: string;
  order_id: string;
  student_id: string;
  refund_number: string;
  amount: string | number;
  amount_in_paise: number;
  currency: string;
  status: RefundStatus;
  reason: string;
  admin_notes: string | null;
  gateway_refund_id: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface FinancialAuditLogRecord {
  log_id: string;
  order_id: string | null;
  refund_id: string | null;
  student_id: string;
  actor_id: string | null;
  event_type: FinancialEventType;
  amount: string | number | null;
  currency: string;
  description: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface RefundDetailResponse {
  refundId: string;
  orderId: string;
  orderNumber?: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  refundNumber: string;
  amount: number;
  amountInPaise: number;
  currency: string;
  status: RefundStatus;
  reason: string;
  adminNotes: string | null;
  gatewayRefundId: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

