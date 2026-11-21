import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

export const settingsService = {
  /**
   * Admin / Super Admin: rules for Bestseller, Highest rated and New course badges.
   */
  async getCourseBadgeRules() {
    const res = await apiClient.get(API_ENDPOINTS.SETTINGS.COURSE_BADGES);
    return res && res.success !== undefined && res.data !== undefined ? res.data : res;
  },

  async updateCourseBadgeRules(rules) {
    const res = await apiClient.patch(API_ENDPOINTS.SETTINGS.COURSE_BADGES, rules);
    return res && res.success !== undefined && res.data !== undefined ? res.data : res;
  },

  /**
   * Super Admin: status of every external integration (no secrets).
   * @returns {Promise<{ integrations: Array<{ key, name, category, managedIn, status, identity, lastValidatedAt?, lastError?, details? }> }>}
   */
  async getIntegrationsOverview() {
    const res = await apiClient.get(API_ENDPOINTS.SETTINGS.INTEGRATIONS);
    return res && res.success !== undefined && res.data !== undefined ? res.data : res;
  },

  /**
   * Super Admin: Fetch master Google OAuth credentials and configuration status.
   */
  async getGoogleOAuthSettings() {
    return apiClient.get(API_ENDPOINTS.SETTINGS.GOOGLE_OAUTH);
  },

  /**
   * Super Admin: Update master Google OAuth credentials.
   */
  async updateGoogleOAuthSettings(data) {
    return apiClient.patch(API_ENDPOINTS.SETTINGS.GOOGLE_OAUTH, data);
  },

  /**
   * Super Admin: Fetch master Zoom OAuth credentials and configuration status.
   */
  async getZoomOAuthSettings() {
    return apiClient.get(API_ENDPOINTS.SETTINGS.ZOOM_OAUTH);
  },

  /**
   * Super Admin: Update master Zoom OAuth credentials.
   */
  async updateZoomOAuthSettings(data) {
    return apiClient.patch(API_ENDPOINTS.SETTINGS.ZOOM_OAUTH, data);
  },

  /**
   * Super Admin: Fetch master Zoho OAuth credentials and configuration status.
   */
  async getZohoOAuthSettings() {
    return apiClient.get(API_ENDPOINTS.SETTINGS.ZOHO_OAUTH);
  },

  /**
   * Super Admin: Update master Zoho OAuth credentials.
   */
  async updateZohoOAuthSettings(data) {
    return apiClient.patch(API_ENDPOINTS.SETTINGS.ZOHO_OAUTH, data);
  },

  /**
   * Admin / Super Admin: Get platform-wide refund policy and course stats.
   */
  async getRefundPolicySettings() {
    return apiClient.get(API_ENDPOINTS.SETTINGS.REFUND_POLICY);
  },

  /**
   * Admin / Super Admin: Update platform-wide refund policy.
   */
  async updateRefundPolicySettings(data) {
    return apiClient.patch(API_ENDPOINTS.SETTINGS.REFUND_POLICY, data);
  },

  /**
   * Admin / Super Admin: List courses with refund policies.
   */
  async listCoursesWithRefund(params = {}) {
    return apiClient.get(API_ENDPOINTS.SETTINGS.REFUND_POLICY_COURSES, { params });
  },

  /**
   * Admin / Super Admin: Update refund policy for a specific course.
   */
  async updateCourseRefund(courseId, data) {
    return apiClient.patch(API_ENDPOINTS.SETTINGS.REFUND_POLICY_COURSE_BY_ID(courseId), data);
  },

  /**
   * Admin / Super Admin: Bulk update course refund policies.
   */
  async bulkUpdateCoursesRefund(data) {
    return apiClient.patch(API_ENDPOINTS.SETTINGS.REFUND_POLICY_COURSES_BULK, data);
  },
};

export default settingsService;

