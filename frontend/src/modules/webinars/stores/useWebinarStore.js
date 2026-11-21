import { create } from 'zustand';
import { webinarService } from '../services/webinar.service';

const INITIAL_FILTERS = {
  search: '',
  status: '',
  page: 1,
  limit: 20,
};

export const useWebinarStore = create((set, get) => ({
  // --- STATE ---

  // Public Directory & Landing
  publicDirectory: {
    items: [],
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
  },
  publicWebinar: null,
  registrationResult: null,
  joinSession: null,

  // Admin & Host Management
  adminWebinars: {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
  adminWebinarDetails: null,
  registrants: {
    items: [],
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 1,
  },
  analytics: {
    summary: null,
    bySource: [],
    byCampaign: [],
    byMedium: [],
  },

  filters: { ...INITIAL_FILTERS },

  // Active Attendance Interval Tracking
  activeAttendanceRegistrationId: null,

  // UI state
  isLoading: false,
  isRegistering: false,
  isSaving: false,
  error: null,
  successMessage: null,

  // --- ACTIONS ---

  // Clear messages & errors
  clearMessages: () => set({ error: null, successMessage: null }),

  /**
   * Fetch upcoming published webinars for public catalog.
   */
  fetchPublicWebinars: async (params = {}) => {
    try {
      set({ isLoading: true, error: null });
      const data = await webinarService.getPublicWebinars(params);
      set({
        publicDirectory: {
          items: data.data || [],
          total: data.total || 0,
          page: data.page || 1,
          limit: data.limit || 12,
          totalPages: data.totalPages || 1,
        },
        isLoading: false,
      });
      return data;
    } catch (err) {
      set({ error: err.message || 'Failed to load upcoming webinars', isLoading: false });
      throw err;
    }
  },

  /**
   * Fetch public webinar landing page data by vanity slug.
   */
  fetchPublicWebinarBySlug: async (slug) => {
    try {
      set({ isLoading: true, error: null, publicWebinar: null });
      const data = await webinarService.getPublicWebinarBySlug(slug);
      set({ publicWebinar: data, isLoading: false });
      return data;
    } catch (err) {
      set({ error: err.message || 'Webinar not found', isLoading: false });
      throw err;
    }
  },

  /**
   * Register for webinar without requiring LMS authentication.
   */
  registerPublic: async (idOrSlug, payload) => {
    try {
      set({ isRegistering: true, error: null, registrationResult: null });
      const result = await webinarService.registerPublic(idOrSlug, payload);
      set({
        registrationResult: result,
        isRegistering: false,
        successMessage: result.message || 'Registration confirmed!',
      });
      return result;
    } catch (err) {
      set({ error: err.message || 'Registration failed', isRegistering: false });
      throw err;
    }
  },

  /**
   * Resend confirmation email with calendar details.
   */
  resendConfirmation: async (idOrSlug, email) => {
    try {
      set({ isSaving: true, error: null });
      const result = await webinarService.resendConfirmation(idOrSlug, email);
      set({ isSaving: false, successMessage: result.message || 'Confirmation resent' });
      return result;
    } catch (err) {
      set({ error: err.message || 'Failed to resend confirmation email', isSaving: false });
      throw err;
    }
  },

  /**
   * Authorize join token and retrieve meeting room link.
   */
  authorizeJoin: async (idOrSlug, joinToken) => {
    try {
      set({ isLoading: true, error: null, joinSession: null });
      const session = await webinarService.authorizeJoin(idOrSlug, joinToken);
      set({ joinSession: session, isLoading: false });
      return session;
    } catch (err) {
      set({ error: err.message || 'Failed to authorize joining link', isLoading: false });
      throw err;
    }
  },

  /**
   * Start participant attendance interval.
   */
  startAttendanceTracking: async (idOrSlug, webinarRegistrationId) => {
    try {
      set({ activeAttendanceRegistrationId: webinarRegistrationId });
      await webinarService.recordAttendanceJoin(idOrSlug, webinarRegistrationId);
    } catch (err) {
      console.warn('Failed to record attendance entry:', err.message);
    }
  },

  /**
   * Stop participant attendance interval.
   */
  stopAttendanceTracking: async (idOrSlug, webinarRegistrationId) => {
    try {
      await webinarService.recordAttendanceLeave(idOrSlug, webinarRegistrationId);
      set({ activeAttendanceRegistrationId: null });
    } catch (err) {
      console.warn('Failed to record attendance exit:', err.message);
    }
  },

  /**
   * Fetch all webinars for Admin management.
   */
  fetchAdminWebinars: async (params = {}) => {
    try {
      set({ isLoading: true, error: null });
      const currentFilters = get().filters;
      const mergedParams = { ...currentFilters, ...params };
      const data = await webinarService.getAdminWebinars(mergedParams);
      set({
        adminWebinars: {
          items: data.data || [],
          total: data.total || 0,
          page: data.page || 1,
          limit: data.limit || 20,
          totalPages: data.totalPages || 1,
        },
        filters: mergedParams,
        isLoading: false,
      });
      return data;
    } catch (err) {
      set({ error: err.message || 'Failed to load webinars', isLoading: false });
      throw err;
    }
  },

  /**
   * Fetch single webinar management details by slug.
   */
  fetchAdminWebinarDetails: async (idOrSlug) => {
    try {
      set({ isLoading: true, error: null });
      const data = await webinarService.getAdminWebinarDetails(idOrSlug);
      set({ adminWebinarDetails: data, isLoading: false });
      return data;
    } catch (err) {
      set({ error: err.message || 'Failed to load webinar details', isLoading: false });
      throw err;
    }
  },

  /**
   * Create and schedule a new webinar.
   */
  createWebinar: async (payload) => {
    try {
      set({ isSaving: true, error: null, successMessage: null });
      const created = await webinarService.createWebinar(payload);
      set({ isSaving: false, successMessage: 'Webinar scheduled successfully!' });
      return created;
    } catch (err) {
      set({ error: err.message || 'Failed to create webinar', isSaving: false });
      throw err;
    }
  },

  /**
   * Update webinar metadata.
   */
  updateWebinar: async (idOrSlug, payload) => {
    try {
      set({ isSaving: true, error: null, successMessage: null });
      const updated = await webinarService.updateWebinar(idOrSlug, payload);
      set({
        adminWebinarDetails: updated,
        isSaving: false,
        successMessage: 'Webinar updated successfully!',
      });
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to update webinar', isSaving: false });
      throw err;
    }
  },

  /**
   * Reschedule webinar date/time.
   */
  rescheduleWebinar: async (idOrSlug, payload) => {
    try {
      set({ isSaving: true, error: null, successMessage: null });
      const updated = await webinarService.rescheduleWebinar(idOrSlug, payload);
      set({
        adminWebinarDetails: updated,
        isSaving: false,
        successMessage: 'Webinar rescheduled and notification emails sent!',
      });
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to reschedule webinar', isSaving: false });
      throw err;
    }
  },

  /**
   * Cancel webinar.
   */
  cancelWebinar: async (idOrSlug, reason) => {
    try {
      set({ isSaving: true, error: null, successMessage: null });
      const cancelled = await webinarService.cancelWebinar(idOrSlug, reason);
      set({
        adminWebinarDetails: cancelled,
        isSaving: false,
        successMessage: 'Webinar cancelled and participants notified.',
      });
      return cancelled;
    } catch (err) {
      set({ error: err.message || 'Failed to cancel webinar', isSaving: false });
      throw err;
    }
  },

  /**
   * Fetch participant roster with marketing attribution.
   */
  fetchRegistrants: async (idOrSlug, params = {}) => {
    try {
      set({ isLoading: true, error: null });
      const data = await webinarService.getWebinarRegistrants(idOrSlug, params);
      set({
        registrants: {
          items: data.data || [],
          total: data.total || 0,
          page: data.page || 1,
          limit: data.limit || 50,
          totalPages: data.totalPages || 1,
        },
        isLoading: false,
      });
      return data;
    } catch (err) {
      set({ error: err.message || 'Failed to load registrants', isLoading: false });
      throw err;
    }
  },

  /**
   * Fetch marketing attribution analytics and attendance duration.
   */
  fetchAnalytics: async (idOrSlug) => {
    try {
      set({ isLoading: true, error: null });
      const data = await webinarService.getWebinarAnalytics(idOrSlug);
      set({ analytics: data, isLoading: false });
      return data;
    } catch (err) {
      set({ error: err.message || 'Failed to load webinar analytics', isLoading: false });
      throw err;
    }
  },

  /**
   * Start live session.
   */
  startLiveSession: async (idOrSlug) => {
    try {
      set({ isSaving: true, error: null });
      const updated = await webinarService.startSession(idOrSlug);
      set({
        adminWebinarDetails: updated,
        isSaving: false,
        successMessage: 'Webinar is now LIVE!',
      });
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to start live session', isSaving: false });
      throw err;
    }
  },

  /**
   * End live session.
   */
  endLiveSession: async (idOrSlug) => {
    try {
      set({ isSaving: true, error: null });
      const updated = await webinarService.endSession(idOrSlug);
      set({
        adminWebinarDetails: updated,
        isSaving: false,
        successMessage: 'Live session ended and attendance finalized.',
      });
      return updated;
    } catch (err) {
      set({ error: err.message || 'Failed to end live session', isSaving: false });
      throw err;
    }
  },
}));

export default useWebinarStore;

