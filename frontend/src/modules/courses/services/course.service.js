import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Dedicated Course Management API Service
 * Handles all HTTP interactions with the backend Course module.
 */
export const courseService = {
  /**
   * Create a new draft course
   * @param {{ title: string, categoryId?: string|null }} data
   */
  async createCourse(data) {
    return apiClient.post(API_ENDPOINTS.COURSES.BASE, data);
  },

  /**
   * Fetch courses owned by current instructor
   * @param {{ page?: number, limit?: number, search?: string, status?: string, sortBy?: string, sortOrder?: string }} params
   */
  async getMyCourses(params = {}) {
    return apiClient.get(API_ENDPOINTS.COURSES.MY, { params });
  },

  /**
   * Fetch publicly available published courses.
   */
  async getPublicCatalogue(params = {}) {
    return apiClient.get(API_ENDPOINTS.COURSES.CATALOG, { params });
  },

  /**
   * Public course landing page: course, curriculum, stats, instructor, badges, guarantee.
   */
  async getCourseLanding(idOrSlug) {
    const res = await apiClient.get(API_ENDPOINTS.COURSES.LANDING(idOrSlug));
    return res && res.success !== undefined && res.data !== undefined ? res.data : res;
  },

  /**
   * Related courses (same category first).
   */
  async getRelatedCourses(idOrSlug, limit = 8) {
    const res = await apiClient.get(API_ENDPOINTS.COURSES.RELATED(idOrSlug), { params: { limit } });
    const data = res && res.success !== undefined && res.data !== undefined ? res.data : res;
    return Array.isArray(data?.items) ? data.items : [];
  },

  /**
   * Fetch status counts for current instructor
   */
  async getMyStats() {
    return apiClient.get(API_ENDPOINTS.COURSES.MY_STATS);
  },

  /**
   * Enroll the current student in a free course.
   */
  async enrollInFreeCourse(courseId) {
    return apiClient.post(API_ENDPOINTS.ENROLLMENTS.ENROLL(courseId));
  },

  /**
   * Fetch the current student's enrollments.
   */
  async getMyEnrollments() {
    return apiClient.get(API_ENDPOINTS.ENROLLMENTS.MY);
  },

  /**
   * Check whether the current student is enrolled in a course.
   */
  async getEnrollmentStatus(courseId) {
    return apiClient.get(API_ENDPOINTS.ENROLLMENTS.STATUS(courseId));
  },

  /**
   * Fetch published course details for public visitors.
   */
  async getPublicStudentCourseDetails(idOrSlug) {
    return apiClient.get(
      API_ENDPOINTS.STUDENT_LEARNING.PUBLIC_COURSE_DETAILS(idOrSlug)
    );
  },

  /**
   * Fetch safe course details and curriculum for student learning.
   * @param {string} idOrSlug
   */
  async getStudentCourseDetails(idOrSlug) {
    return apiClient.get(
      API_ENDPOINTS.STUDENT_LEARNING.COURSE_DETAILS(idOrSlug)
    );
  },

  /**
   * Fetch a lesson with secure student access validation.
   */
  async getStudentLesson(lessonId) {
    return apiClient.get(
      API_ENDPOINTS.STUDENT_LEARNING.LESSON_DETAILS(lessonId)
    );
  },

  /**
   * Get the private media streaming URL for a lesson.
   */
  getStudentLessonMediaUrl(lessonId) {
    return `${apiClient.defaults.baseURL}${API_ENDPOINTS.STUDENT_LEARNING.LESSON_MEDIA(lessonId)}`;
  },

  /**
   * Get the private HLS streaming playlist URL for a lesson.
   */
  getStudentLessonHlsUrl(lessonId) {
    return `${apiClient.defaults.baseURL}${API_ENDPOINTS.STUDENT_LEARNING.LESSON_HLS(lessonId, 'master.m3u8')}`;
  },

  async updateStudentProgress(lessonId, positionSeconds, durationSeconds, sessionId) {
    return apiClient.put(
      API_ENDPOINTS.STUDENT_LEARNING.UPDATE_PROGRESS(lessonId),
      { positionSeconds, durationSeconds, sessionId }
    );
  },

  async completeStudentLesson(lessonId) {
    return apiClient.post(
      API_ENDPOINTS.STUDENT_LEARNING.COMPLETE_LESSON(lessonId)
    );
  },

  async getStudentCourseProgress(idOrSlug) {
    return apiClient.get(
      API_ENDPOINTS.STUDENT_LEARNING.COURSE_PROGRESS(idOrSlug)
    );
  },

  async getStudentActivity(days = 7) {
    return apiClient.get(API_ENDPOINTS.STUDENT_LEARNING.ACTIVITY, {
      params: { days },
    });
  },

  async getStudentLessonResources(lessonId) {
    return apiClient.get(
      API_ENDPOINTS.STUDENT_LEARNING.LESSON_RESOURCES(lessonId)
    );
  },

  getStudentResourceDownloadUrl(lessonId, resourceId) {
    return `${apiClient.defaults.baseURL}${API_ENDPOINTS.STUDENT_LEARNING.DOWNLOAD_RESOURCE(lessonId, resourceId)}`;
  },

  async getAdminCourses(params = {}) {
    return apiClient.get(API_ENDPOINTS.COURSES.ADMIN, { params });
  },

  /**
   * Fetch detailed course data for editing
   * @param {string} id
   */
  async getCourseById(id) {
    return apiClient.get(API_ENDPOINTS.COURSES.BY_ID(id));
  },

  /**
   * Partial update for course details
   * @param {string} id
   * @param {object} data
   */
  async updateCourse(id, data) {
    return apiClient.patch(API_ENDPOINTS.COURSES.BY_ID(id), data);
  },

  /**
   * Soft delete a draft course
   * @param {string} id
   */
  async deleteCourse(id) {
    return apiClient.delete(API_ENDPOINTS.COURSES.BY_ID(id));
  },

  /**
   * Upload course thumbnail image file
   * @param {File} file
   */
  async uploadThumbnail(file) {
    const formData = new FormData();
    formData.append('thumbnail', file);
    return apiClient.post(API_ENDPOINTS.COURSES.UPLOAD_THUMBNAIL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Upload course promotional trailer video file
   * @param {string} courseId
   * @param {File} file
   * @param {Function} onUploadProgress
   */
  async uploadPromoVideo(courseId, file, onUploadProgress) {
    const formData = new FormData();
    formData.append('video', file);
    return apiClient.post(API_ENDPOINTS.COURSES.UPLOAD_PROMO_VIDEO(courseId), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
  },

  /**
   * Read-only evaluation of 10 checklist submission rules
   * @param {string} id
   */
  async getCourseChecklist(id) {
    return apiClient.get(API_ENDPOINTS.COURSES.CHECKLIST(id));
  },

  /**
   * Fetch course languages (active only by default, or all if { all: true })
   * @param {{ all?: boolean }} params
   */
  async getCourseLanguages(params = {}) {
    return apiClient.get(API_ENDPOINTS.COURSES.LANGUAGES, { params });
  },

  /**
   * Fetch all course languages for admin settings
   */
  async getAdminLanguages() {
    return apiClient.get(API_ENDPOINTS.COURSES.LANGUAGES, { params: { all: 'true' } });
  },

  /**
   * Add a new course language (Admin / SuperAdmin)
   * @param {{ code: string, name: string, nativeName?: string, isDefault?: boolean, displayOrder?: number }} data
   */
  async createCourseLanguage(data) {
    return apiClient.post(API_ENDPOINTS.COURSES.LANGUAGES, data);
  },

  /**
   * Update language settings (Admin / SuperAdmin)
   * @param {string} id
   * @param {{ name?: string, nativeName?: string, isDefault?: boolean, isActive?: boolean, displayOrder?: number }} data
   */
  async updateCourseLanguage(id, data) {
    return apiClient.patch(`${API_ENDPOINTS.COURSES.LANGUAGES}/${id}`, data);
  },

  /**
   * Delete language (Admin / SuperAdmin)
   * @param {string} id
   */
  async deleteCourseLanguage(id) {
    return apiClient.delete(`${API_ENDPOINTS.COURSES.LANGUAGES}/${id}`);
  },
};
