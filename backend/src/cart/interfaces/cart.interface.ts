import { AppliedCouponInfo } from '../../coupons/interfaces/coupon.interface';

export interface CartRecord {
  cart_id: string;
  student_id: string;
  applied_coupon_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CartItemRow {
  cart_item_id: string;
  cart_id: string;
  course_id: string;
  price_at_addition: string | number;
  added_at: Date;
  title: string;
  slug: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  level: string;
  is_free: boolean;
  price: string | number;
  discount_price: string | number | null;
  currency: string;
  status: string;
  is_active: boolean;
  deleted_at: Date | null;
  instructor_id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface CartItemDetail {
  cartItemId: string;
  courseId: string;
  title: string;
  slug: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  instructorId: string;
  instructorName: string;
  level: string;
  isFree: boolean;
  regularPrice: number;
  discountPrice: number | null;
  effectivePrice: number;
  priceAtAddition: number;
  priceChanged: boolean;
  priceDifference: number;
  currency: string;
  isAvailable: boolean;
  addedAt: Date;
}

export interface CartPricingSummary {
  subtotal: number;
  discountTotal: number;
  couponDiscount: number;
  total: number;
  paidSubtotal: number;
  appliedCoupon: AppliedCouponInfo | null;
  currency: string;
  itemCount: number;
  freeItemsCount: number;
  paidItemsCount: number;
  hasFreeCourses: boolean;
  hasPaidCourses: boolean;
  isPureFreeCart: boolean;
  currencyMismatch: boolean;
  availableCoupons: AvailableCouponOption[];
}

export interface AvailableCouponOption {
  couponId: string;
  code: string;
  description: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  scope: 'platform' | 'course';
  courseId: string | null;
  courseTitle: string | null;
  minOrderValue: number;
  maxDiscountAmount: number | null;
  estimatedDiscount: number;
  discountBadge: string;
}

export interface CartResponse {
  cartId: string;
  studentId: string;
  items: CartItemDetail[];
  freeItems: CartItemDetail[];
  paidItems: CartItemDetail[];
  summary: CartPricingSummary;
  availableCoupons: AvailableCouponOption[];
  updatedAt: Date;
}

