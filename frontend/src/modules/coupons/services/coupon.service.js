import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Coupon Management API Service
 * Handles all HTTP interactions with the backend Coupons module.
 * Serves both Admin platform coupons and Instructor course-specific coupons.
 */
export const couponService = {
  /**
   * List coupons with pagination, search, status, and scope filtering.
   * Role-adaptive: Instructors automatically receive their own coupons; Admins receive all.
   * @param {Object} params - Query parameters
   */
  async listCoupons(params = {}) {
    return apiClient.get(API_ENDPOINTS.COUPONS.BASE, { params });
  },

  /**
   * Get single coupon details by ID.
   * @param {string} couponId - UUID of the coupon
   */
  async getCoupon(couponId) {
    return apiClient.get(API_ENDPOINTS.COUPONS.BY_ID(couponId));
  },

  /**
   * Create a new coupon.
   * Admins can create platform or course-specific coupons.
   * Instructors can only create coupons for their own published paid courses.
   * @param {Object} data - Coupon creation payload
   */
  async createCoupon(data) {
    return apiClient.post(API_ENDPOINTS.COUPONS.BASE, data);
  },

  /**
   * Update an existing coupon.
   * @param {string} couponId - UUID of the coupon
   * @param {Object} data - Updated fields
   */
  async updateCoupon(couponId, data) {
    return apiClient.patch(API_ENDPOINTS.COUPONS.BY_ID(couponId), data);
  },

  /**
   * Delete or archive a coupon.
   * @param {string} couponId - UUID of the coupon
   */
  async deleteCoupon(couponId) {
    return apiClient.delete(API_ENDPOINTS.COUPONS.BY_ID(couponId));
  },

  /**
   * Fetch instructor's published paid courses for self-service coupon creation.
   * @returns {Promise<Array<{ courseId: string, title: string, slug: string, price: number }>>}
   */
  async getMyCourses() {
    return apiClient.get(API_ENDPOINTS.COUPONS.MY_COURSES);
  },

  /**
   * Validate coupon against cart/course amount and student session.
   * @param {Object} data - { code: string, cartAmount: number, courseId?: string }
   */
  async validateCoupon(data) {
    return apiClient.post(API_ENDPOINTS.COUPONS.VALIDATE, data);
  },

  /**
   * Get coupon attached to a course (Course Editor / Review).
   * @param {string} courseId - UUID of the course
   */
  async getCourseCoupon(courseId) {
    return apiClient.get(API_ENDPOINTS.COUPONS.COURSE_COUPON(courseId));
  },

  /**
   * Apply an admin coupon or propose a new coupon for a course during course authoring.
   * @param {string} courseId - UUID of the course
   * @param {Object} data - { couponId?: string, code?: string, discount_type?: string, discount_value?: number, usage_limit?: number, valid_until?: string }
   */
  async setCourseCoupon(courseId, data) {
    return apiClient.post(API_ENDPOINTS.COUPONS.COURSE_COUPON(courseId), data);
  },

  /**
   * Remove attached coupon from a course.
   * @param {string} courseId - UUID of the course
   */
  async removeCourseCoupon(courseId) {
    return apiClient.delete(API_ENDPOINTS.COUPONS.COURSE_COUPON(courseId));
  },
};

