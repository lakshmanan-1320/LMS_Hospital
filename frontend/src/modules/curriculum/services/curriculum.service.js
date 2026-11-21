import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

export const curriculumService = {
  async getCourses() {
    return apiClient.get(API_ENDPOINTS.CURRICULUM.COURSES);
  },

  async getCurriculum(courseId) {
    return apiClient.get(
      API_ENDPOINTS.CURRICULUM.COURSE_CURRICULUM(courseId)
    );
  },

  async createSection(courseId, data) {
    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.SECTIONS(courseId),
      data
    );
  },

  async updateSection(sectionId, data) {
    return apiClient.put(
      API_ENDPOINTS.CURRICULUM.SECTION(sectionId),
      data
    );
  },

  async deleteSection(sectionId) {
    return apiClient.delete(
      API_ENDPOINTS.CURRICULUM.SECTION(sectionId)
    );
  },

  async reorderSections(courseId, sectionIds) {
    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.REORDER_SECTIONS(courseId),
      { sectionIds }
    );
  },

  async createLesson(sectionId, data) {
    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.LESSONS(sectionId),
      data
    );
  },

  async updateLesson(lessonId, data) {
    return apiClient.put(
      API_ENDPOINTS.CURRICULUM.LESSON(lessonId),
      data
    );
  },

  async deleteLesson(lessonId) {
    return apiClient.delete(
      API_ENDPOINTS.CURRICULUM.LESSON(lessonId)
    );
  },

  async reorderLessons(sectionId, lessonIds) {
    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.REORDER_LESSONS(sectionId),
      { lessonIds }
    );
  },

  async uploadMedia(courseId, file) {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.UPLOAD_MEDIA(courseId),
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
      }
    );
  },

  async getCourseMedia(courseId, type) {
    const url = type
      ? `${API_ENDPOINTS.CURRICULUM.COURSE_MEDIA(courseId)}?type=${type}`
      : API_ENDPOINTS.CURRICULUM.COURSE_MEDIA(courseId);
    return apiClient.get(url);
  },

  async retryMedia(assetId) {
    return apiClient.post(API_ENDPOINTS.CURRICULUM.RETRY_MEDIA(assetId));
  },

  async getResources(lessonId) {
    return apiClient.get(
      API_ENDPOINTS.CURRICULUM.RESOURCES(lessonId)
    );
  },

  async attachResource(lessonId, data) {
    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.RESOURCES(lessonId),
      data
    );
  },

  async deleteResource(lessonId, resourceId) {
    return apiClient.delete(
      API_ENDPOINTS.CURRICULUM.RESOURCE(lessonId, resourceId)
    );
  },

  // --- PUBLISHED-COURSE LESSON MEDIA REPLACEMENT REQUESTS ---

  async createReplacementRequest(courseId, lessonId, reason) {
    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.REPLACEMENT.CREATE(courseId, lessonId),
      { reason }
    );
  },

  async getMyReplacementRequests() {
    return apiClient.get(API_ENDPOINTS.CURRICULUM.REPLACEMENT.MY);
  },

  async getAdminReplacementRequests(status) {
    const url = status
      ? `${API_ENDPOINTS.CURRICULUM.REPLACEMENT.ADMIN}?status=${status}`
      : API_ENDPOINTS.CURRICULUM.REPLACEMENT.ADMIN;
    return apiClient.get(url);
  },

  async getReplacementRequest(requestId) {
    return apiClient.get(API_ENDPOINTS.CURRICULUM.REPLACEMENT.GET(requestId));
  },

  async reviewReplacementRequest(requestId, statusOrPayload, maybeComment) {
    let status = statusOrPayload;
    let comment = maybeComment;
    if (typeof statusOrPayload === 'object' && statusOrPayload !== null) {
      status = statusOrPayload.status;
      comment = statusOrPayload.reviewComment ?? statusOrPayload.comment;
    }
    return apiClient.patch(
      API_ENDPOINTS.CURRICULUM.REPLACEMENT.REVIEW(requestId),
      { status, comment }
    );
  },

  async uploadReplacementMedia(requestId, file) {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.REPLACEMENT.UPLOAD(requestId),
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
      }
    );
  },

  async uploadReplacementVideo(requestId, file) {
    return this.uploadReplacementMedia(requestId, file);
  },

  async applyReplacementMedia(requestId) {
    return apiClient.post(
      API_ENDPOINTS.CURRICULUM.REPLACEMENT.APPLY(requestId)
    );
  },

  async applyReplacement(requestId) {
    return this.applyReplacementMedia(requestId);
  },
};
