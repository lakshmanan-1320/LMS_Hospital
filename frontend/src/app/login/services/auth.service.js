import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

/**
 * Login & Authentication Service
 * Communicates with backend authentication endpoints.
 * Dynamic roles and route configs are fetched directly from database via API.
 */
export const authService = {
  /**
   * Common Unified Login (All dynamic roles)
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ user: object, accessToken: string }>}
   */
  async login(credentials) {
    return apiClient.post(API_ENDPOINTS.AUTH.LOGIN, {
      email: credentials.email?.trim().toLowerCase(),
      password: credentials.password,
    });
  },

  /**
   * Student Self-Registration
   * @param {{ email: string, password: string, firstName: string, lastName: string }} data
   */
  async registerStudent(data) {
    return apiClient.post(API_ENDPOINTS.AUTH.REGISTER_STUDENT, {
      email: data.email?.trim().toLowerCase(),
      password: data.password,
      firstName: data.firstName?.trim(),
      lastName: data.lastName?.trim(),
    });
  },

  /**
   * Instructor Self-Registration
   * @param {{ email: string, password: string, firstName: string, lastName: string }} data
   */
  async registerInstructor(data) {
    return apiClient.post(API_ENDPOINTS.AUTH.REGISTER_INSTRUCTOR, {
      email: data.email?.trim().toLowerCase(),
      password: data.password,
      firstName: data.firstName?.trim(),
      lastName: data.lastName?.trim(),
    });
  },

  /**
   * Send / Resend Email Verification OTP
   * @param {string} email
   */
  async sendOtp(email) {
    return apiClient.post(API_ENDPOINTS.AUTH.SEND_OTP, {
      email: email?.trim().toLowerCase(),
    });
  },

  /**
   * Verify Email OTP & Auto-Login
   * @param {{ email: string, otp: string }} data
   * @returns {Promise<{ message: string, user: object, accessToken: string }>}
   */
  async verifyOtp(data) {
    return apiClient.post(API_ENDPOINTS.AUTH.VERIFY_OTP, {
      email: data.email?.trim().toLowerCase(),
      otp: data.otp?.trim(),
    });
  },

  /**
   * Token Refresh (Browser sends HttpOnly refreshToken cookie automatically)
   * @returns {Promise<{ accessToken: string, user: object }>}
   */
  async refreshToken() {
    return apiClient.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN);
  },

  /**
   * Logout (Clears cookies on server)
   */
  async logout() {
    return apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  },

  /**
   * Fetch current authenticated user profile dynamically from database
   * @returns {Promise<{ userId: string, email: string, firstName: string, lastName: string, roles: Array<{ roleId: string, name: string, displayName: string, slug: string, dashboardRoute: string }>, roleNames: string[], permissions: string[], primaryDashboardRoute: string, primaryRoleSlug: string }>}
   */
  async getMe() {
    return apiClient.get(API_ENDPOINTS.AUTH.ME);
  },

  /**
   * Forgot Password request
   * @param {string} email
   */
  async forgotPassword(email) {
    return apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      email: email?.trim().toLowerCase(),
    });
  },

  /**
   * Reset Password
   * @param {{ token: string, newPassword: string }} data
   */
  async resetPassword(data) {
    return apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);
  },
};

export default authService;

