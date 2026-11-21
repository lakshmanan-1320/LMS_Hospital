export type DiscountType = 'percentage' | 'fixed';
export type CouponScope = 'platform' | 'course';

export interface CouponRecord {
  coupon_id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: string | number;
  scope: CouponScope;
  course_id: string | null;
  course_title?: string | null;
  course_slug?: string | null;
  instructor_id?: string | null;
  instructor_name?: string | null;
  min_order_value: string | number;
  max_discount_amount: string | number | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  valid_from: Date;
  valid_until: Date | null;
  is_active: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CouponUsageRecord {
  usage_id: string;
  coupon_id: string;
  student_id: string;
  order_id: string | null;
  discount_amount: string | number;
  used_at: Date;
}

export interface AppliedCouponInfo {
  couponId: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  scope: CouponScope;
  courseId: string | null;
  courseTitle: string | null;
  minOrderValue: number;
  maxDiscountAmount: number | null;
}

export interface CouponValidationResult {
  valid: boolean;
  message?: string;
  coupon?: CouponRecord;
  discountAmount: number;
}

