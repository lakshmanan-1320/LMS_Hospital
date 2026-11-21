import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Webinar API Service
 * Communicates with the NestJS Webinars backend module.
 * Fully supports vanity slugs throughout all endpoints (no UUIDs in frontend URLs).
 */
export const webinarService = {
  // ==========================================
  // Public Endpoints
  // ==========================================

  /**
   * Fetch upcoming published webinars for the public directory.
   */
  async getPublicWebinars(params = {}) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.PUBLIC_DIRECTORY, { params });
  },

  /**
   * Fetch public webinar landing page data by vanity slug.
   */
  async getPublicWebinarBySlug(slug) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.PUBLIC_BY_SLUG(slug));
  },

  /**
   * Fetch system registration fields schema (standard required fields + custom types).
   */
  async getRegistrationFieldsSchema() {
    return apiClient.get(API_ENDPOINTS.WEBINARS.REGISTRATION_FIELDS);
  },

  /**
   * Register for webinar without requiring LMS authentication.
   */
  async registerPublic(idOrSlug, data) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.REGISTER(idOrSlug), data);
  },

  /**
   * Resend confirmation email with calendar invite and join credentials.
   */
  async resendConfirmation(idOrSlug, email) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.RESEND_CONFIRMATION(idOrSlug), { email });
  },

  /**
   * Authenticate time-limited join token and obtain provider meeting link.
   */
  async authorizeJoin(idOrSlug, joinToken) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.JOIN_TOKEN(idOrSlug), { joinToken });
  },

  /**
   * Attendance Tracking: Record session entry interval.
   */
  async recordAttendanceJoin(idOrSlug, webinarRegistrationId) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.ATTENDANCE_JOIN(idOrSlug), {
      webinarRegistrationId,
    });
  },

  /**
   * Attendance Tracking: Record session exit interval.
   */
  async recordAttendanceLeave(idOrSlug, webinarRegistrationId) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.ATTENDANCE_LEAVE(idOrSlug), {
      webinarRegistrationId,
    });
  },

  // ==========================================
  // Admin & Host Management Endpoints
  // ==========================================

  /**
   * Upload webinar cover image file.
   */
  async uploadCoverImage(file) {
    const formData = new FormData();
    formData.append('coverImage', file);
    return apiClient.post(API_ENDPOINTS.WEBINARS.UPLOAD_COVER, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * List all webinars for Admin management table.
   */
  async getAdminWebinars(params = {}) {
    const cleanParams = {};
    if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
    if (params.status && params.status.trim()) cleanParams.status = params.status.trim();
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    return apiClient.get(API_ENDPOINTS.WEBINARS.ADMIN_LIST, { params: cleanParams });
  },

  /**
   * Fetch complete webinar management details.
   */
  async getAdminWebinarDetails(idOrSlug) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.ADMIN_DETAILS(idOrSlug));
  },

  /**
   * Create and schedule a new webinar.
   */
  async createWebinar(data) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.ADMIN_CREATE, data);
  },

  /**
   * Update webinar metadata.
   */
  async updateWebinar(idOrSlug, data) {
    return apiClient.patch(API_ENDPOINTS.WEBINARS.ADMIN_UPDATE(idOrSlug), data);
  },

  /**
   * Reschedule webinar date/time.
   */
  async rescheduleWebinar(idOrSlug, data) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.ADMIN_RESCHEDULE(idOrSlug), data);
  },

  /**
   * Cancel webinar session.
   */
  async cancelWebinar(idOrSlug, reason) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.ADMIN_CANCEL(idOrSlug), { reason });
  },

  /**
   * Fetch participant roster with marketing attribution and attendance metrics.
   */
  async getWebinarRegistrants(idOrSlug, params = {}) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.ADMIN_REGISTRANTS(idOrSlug), { params });
  },

  /**
   * Fetch marketing attribution analytics (Google Ads, Meta Ads, etc.) and attendance duration.
   */
  async getWebinarAnalytics(idOrSlug) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.ADMIN_ANALYTICS(idOrSlug));
  },

  /**
   * Obtain elevated host launch URL.
   */
  async getHostJoinUrl(idOrSlug) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.HOST_JOIN(idOrSlug));
  },

  /**
   * Transition session status to 'live'.
   */
  async startSession(idOrSlug) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.HOST_START(idOrSlug));
  },

  /**
   * Transition session status to 'completed'.
   */
  async endSession(idOrSlug) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.HOST_END(idOrSlug));
  },

  // ==========================================
  // Meeting Providers Endpoints
  // ==========================================

  /**
   * Fetch live status of all meeting providers (Google Meet, Zoom, Zoho).
   */
  async getProvidersStatus() {
    return apiClient.get(API_ENDPOINTS.WEBINARS.PROVIDERS_STATUS);
  },

  /**
   * Fetch Google OAuth authorization URL for Admin to connect their Google account.
   */
  async getGoogleAuthUrl(redirectUri, state) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.PROVIDERS_GOOGLE_AUTH_URL, {
      params: { redirectUri, state },
    });
  },

  /**
   * Handle Google OAuth authorization code return and connect account.
   */
  async handleGoogleCallback(code, redirectUri) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_GOOGLE_CALLBACK, { code, redirectUri });
  },

  /**
   * Disconnect the active Google account.
   */
  async disconnectGoogle() {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_GOOGLE_DISCONNECT);
  },

  /**
   * Run a live test creating and deleting a temporary Google Meet conference event.
   */
  async testGoogleMeet() {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_GOOGLE_TEST);
  },

  /**
   * Fetch Zoom OAuth authorization URL for Admin to connect their account.
   */
  async getZoomAuthUrl(redirectUri, state) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.PROVIDERS_ZOOM_AUTH_URL, {
      params: { redirectUri, state },
    });
  },

  /**
   * Handle Zoom OAuth authorization code return and connect account.
   */
  async handleZoomCallback(code, redirectUri) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_ZOOM_CALLBACK, { code, redirectUri });
  },

  /**
   * Run a live test creating and deleting a temporary Zoom meeting.
   */
  async testZoom() {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_ZOOM_TEST);
  },

  /**
   * Disconnect the active Zoom integration.
   */
  async disconnectZoom() {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_ZOOM_DISCONNECT);
  },

  /**
   * Fetch Zoho OAuth authorization URL for Admin to connect.
   */
  async getZohoAuthUrl(redirectUri, state) {
    return apiClient.get(API_ENDPOINTS.WEBINARS.PROVIDERS_ZOHO_AUTH_URL, {
      params: { redirectUri, state },
    });
  },

  /**
   * Handle Zoho OAuth authorization code return and connect account.
   */
  async handleZohoCallback(code, redirectUri) {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_ZOHO_CALLBACK, { code, redirectUri });
  },

  /**
   * Run a live test creating and deleting a temporary Zoho Meeting session.
   */
  async testZoho() {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_ZOHO_TEST);
  },

  /**
   * Disconnect the active Zoho Meeting integration.
   */
  async disconnectZoho() {
    return apiClient.post(API_ENDPOINTS.WEBINARS.PROVIDERS_ZOHO_DISCONNECT);
  },
};

export default webinarService;

