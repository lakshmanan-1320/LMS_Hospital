import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Cart API Service
 * Handles all HTTP interactions with the backend Cart module.
 * Uses centralized Axios instance configured for HttpOnly cookie authentication.
 */
export const cartService = {
  /**
   * Fetch active student's cart, items breakdown, and live pricing.
   * @returns {Promise<{ cartId: string, studentId: string, items: Array, freeItems: Array, paidItems: Array, summary: Object, updatedAt: string }>}
   */
  async getCart() {
    return apiClient.get(API_ENDPOINTS.CART.BASE);
  },

  /**
   * Add a course to the student's cart.
   * @param {string} courseId - UUID of the course
   * @returns {Promise<{ cartId: string, items: Array, summary: Object }>}
   */
  async addToCart(courseId) {
    return apiClient.post(API_ENDPOINTS.CART.ITEMS, { courseId });
  },

  /**
   * Remove a course from the student's cart.
   * @param {string} courseId - UUID of the course to remove
   * @returns {Promise<{ cartId: string, items: Array, summary: Object }>}
   */
  async removeFromCart(courseId) {
    return apiClient.delete(API_ENDPOINTS.CART.ITEM_BY_ID(courseId));
  },

  /**
   * Clear all items in the student's cart.
   * @returns {Promise<{ cartId: string, items: Array, summary: Object }>}
   */
  async clearCart() {
    return apiClient.delete(API_ENDPOINTS.CART.BASE);
  },

  /**
   * 1-Click free enrollment directly from cart or catalogue.
   * Transactionally enrolls student and removes course from cart if present.
   * @param {string} courseId - UUID of the free course
   * @returns {Promise<{ success: boolean, message: string, alreadyEnrolled: boolean, enrollment: Object, cart: Object }>}
   */
  async enrollFreeCourse(courseId) {
    return apiClient.post(API_ENDPOINTS.CART.ENROLL_FREE(courseId));
  },

  /**
   * Fetch active, applicable coupons for courses currently in the cart.
   * @returns {Promise<Array>}
   */
  async getAvailableCoupons() {
    return apiClient.get(API_ENDPOINTS.CART.AVAILABLE_COUPONS);
  },

  /**
   * Apply coupon code to cart.
   * @param {string} code - Coupon code string
   */
  async applyCoupon(code) {
    return apiClient.post(API_ENDPOINTS.CART.COUPON, { code });
  },

  /**
   * Remove applied coupon from cart.
   */
  async removeCoupon() {
    return apiClient.delete(API_ENDPOINTS.CART.COUPON);
  },
};

