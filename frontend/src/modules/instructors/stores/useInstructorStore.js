import { create } from 'zustand';
import { instructorService } from '../services/instructor.service';

const INITIAL_FILTERS = {
  search: '',
  skill: '',
  expertise: '',
  sortBy: 'created_at',
  sortOrder: 'DESC',
  page: 1,
  limit: 10,
};

export const useInstructorStore = create((set, get) => ({
  // --- STATE ---
  profile: null,
  publicProfile: null,
  directory: {
    items: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  },

  filters: { ...INITIAL_FILTERS },

  // UI state
  isLoading: false,
  isSaving: false,
  isUploadingAvatar: false,
  error: null,
  successMessage: null,

  // --- ACTIONS ---

  /**
   * Fetch authenticated instructor's own profile.
   */
  fetchMyProfile: async () => {
    try {
      set({ isLoading: true, error: null });
      const data = await instructorService.getMyProfile();
      set({ profile: data, isLoading: false });
      return data;
    } catch (err) {
      const message = err.message || 'Unable to load instructor profile';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  /**
   * Partially update authenticated instructor's own profile.
   * @param {Object} payload
   */
  updateMyProfile: async (payload) => {
    try {
      set({ isSaving: true, error: null, successMessage: null });
      const updated = await instructorService.updateMyProfile(payload);
      set({
        profile: updated,
        isSaving: false,
        successMessage: 'Instructor profile updated successfully!',
      });
      return updated;
    } catch (err) {
      const message = err.message || 'Failed to update instructor profile';
      set({ error: message, isSaving: false });
      throw err;
    }
  },

  /**
   * Upload profile avatar with pre-validation.
   * @param {File} file
   */
  uploadAvatar: async (file) => {
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      set({ error: 'Profile image size must not exceed 2MB' });
      return;
    }

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(file.type)) {
      set({ error: 'Only JPG, PNG, or WebP images are permitted' });
      return;
    }

    try {
      set({ isUploadingAvatar: true, error: null, successMessage: null });
      const result = await instructorService.uploadAvatar(file);

      // Instantly update current profile avatar in store
      set((state) => ({
        profile: state.profile
          ? { ...state.profile, avatarUrl: result.avatarUrl }
          : null,
        isUploadingAvatar: false,
        successMessage: 'Profile photo uploaded successfully!',
      }));
      return result;
    } catch (err) {
      const message = err.message || 'Failed to upload profile photo';
      set({ error: message, isUploadingAvatar: false });
      throw err;
    }
  },

  /**
   * Fetch public instructor profile by user_id for public cards / pages.
   * @param {string} userId
   */
  fetchPublicProfile: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      const data = await instructorService.getPublicProfile(userId);
      set({ publicProfile: data, isLoading: false });
      return data;
    } catch (err) {
      const message = err.message || 'Instructor profile not found or is private';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  /**
   * Fetch directory of public instructors with filters.
   * @param {Object} overrides
   */
  fetchDirectory: async (overrides = {}) => {
    try {
      set({ isLoading: true, error: null });
      const currentFilters = get().filters;
      const mergedParams = { ...currentFilters, ...overrides };

      // Clean empty strings
      const queryParams = { ...mergedParams };
      if (!queryParams.search) delete queryParams.search;
      if (!queryParams.skill) delete queryParams.skill;
      if (!queryParams.expertise) delete queryParams.expertise;

      const data = await instructorService.getDirectory(queryParams);
      set({
        directory: data,
        filters: mergedParams,
        isLoading: false,
      });
      return data;
    } catch (err) {
      const message = err.message || 'Failed to load instructor directory';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  /**
   * Admin: toggle visibility moderation.
   * @param {string} userId
   * @param {boolean} isPublic
   */
  adminSetVisibility: async (userId, isPublic) => {
    try {
      set({ isSaving: true, error: null });
      const updated = await instructorService.adminSetVisibility(userId, isPublic);
      set((state) => ({
        profile: state.profile?.userId === userId ? updated : state.profile,
        isSaving: false,
        successMessage: `Profile visibility updated to ${isPublic ? 'Public' : 'Private'}`,
      }));
      return updated;
    } catch (err) {
      const message = err.message || 'Failed to update visibility';
      set({ error: message, isSaving: false });
      throw err;
    }
  },

  /**
   * Admin: update any instructor profile.
   * @param {string} userId
   * @param {Object} payload
   */
  adminUpdateProfile: async (userId, payload) => {
    try {
      set({ isSaving: true, error: null, successMessage: null });
      const updated = await instructorService.adminUpdateProfile(userId, payload);
      set({
        profile: updated,
        isSaving: false,
        successMessage: 'Instructor profile updated by Admin!',
      });
      return updated;
    } catch (err) {
      const message = err.message || 'Failed to update instructor profile';
      set({ error: message, isSaving: false });
      throw err;
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value, page: 1 },
    }));
  },

  resetFilters: () => {
    set({ filters: { ...INITIAL_FILTERS } });
  },

  clearMessages: () => {
    set({ error: null, successMessage: null });
  },
}));

