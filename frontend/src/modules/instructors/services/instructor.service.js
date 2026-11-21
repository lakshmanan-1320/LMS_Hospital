import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Instructor Profile API Service
 * Communicates with the NestJS Instructor Profile backend module.
 */
export const instructorService = {
  /**
   * Fetch authenticated instructor's own profile.
   * Auto-provisions a default profile (is_public: false) on first call.
   */
  async getMyProfile() {
    return apiClient.get(API_ENDPOINTS.INSTRUCTORS.ME);
  },

  /**
   * Partially update authenticated instructor's own profile.
   * @param {Object} data - UpdateInstructorProfileDto
   */
  async updateMyProfile(data) {
    return apiClient.patch(API_ENDPOINTS.INSTRUCTORS.UPDATE_ME, data);
  },

  /**
   * Upload profile avatar (JPEG, PNG, WebP <= 2MB).
   * @param {File} file
   */
  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append('avatar', file);

    return apiClient.post(API_ENDPOINTS.INSTRUCTORS.UPLOAD_AVATAR, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Fetch public instructor profile by user_id for public pages or course details.
   * @param {string} userId
   */
  async getPublicProfile(userId) {
    return apiClient.get(API_ENDPOINTS.INSTRUCTORS.BY_ID(userId));
  },

  /**
   * Fetch paginated directory of public instructors with search and filters.
   * @param {{ search?: string, skill?: string, expertise?: string, sortBy?: string, sortOrder?: string, page?: number, limit?: number }} params
   */
  async getDirectory(params = {}) {
    return apiClient.get(API_ENDPOINTS.INSTRUCTORS.DIRECTORY, { params });
  },

  /**
   * Admin: update any instructor profile.
   * @param {string} userId
   * @param {Object} data
   */
  async adminUpdateProfile(userId, data) {
    return apiClient.patch(API_ENDPOINTS.INSTRUCTORS.ADMIN_UPDATE(userId), data);
  },

  /**
   * Fetch all students enrolled in the authenticated instructor's courses.
   */
  async getMyLearners() {
    return apiClient.get(API_ENDPOINTS.INSTRUCTORS.MY_LEARNERS);
  },

  /**
   * Admin: toggle public visibility moderation.
   * @param {string} userId
   * @param {boolean} isPublic
   */
  async adminSetVisibility(userId, isPublic) {
    return apiClient.patch(API_ENDPOINTS.INSTRUCTORS.ADMIN_VISIBILITY(userId), { isPublic });
  },
};

