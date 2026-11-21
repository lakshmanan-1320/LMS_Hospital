import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

const unwrap = (res) => (res && res.success !== undefined && res.data !== undefined ? res.data : res);

/**
 * Reviews & Ratings Service
 * Communicates with backend reviews endpoints for students, instructors, and admin moderation.
 */
export const reviewService = {
  /**
   * Get public rating summary and 1-5 star breakdown for a course.
   * @param {string} courseIdOrSlug
   */
  async getCourseSummary(courseIdOrSlug) {
    const res = await apiClient.get(API_ENDPOINTS.REVIEWS.SUMMARY(courseIdOrSlug));
    return unwrap(res);
  },

  /**
   * Get paginated published reviews for a course.
   * @param {string} courseIdOrSlug
   * @param {{ page?: number, limit?: number, rating?: number, sortBy?: string }} params
   */
  async getCourseReviews(courseIdOrSlug, params = {}) {
    const res = await apiClient.get(API_ENDPOINTS.REVIEWS.LIST_FOR_COURSE(courseIdOrSlug), { params });
    return unwrap(res);
  },

  /**
   * Get current authenticated student's review for a course (or null).
   * @param {string} courseIdOrSlug
   */
  async getMyReview(courseIdOrSlug) {
    const res = await apiClient.get(API_ENDPOINTS.REVIEWS.MY_REVIEW(courseIdOrSlug));
    return unwrap(res);
  },

  /**
   * Student submits a rating & review for an enrolled course.
   * @param {string} courseIdOrSlug
   * @param {{ rating: number, reviewTitle?: string, reviewText?: string }} payload
   */
  async submitReview(courseIdOrSlug, payload) {
    const res = await apiClient.post(API_ENDPOINTS.REVIEWS.CREATE_FOR_COURSE(courseIdOrSlug), payload);
    return unwrap(res);
  },

  /**
   * Student edits their existing review.
   * @param {string} reviewId
   * @param {{ rating?: number, reviewTitle?: string, reviewText?: string }} payload
   */
  async updateReview(reviewId, payload) {
    const res = await apiClient.patch(API_ENDPOINTS.REVIEWS.UPDATE(reviewId), payload);
    return unwrap(res);
  },

  /**
   * Student deletes their own review.
   * @param {string} reviewId
   */
  async deleteReview(reviewId) {
    const res = await apiClient.delete(API_ENDPOINTS.REVIEWS.DELETE(reviewId));
    return unwrap(res);
  },

  /**
   * Instructor queries reviews on their authored courses.
   * @param {{ page?: number, limit?: number, courseId?: string, rating?: number, replyStatus?: string, sortBy?: string }} params
   */
  async listInstructorReviews(params = {}) {
    const res = await apiClient.get(API_ENDPOINTS.REVIEWS.INSTRUCTOR_LIST, { params });
    return unwrap(res);
  },

  /**
   * Instructor replies to a student review on their course.
   * @param {string} reviewId
   * @param {{ replyText: string }} payload
   */
  async replyToReview(reviewId, payload) {
    const res = await apiClient.post(API_ENDPOINTS.REVIEWS.INSTRUCTOR_REPLY(reviewId), payload);
    return unwrap(res);
  },

  /**
   * Instructor updates their existing reply.
   * @param {string} reviewId
   * @param {{ replyText: string }} payload
   */
  async updateInstructorReply(reviewId, payload) {
    const res = await apiClient.patch(API_ENDPOINTS.REVIEWS.INSTRUCTOR_REPLY(reviewId), payload);
    return unwrap(res);
  },

  /**
   * Instructor deletes their reply.
   * @param {string} reviewId
   */
  async deleteInstructorReply(reviewId) {
    const res = await apiClient.delete(API_ENDPOINTS.REVIEWS.INSTRUCTOR_DELETE_REPLY(reviewId));
    return unwrap(res);
  },

  /**
   * Admin lists all platform reviews with moderation filters.
   * @param {{ page?: number, limit?: number, status?: string, courseId?: string, instructorId?: string, studentId?: string, rating?: number, search?: string, sortBy?: string }} params
   */
  async listAdminReviews(params = {}) {
    const res = await apiClient.get(API_ENDPOINTS.REVIEWS.ADMIN_LIST, { params });
    return unwrap(res);
  },

  /**
   * Admin moderates a review (hide, restore, or flag).
   * @param {string} reviewId
   * @param {{ status: 'published' | 'hidden' | 'flagged', moderationReason?: string }} payload
   */
  async moderateReview(reviewId, payload) {
    const res = await apiClient.patch(API_ENDPOINTS.REVIEWS.ADMIN_MODERATE(reviewId), payload);
    return unwrap(res);
  },

  /**
   * Admin permanently removes an inappropriate review.
   * @param {string} reviewId
   */
  async adminDeleteReview(reviewId) {
    const res = await apiClient.delete(API_ENDPOINTS.REVIEWS.ADMIN_DELETE(reviewId));
    return unwrap(res);
  },
};
