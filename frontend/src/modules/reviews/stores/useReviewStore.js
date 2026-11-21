import { create } from 'zustand';
import { reviewService } from '../services/review.service';

export const useReviewStore = create((set, get) => ({
  // Public course reviews state
  summary: null,
  reviews: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
  myReview: null,
  ratingFilter: null,
  sortBy: 'newest',
  isLoading: false,
  isSubmitting: false,
  error: null,
  actionError: null,

  // Instructor dashboard state
  instructorReviews: [],
  instructorPagination: {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
  instructorCourseFilter: '',
  instructorRatingFilter: null,
  instructorReplyFilter: 'all',
  isReplying: false,

  // Admin moderation state
  adminReviews: [],
  adminPagination: {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  },
  adminStatusFilter: 'all',
  adminCourseFilter: '',
  adminSearch: '',
  isModerating: false,

  // Setters for filters
  setRatingFilter: (star) => set({ ratingFilter: star }),
  setSortBy: (sortBy) => set({ sortBy }),
  setInstructorCourseFilter: (courseId) => set({ instructorCourseFilter: courseId }),
  setInstructorReplyFilter: (filter) => set({ instructorReplyFilter: filter }),
  setAdminStatusFilter: (status) => set({ adminStatusFilter: status }),
  setAdminSearch: (search) => set({ adminSearch: search }),
  clearActionError: () => set({ actionError: null }),

  /**
   * Fetch course rating summary & star breakdown
   */
  fetchCourseSummary: async (courseIdOrSlug) => {
    try {
      const summary = await reviewService.getCourseSummary(courseIdOrSlug);
      set({ summary });
      return summary;
    } catch (err) {
      console.error('[useReviewStore] Failed to fetch summary:', err);
      return null;
    }
  },

  /**
   * Fetch paginated published reviews for course page
   */
  fetchCourseReviews: async (courseIdOrSlug, options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { ratingFilter, sortBy } = get();
      const params = {
        page: options.page || 1,
        limit: options.limit || 10,
        sortBy: options.sortBy || sortBy,
        ...(options.rating !== undefined ? { rating: options.rating } : ratingFilter ? { rating: ratingFilter } : {}),
      };

      const res = await reviewService.getCourseReviews(courseIdOrSlug, params);
      set({
        reviews: res.reviews || [],
        pagination: res.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 },
        summary: res.summary || get().summary,
        isLoading: false,
      });
      return res;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch reviews.';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  /**
   * Fetch logged-in student's own review for this course
   */
  fetchMyReview: async (courseIdOrSlug) => {
    try {
      const myReview = await reviewService.getMyReview(courseIdOrSlug);
      set({ myReview });
      return myReview;
    } catch (err) {
      // 401 or not enrolled is expected for guests / non-enrolled
      set({ myReview: null });
      return null;
    }
  },

  /**
   * Submit new review
   */
  submitReview: async (courseIdOrSlug, payload) => {
    set({ isSubmitting: true, actionError: null });
    try {
      const review = await reviewService.submitReview(courseIdOrSlug, payload);
      set({ myReview: review, isSubmitting: false });

      // Refresh summary and first page of reviews
      await get().fetchCourseSummary(courseIdOrSlug);
      await get().fetchCourseReviews(courseIdOrSlug, { page: 1 });
      return { success: true, data: review };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to submit review.';
      set({ actionError: msg, isSubmitting: false });
      return { success: false, error: msg };
    }
  },

  /**
   * Update student's own review
   */
  updateOwnReview: async (reviewId, courseIdOrSlug, payload) => {
    set({ isSubmitting: true, actionError: null });
    try {
      const updated = await reviewService.updateReview(reviewId, payload);
      set({ myReview: updated, isSubmitting: false });

      // Refresh summary and reviews
      await get().fetchCourseSummary(courseIdOrSlug);
      await get().fetchCourseReviews(courseIdOrSlug);
      return { success: true, data: updated };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update review.';
      set({ actionError: msg, isSubmitting: false });
      return { success: false, error: msg };
    }
  },

  /**
   * Delete student's own review
   */
  deleteOwnReview: async (reviewId, courseIdOrSlug) => {
    set({ isSubmitting: true, actionError: null });
    try {
      await reviewService.deleteReview(reviewId);
      set({ myReview: null, isSubmitting: false });

      // Refresh summary and reviews
      await get().fetchCourseSummary(courseIdOrSlug);
      await get().fetchCourseReviews(courseIdOrSlug);
      return { success: true };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete review.';
      set({ actionError: msg, isSubmitting: false });
      return { success: false, error: msg };
    }
  },

  /**
   * Instructor: Fetch reviews for own courses
   */
  fetchInstructorReviews: async (options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { instructorCourseFilter, instructorReplyFilter } = get();
      const params = {
        page: options.page || 1,
        limit: options.limit || 20,
        sortBy: options.sortBy || 'newest',
        ...(options.courseId || instructorCourseFilter ? { courseId: options.courseId || instructorCourseFilter } : {}),
        ...(options.replyStatus || instructorReplyFilter !== 'all' ? { replyStatus: options.replyStatus || instructorReplyFilter } : {}),
      };

      const res = await reviewService.listInstructorReviews(params);
      set({
        instructorReviews: res.reviews || [],
        instructorPagination: res.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 },
        isLoading: false,
      });
      return res;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch instructor reviews.';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  /**
   * Instructor: Reply to a review
   */
  replyToReview: async (reviewId, replyText) => {
    set({ isReplying: true, actionError: null });
    try {
      const reply = await reviewService.replyToReview(reviewId, { replyText });
      // Update locally in instructorReviews list
      set((state) => ({
        instructorReviews: state.instructorReviews.map((r) =>
          r.reviewId === reviewId ? { ...r, instructorReply: reply } : r,
        ),
        isReplying: false,
      }));
      return { success: true, data: reply };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to post reply.';
      set({ actionError: msg, isReplying: false });
      return { success: false, error: msg };
    }
  },

  /**
   * Instructor: Delete reply
   */
  deleteInstructorReply: async (reviewId) => {
    set({ isReplying: true, actionError: null });
    try {
      await reviewService.deleteInstructorReply(reviewId);
      // Remove reply locally
      set((state) => ({
        instructorReviews: state.instructorReviews.map((r) =>
          r.reviewId === reviewId ? { ...r, instructorReply: null } : r,
        ),
        isReplying: false,
      }));
      return { success: true };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete reply.';
      set({ actionError: msg, isReplying: false });
      return { success: false, error: msg };
    }
  },

  /**
   * Admin: Fetch all platform reviews
   */
  fetchAdminReviews: async (options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { adminStatusFilter, adminSearch, adminCourseFilter } = get();
      const params = {
        page: options.page || 1,
        limit: options.limit || 20,
        sortBy: options.sortBy || 'newest',
        ...(options.status || (adminStatusFilter !== 'all' ? { status: adminStatusFilter } : {})),
        ...(options.search || (adminSearch ? { search: adminSearch } : {})),
        ...(options.courseId || (adminCourseFilter ? { courseId: adminCourseFilter } : {})),
      };

      const res = await reviewService.listAdminReviews(params);
      set({
        adminReviews: res.reviews || [],
        adminPagination: res.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 },
        isLoading: false,
      });
      return res;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch platform reviews.';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  /**
   * Admin: Moderate review status (hide / restore)
   */
  moderateReview: async (reviewId, status, moderationReason) => {
    set({ isModerating: true, actionError: null });
    try {
      const updated = await reviewService.moderateReview(reviewId, {
        status,
        moderationReason,
      });
      // Update in adminReviews list
      set((state) => ({
        adminReviews: state.adminReviews.map((r) =>
          r.reviewId === reviewId
            ? { ...r, status, moderationReason, moderatedAt: new Date().toISOString() }
            : r,
        ),
        isModerating: false,
      }));
      return { success: true, data: updated };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to moderate review.';
      set({ actionError: msg, isModerating: false });
      return { success: false, error: msg };
    }
  },

  /**
   * Admin: Permanently remove review
   */
  adminDeleteReview: async (reviewId) => {
    set({ isModerating: true, actionError: null });
    try {
      await reviewService.adminDeleteReview(reviewId);
      set((state) => ({
        adminReviews: state.adminReviews.filter((r) => r.reviewId !== reviewId),
        isModerating: false,
      }));
      return { success: true };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete review.';
      set({ actionError: msg, isModerating: false });
      return { success: false, error: msg };
    }
  },
}));
