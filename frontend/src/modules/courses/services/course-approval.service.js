import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Dedicated Course Approval API Service (Module 7)
 * Interacts with /course-approval endpoints.
 */
export const courseApprovalService = {
  /**
   * 1. GET APPROVAL QUEUE
   * @param {{ page?: number, limit?: number, search?: string, status?: string, categoryId?: string, sortBy?: string, sortOrder?: string }} params
   */
  async getQueue(params = {}) {
    return apiClient.get(API_ENDPOINTS.COURSE_APPROVAL.QUEUE, { params });
  },

  /**
   * 2. GET APPROVAL STATS
   */
  async getStats() {
    return apiClient.get(API_ENDPOINTS.COURSE_APPROVAL.STATS);
  },

  /**
   * 3. GET REVIEW DETAIL (Course details + curriculum summary + checklist + recent history)
   * @param {string} courseId
   */
  async getReviewDetail(courseId) {
    return apiClient.get(API_ENDPOINTS.COURSE_APPROVAL.REVIEW(courseId));
  },

  /**
   * 4. GET COURSE STATUS HISTORY (Audit Trail)
   * @param {string} courseId
   */
  async getHistory(courseId) {
    return apiClient.get(API_ENDPOINTS.COURSE_APPROVAL.HISTORY(courseId));
  },

  /**
   * 5. SUBMIT COURSE FOR REVIEW (Instructor)
   * @param {string} courseId
   * @param {{ note?: string }} data
   */
  async submitCourse(courseId, data = {}) {
    return apiClient.post(API_ENDPOINTS.COURSE_APPROVAL.SUBMIT(courseId), data);
  },

  /**
   * 6. WITHDRAW SUBMITTED COURSE (Instructor)
   * @param {string} courseId
   * @param {{ note?: string }} data
   */
  async withdrawCourse(courseId, data = {}) {
    return apiClient.post(API_ENDPOINTS.COURSE_APPROVAL.WITHDRAW(courseId), data);
  },

  /**
   * 7. APPROVE COURSE (Reviewer)
   * @param {string} courseId
   * @param {{ note?: string }} data
   */
  async approveCourse(courseId, data = {}) {
    return apiClient.post(API_ENDPOINTS.COURSE_APPROVAL.APPROVE(courseId), data);
  },

  /**
   * 8. REJECT COURSE (Reviewer)
   * @param {string} courseId
   * @param {{ reason: string }} data
   */
  async rejectCourse(courseId, data) {
    return apiClient.post(API_ENDPOINTS.COURSE_APPROVAL.REJECT(courseId), data);
  },

  /**
   * 9. PUBLISH APPROVED COURSE (Admin / SuperAdmin)
   * @param {string} courseId
   * @param {{ note?: string }} data
   */
  async publishCourse(courseId, data = {}) {
    return apiClient.post(API_ENDPOINTS.COURSE_APPROVAL.PUBLISH(courseId), data);
  },

  /**
   * 10. ARCHIVE PUBLISHED / APPROVED COURSE (Admin / SuperAdmin)
   * @param {string} courseId
   * @param {{ note?: string }} data
   */
  async archiveCourse(courseId, data = {}) {
    return apiClient.post(API_ENDPOINTS.COURSE_APPROVAL.ARCHIVE(courseId), data);
  },

  /**
   * 11. RESTORE ARCHIVED COURSE (Admin / SuperAdmin)
   * @param {string} courseId
   * @param {{ note?: string }} data
   */
  async restoreCourse(courseId, data = {}) {
    return apiClient.post(API_ENDPOINTS.COURSE_APPROVAL.RESTORE(courseId), data);
  },

  /**
   * 12. TOGGLE FEATURED STATUS (Admin / SuperAdmin)
   * @param {string} courseId
   * @param {boolean} isFeatured
   */
  async setFeatured(courseId, isFeatured) {
    return apiClient.patch(API_ENDPOINTS.COURSE_APPROVAL.FEATURED(courseId), { isFeatured });
  },
};

