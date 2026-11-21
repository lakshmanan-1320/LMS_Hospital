import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

export const enrollmentService = {
  async getStats() {
    return apiClient.get(API_ENDPOINTS.ENROLLMENTS.ADMIN.STATS);
  },

  async getEnrollments(params = {}) {
    return apiClient.get(API_ENDPOINTS.ENROLLMENTS.ADMIN.LIST, { params });
  },

  async manualEnroll(studentId, courseId) {
    return apiClient.post(API_ENDPOINTS.ENROLLMENTS.ADMIN.MANUAL_ENROLL, {
      studentId,
      courseId,
    });
  },

  async updateStatus(enrollmentId, status, cancellationReason = null) {
    return apiClient.patch(
      API_ENDPOINTS.ENROLLMENTS.ADMIN.UPDATE_STATUS(enrollmentId),
      { status, cancellationReason }
    );
  },

  async getDetails(enrollmentId) {
    return apiClient.get(API_ENDPOINTS.ENROLLMENTS.ADMIN.DETAILS(enrollmentId));
  },

  async getStudents(search = '') {
    return apiClient.get(API_ENDPOINTS.ENROLLMENTS.ADMIN.STUDENTS, {
      params: search ? { search } : {},
    });
  },

  async getCourses() {
    return apiClient.get(API_ENDPOINTS.ENROLLMENTS.ADMIN.COURSES);
  },
};
