import { create } from 'zustand';
import { cartService } from '../services/cart.service';

const INITIAL_SUMMARY = {
  subtotal: 0,
  discountTotal: 0,
  couponDiscount: 0,
  total: 0,
  paidSubtotal: 0,
  appliedCoupon: null,
  currency: 'INR',
  itemCount: 0,
  freeItemsCount: 0,
  paidItemsCount: 0,
  hasFreeCourses: false,
  hasPaidCourses: false,
  isPureFreeCart: false,
  currencyMismatch: false,
  availableCoupons: [],
};

const INITIAL_CART = {
  cartId: null,
  studentId: null,
  items: [],
  freeItems: [],
  paidItems: [],
  summary: INITIAL_SUMMARY,
  availableCoupons: [],
  updatedAt: null,
};

/**
 * Robustly extract cart payload whether wrapped in NestJS envelope, axios envelope, or direct object.
 */
const extractCartPayload = (res) => {
  if (!res) return null;
  if (res.cartId && res.items) return res;
  if (res.data?.cartId && res.data?.items) return res.data;
  if (res.data?.data?.cartId && res.data?.data?.items) return res.data.data;
  if (res.cart?.cartId) return res.cart;
  if (res.data?.cart?.cartId) return res.data.cart;
  return res?.data || res;
};

/**
 * Dedicated Cart Zustand Store
 * Manages cart state, free/paid item separation, live price calculations,
 * and per-item loading states for adding, removing, and 1-click free enrollment.
 */
let inFlightFetchCartPromise = null;

export const useCartStore = create((set, get) => ({
  cart: INITIAL_CART,
  isLoading: false,
  isClearing: false,
  isApplyingCoupon: false,
  isRemovingCoupon: false,
  couponError: null,
  couponSuccess: null,
  actionLoading: {}, // { [courseId]: 'adding' | 'removing' | 'enrolling' }
  error: null,
  successMessage: null,
  successKind: null, // 'cart_added' | 'cart_removed' | 'cart_cleared' | 'enrolled' (what the toast refers to)

  /**
   * Fetch active student's cart and live pricing from backend
   * Deduplicates concurrent in-flight requests.
   */
  fetchCart: async () => {
    if (inFlightFetchCartPromise) {
      return inFlightFetchCartPromise;
    }

    set({ isLoading: true, error: null });

    inFlightFetchCartPromise = (async () => {
      try {
        const response = await cartService.getCart();
        const cartData = extractCartPayload(response);

        set({
          cart: cartData || INITIAL_CART,
          isLoading: false,
          error: null,
        });
        return cartData;
      } catch (err) {
        // Signed-out visitor (no guest checkout): treat as an empty cart instead of an error
        const status = err?.response?.status || err?.status;
        if (status === 401 || status === 403) {
          set({ cart: INITIAL_CART, isLoading: false, error: null });
          return null;
        }

        const errorMessage =
          err?.response?.data?.message || err?.message || 'Failed to load cart';
        set({ isLoading: false, error: errorMessage });
        return null;
      } finally {
        inFlightFetchCartPromise = null;
      }
    })();

    return inFlightFetchCartPromise;
  },

  /**
   * Add a course to the student's cart
   */
  addToCart: async (courseId) => {
    set((state) => ({
      actionLoading: { ...state.actionLoading, [courseId]: 'adding' },
      error: null,
      successMessage: null,
    }));

    try {
      const response = await cartService.addToCart(courseId);
      const updatedCart = extractCartPayload(response);

      set((state) => ({
        cart: updatedCart,
        actionLoading: { ...state.actionLoading, [courseId]: null },
        successMessage: response?.message || 'Course added to cart.',
        successKind: 'cart_added',
        error: null,
      }));

      return { success: true, cart: updatedCart };
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || err?.message || 'Failed to add course to cart';

      set((state) => ({
        actionLoading: { ...state.actionLoading, [courseId]: null },
        error: errorMessage,
      }));

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Remove a course from the student's cart
   */
  removeFromCart: async (courseId) => {
    set((state) => ({
      actionLoading: { ...state.actionLoading, [courseId]: 'removing' },
      error: null,
      successMessage: null,
    }));

    try {
      const response = await cartService.removeFromCart(courseId);
      const updatedCart = response?.cart || response?.data || response;

      set((state) => ({
        cart: updatedCart,
        actionLoading: { ...state.actionLoading, [courseId]: null },
        successMessage: response?.message || 'Course removed from cart.',
        successKind: 'cart_removed',
        error: null,
      }));

      return { success: true, cart: updatedCart };
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || err?.message || 'Failed to remove course from cart';

      set((state) => ({
        actionLoading: { ...state.actionLoading, [courseId]: null },
        error: errorMessage,
      }));

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Clear all items in the cart
   */
  clearCart: async () => {
    set({ isClearing: true, error: null, successMessage: null });
    try {
      const response = await cartService.clearCart();
      const updatedCart = response?.cart || response?.data || response;

      set({
        cart: updatedCart || INITIAL_CART,
        isClearing: false,
        successMessage: 'Cart cleared successfully.',
        successKind: 'cart_cleared',
        error: null,
      });

      return { success: true, cart: updatedCart };
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || err?.message || 'Failed to clear cart';

      set({ isClearing: false, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  },

  /**
   * 1-Click free enrollment directly from cart or catalogue.
   * Transactionally enrolls student and removes course from cart if present.
   */
  enrollFreeCourse: async (courseId) => {
    set((state) => ({
      actionLoading: { ...state.actionLoading, [courseId]: 'enrolling' },
      error: null,
      successMessage: null,
    }));

    try {
      const response = await cartService.enrollFreeCourse(courseId);
      const updatedCart = response?.cart || response?.data?.cart;

      set((state) => ({
        cart: updatedCart || state.cart,
        actionLoading: { ...state.actionLoading, [courseId]: null },
        successMessage: response?.message || 'Enrolled successfully!',
        successKind: 'enrolled',
        error: null,
      }));

      return {
        success: true,
        message: response?.message,
        alreadyEnrolled: response?.alreadyEnrolled,
        enrollment: response?.enrollment,
        cart: updatedCart,
      };
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || err?.message || 'Free enrollment failed';

      set((state) => ({
        actionLoading: { ...state.actionLoading, [courseId]: null },
        error: errorMessage,
      }));

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Check if a course is currently in the cart
   */
  isInCart: (courseId) => {
    const items = get().cart?.items || [];
    return items.some((item) => item.courseId === courseId);
  },

  /**
   * Apply a coupon code to the active cart.
   * Recalculates discounts and totals dynamically.
   */
  applyCoupon: async (code) => {
    set({ isApplyingCoupon: true, couponError: null, couponSuccess: null });
    try {
      const response = await cartService.applyCoupon(code);
      const updatedCart = extractCartPayload(response);

      set({
        cart: updatedCart,
        isApplyingCoupon: false,
        couponSuccess: `Coupon "${(code || '').trim().toUpperCase()}" applied successfully!`,
        couponError: null,
      });

      return { success: true, cart: updatedCart };
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || err?.message || 'Failed to apply coupon';

      set({
        isApplyingCoupon: false,
        couponError: errorMessage,
        couponSuccess: null,
      });

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Remove the applied coupon from the cart.
   */
  removeCoupon: async () => {
    set({ isRemovingCoupon: true, couponError: null, couponSuccess: null });
    try {
      const response = await cartService.removeCoupon();
      const updatedCart = extractCartPayload(response);

      set({
        cart: updatedCart,
        isRemovingCoupon: false,
        couponSuccess: 'Coupon removed.',
        couponError: null,
      });

      return { success: true, cart: updatedCart };
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message || err?.message || 'Failed to remove coupon';

      set({
        isRemovingCoupon: false,
        couponError: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },

  resetCouponStatus: () => set({ couponError: null, couponSuccess: null }),

  /**
   * Reset errors and messages
   */
  resetError: () => set({ error: null }),
  resetSuccess: () => set({ successMessage: null, successKind: null }),

  /**
   * Reset cart to initial blank state (e.g. on logout)
   */
  resetCart: () => set({ cart: INITIAL_CART, actionLoading: {}, error: null, successMessage: null }),
}));

