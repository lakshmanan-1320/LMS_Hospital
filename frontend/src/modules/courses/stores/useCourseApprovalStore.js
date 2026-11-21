import { create } from 'zustand';
import { courseApprovalService } from '../services/course-approval.service';

/**
 * Dedicated Course Approval Zustand Store (Module 7)
 * Manages approval queues, pipeline statistics, deep review bundle,
 * audit history, and status transitions (submit, withdraw, approve, reject, publish, archive, restore).
 */
export const useCourseApprovalStore = create((set, get) => ({
  // Approval Queue State
  queue: [],
  queueTotal: 0,
  queuePage: 1,
  queueLimit: 10,
  queueTotalPages: 1,
  queueStatus: 'pending_review',
  queueSearch: '',
  queueCategoryId: '',
  queueSortBy: 'submitted_at',
  queueSortOrder: 'DESC',

  // Pipeline Statistics
  stats: {
    pending_review: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    archived: 0,
    draft: 0,
    total: 0,
  },

  // Active Review Bundle & History
  activeReview: null,
  activeHistory: [],

  // Loading & Alert State
  isLoadingQueue: false,
  isLoadingReview: false,
  isLoadingHistory: false,
  isActionLoading: false,
  error: null,
  successMessage: null,

  // Modal Controls
  reviewModal: {
    isOpen: false,
    courseId: null,
  },
  rejectModal: {
    isOpen: false,
    courseId: null,
    courseTitle: '',
  },
  historyModal: {
    isOpen: false,
    courseId: null,
    courseTitle: '',
  },
  submitModal: {
    isOpen: false,
    courseId: null,
    courseTitle: '',
  },

  // --- ACTIONS ---

  /**
   * 1. Fetch Approval Queue with filters & pagination
   */
  fetchQueue: async (paramsOverride = {}) => {
    const {
      queuePage,
      queueLimit,
      queueSearch,
      queueStatus,
      queueCategoryId,
      queueSortBy,
      queueSortOrder,
    } = get();

    const params = {
      page: paramsOverride.page !== undefined ? paramsOverride.page : queuePage,
      limit: paramsOverride.limit !== undefined ? paramsOverride.limit : queueLimit,
      search: (paramsOverride.search !== undefined ? paramsOverride.search : queueSearch) || undefined,
      status: (paramsOverride.status !== undefined ? paramsOverride.status : queueStatus) || undefined,
      categoryId: (paramsOverride.categoryId !== undefined ? paramsOverride.categoryId : queueCategoryId) || undefined,
      sortBy: paramsOverride.sortBy !== undefined ? paramsOverride.sortBy : queueSortBy,
      sortOrder: paramsOverride.sortOrder !== undefined ? paramsOverride.sortOrder : queueSortOrder,
    };

    set({ isLoadingQueue: true, error: null });
    try {
      const response = await courseApprovalService.getQueue(params);
      const items = response?.items || [];
      const meta = response?.meta || { total: 0, page: 1, limit: 10, totalPages: 1 };

      set({
        queue: items,
        queueTotal: meta.total,
        queuePage: meta.page,
        queueLimit: meta.limit,
        queueTotalPages: meta.totalPages || 1,
        isLoadingQueue: false,
      });
      return items;
    } catch (err) {
      set({
        isLoadingQueue: false,
        error: err.response?.data?.message || err.message || 'Failed to fetch approval queue.',
      });
      return [];
    }
  },

  /**
   * 2. Fetch Pipeline Statistics
   */
  fetchStats: async () => {
    try {
      const stats = await courseApprovalService.getStats();
      if (stats) {
        set({ stats });
      }
      return stats;
    } catch (err) {
      console.error('Failed to fetch approval stats:', err);
      return null;
    }
  },

  /**
   * 3. Open Review Modal & load deep review detail bundle
   */
  openReviewModal: async (courseId) => {
    set({
      reviewModal: { isOpen: true, courseId },
      activeReview: null,
      isLoadingReview: true,
      error: null,
    });
    try {
      const detail = await courseApprovalService.getReviewDetail(courseId);
      set({ activeReview: detail, isLoadingReview: false });
      return detail;
    } catch (err) {
      set({
        isLoadingReview: false,
        error: err.response?.data?.message || err.message || 'Failed to load course review details.',
      });
      return null;
    }
  },

  closeReviewModal: () => {
    set({ reviewModal: { isOpen: false, courseId: null }, activeReview: null });
  },

  /**
   * 4. Open Audit History Modal
   */
  openHistoryModal: async (courseId, courseTitle = '') => {
    set({
      historyModal: { isOpen: true, courseId, courseTitle },
      activeHistory: [],
      isLoadingHistory: true,
      error: null,
    });
    try {
      const history = await courseApprovalService.getHistory(courseId);
      set({
        activeHistory: Array.isArray(history) ? history : [],
        isLoadingHistory: false,
      });
      return history;
    } catch (err) {
      set({
        isLoadingHistory: false,
        error: err.response?.data?.message || err.message || 'Failed to load course history.',
      });
      return [];
    }
  },

  closeHistoryModal: () => {
    set({ historyModal: { isOpen: false, courseId: null, courseTitle: '' }, activeHistory: [] });
  },

  /**
   * 5. Open Rejection Modal
   */
  openRejectModal: (courseId, courseTitle = '') => {
    set({ rejectModal: { isOpen: true, courseId, courseTitle }, error: null });
  },

  closeRejectModal: () => {
    set({ rejectModal: { isOpen: false, courseId: null, courseTitle: '' } });
  },

  /**
   * 6. Open Submit Pre-Flight Modal
   */
  openSubmitModal: (courseId, courseTitle = '') => {
    set({ submitModal: { isOpen: true, courseId, courseTitle }, error: null });
  },

  closeSubmitModal: () => {
    set({ submitModal: { isOpen: false, courseId: null, courseTitle: '' } });
  },

  // --- TRANSITION OPERATIONS ---

  /**
   * 7. Submit Course (Instructor)
   */
  submitCourse: async (courseId, note = '') => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await courseApprovalService.submitCourse(courseId, { note });
      set({
        isActionLoading: false,
        submitModal: { isOpen: false, courseId: null, courseTitle: '' },
        successMessage: res?.message || 'Course submitted for review successfully.',
      });
      get().fetchStats();
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit course for review.';
      set({ isActionLoading: false, error: msg });
      throw err;
    }
  },

  /**
   * 8. Withdraw Submission (Instructor)
   */
  withdrawCourse: async (courseId, note = '') => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await courseApprovalService.withdrawCourse(courseId, { note });
      set({
        isActionLoading: false,
        successMessage: res?.message || 'Course submission withdrawn successfully.',
      });
      get().fetchStats();
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to withdraw course submission.';
      set({ isActionLoading: false, error: msg });
      throw err;
    }
  },

  /**
   * 9. Approve Course (Reviewer)
   */
  approveCourse: async (courseId, note = '') => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await courseApprovalService.approveCourse(courseId, { note });
      set({
        isActionLoading: false,
        reviewModal: { isOpen: false, courseId: null },
        activeReview: null,
        successMessage: res?.message || 'Course approved successfully.',
      });
      get().fetchQueue();
      get().fetchStats();
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to approve course.';
      set({ isActionLoading: false, error: msg });
      throw err;
    }
  },

  /**
   * 10. Reject Course (Reviewer)
   */
  rejectCourse: async (courseId, reason) => {
    if (!reason || !reason.trim() || reason.trim().length < 5) {
      set({ error: 'Rejection reason must be at least 5 characters.' });
      return;
    }
    set({ isActionLoading: true, error: null });
    try {
      const res = await courseApprovalService.rejectCourse(courseId, { reason: reason.trim() });
      set({
        isActionLoading: false,
        rejectModal: { isOpen: false, courseId: null, courseTitle: '' },
        reviewModal: { isOpen: false, courseId: null },
        activeReview: null,
        successMessage: res?.message || 'Course returned for revision.',
      });
      get().fetchQueue();
      get().fetchStats();
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reject course.';
      set({ isActionLoading: false, error: msg });
      throw err;
    }
  },

  /**
   * 11. Publish Approved Course
   */
  publishCourse: async (courseId, note = '') => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await courseApprovalService.publishCourse(courseId, { note });
      set({
        isActionLoading: false,
        successMessage: res?.message || 'Course published successfully to public catalogue.',
      });
      get().fetchQueue();
      get().fetchStats();
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to publish course.';
      set({ isActionLoading: false, error: msg });
      throw err;
    }
  },

  /**
   * 12. Archive Course
   */
  archiveCourse: async (courseId, note = '') => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await courseApprovalService.archiveCourse(courseId, { note });
      set({
        isActionLoading: false,
        successMessage: res?.message || 'Course archived successfully.',
      });
      get().fetchQueue();
      get().fetchStats();
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to archive course.';
      set({ isActionLoading: false, error: msg });
      throw err;
    }
  },

  /**
   * 13. Restore Archived Course
   */
  restoreCourse: async (courseId, note = '') => {
    set({ isActionLoading: true, error: null });
    try {
      const res = await courseApprovalService.restoreCourse(courseId, { note });
      set({
        isActionLoading: false,
        successMessage: res?.message || 'Course restored to draft status.',
      });
      get().fetchQueue();
      get().fetchStats();
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to restore course.';
      set({ isActionLoading: false, error: msg });
      throw err;
    }
  },

  /**
   * 14. Toggle Featured Status
   */
  toggleFeatured: async (courseId, currentFeatured) => {
    set({ isActionLoading: true, error: null });
    try {
      const newFeatured = !currentFeatured;
      const res = await courseApprovalService.setFeatured(courseId, newFeatured);
      set({
        isActionLoading: false,
        successMessage: `Course ${newFeatured ? 'featured' : 'unfeatured'} successfully.`,
      });
      get().fetchQueue();
      return res;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update featured status.';
      set({ isActionLoading: false, error: msg });
      throw err;
    }
  },

  // Filter Setters
  setQueueStatus: (queueStatus) => {
    set({ queueStatus, queuePage: 1 });
    get().fetchQueue();
  },
  setQueueSearch: (queueSearch) => {
    set({ queueSearch, queuePage: 1 });
    get().fetchQueue();
  },
  setQueuePage: (queuePage) => {
    set({ queuePage });
    get().fetchQueue();
  },
  setQueueSort: (queueSortBy, queueSortOrder) => {
    set({ queueSortBy, queueSortOrder, queuePage: 1 });
    get().fetchQueue();
  },
  clearAlerts: () => set({ error: null, successMessage: null }),
}));

