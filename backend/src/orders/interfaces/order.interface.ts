export type OrderStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled';

export type OrderPaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export interface OrderRecord {
  order_id: string;
  order_number: string;
  student_id: string;
  status: OrderStatus;
  currency: string;
  subtotal: string | number;
  course_discount: string | number;
  coupon_id: string | null;
  coupon_code: string | null;
  coupon_discount: string | number;
  total_discount: string | number;
  total_amount: string | number;
  total_in_paise: number;
  payment_order_id: string | null;
  payment_id: string | null;
  payment_status: OrderPaymentStatus;
  payment_method: string | null;
  paid_at: Date | null;
  invoice_number: string;
  billing_details: Record<string, any>;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItemRecord {
  order_item_id: string;
  order_id: string;
  course_id: string;
  instructor_id: string;
  title: string;
  slug: string;
  regular_price: string | number;
  sale_price: string | number | null;
  final_price: string | number;
  currency: string;
  enrollment_id: string | null;
  is_refundable?: boolean;
  refund_period_days?: number;
  created_at: Date;
}

export interface OrderDetailResponse {
  orderId: string;
  orderNumber: string;
  studentId: string;
  status: OrderStatus;
  currency: string;
  subtotal: number;
  courseDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  totalDiscount: number;
  totalAmount: number;
  totalInPaise: number;
  paymentOrderId: string | null;
  paymentId: string | null;
  paymentStatus: OrderPaymentStatus;
  paymentMethod: string | null;
  paidAt: Date | null;
  invoiceNumber: string;
  billingDetails: Record<string, any>;
  items: Array<{
    orderItemId: string;
    courseId: string;
    instructorId: string;
    title: string;
    slug: string;
    regularPrice: number;
    salePrice: number | null;
    finalPrice: number;
    currency: string;
    enrollmentId: string | null;
    isRefundable?: boolean;
    refundPeriodDays?: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: Date;
  student: {
    userId: string;
    name: string;
    email: string;
    billingDetails?: Record<string, any>;
  };
  seller: {
    name: string;
    address: string;
    gstin?: string;
    supportEmail: string;
  };
  items: Array<{
    itemNumber: number;
    title: string;
    courseId: string;
    regularPrice: number;
    discountPrice: number | null;
    finalPrice: number;
    currency: string;
  }>;
  pricing: {
    subtotal: number;
    couponDiscount: number;
    couponCode: string | null;
    totalDiscount: number;
    taxAmount: number; // 0 for tax-exempt or educational
    totalAmount: number;
    currency: string;
  };
  payment: {
    paymentMethod: string | null;
    paymentId: string | null;
    paymentOrderId: string | null;
    paidAt: Date | null;
    status: OrderPaymentStatus;
  };
}

