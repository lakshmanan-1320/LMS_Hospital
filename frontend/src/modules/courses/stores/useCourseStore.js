import { create } from 'zustand';
import { courseService } from '../services/course.service';

/**
 * Dedicated Course Management Zustand Store
 * Centralizes course lists, filtering, pagination, status metrics,
 * active course editing, checklist evaluations, and modal states.
 */
export const useCourseStore = create((set, get) => ({
  // Data State
  courses: [],
  total: 0,
  page: 1,
  limit: 10,
  stats: {
    total: 0,
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    archived: 0,
  },
  activeCourse: null,
  checklist: {
    ready: false,
    items: [],
  },

  // Filters & View State
  search: '',
  statusFilter: 'all',
  sortBy: 'created_at',
  sortOrder: 'DESC',
  instructorFilter: '',
  categoryFilter: '',
  viewMode: 'grid', // 'grid' | 'table'

  // Loading & Alert State
  isLoading: false,
  isSaving: false,
  error: null,
  successMessage: null,

  // Modals
  isCreateModalOpen: false,
  deleteModal: {
    isOpen: false,
    course: null,
    isDeleting: false,
    error: null,
  },
  checklistModal: {
    isOpen: false,
    course: null,
    data: null,
    isLoading: false,
  },

  // --- ACTIONS ---

  /**
   * Fetch courses (adapts for instructor vs admin)
   */
  fetchCourses: async (role = 'instructor', paramsOverride = {}) => {
    const { page, limit, search, statusFilter, sortBy, sortOrder, instructorFilter, categoryFilter } = get();

    const params = {
      page: paramsOverride.page !== undefined ? paramsOverride.page : page,
      limit: paramsOverride.limit !== undefined ? paramsOverride.limit : limit,
      search: (paramsOverride.search !== undefined ? paramsOverride.search : search) || undefined,
      status: (paramsOverride.statusFilter !== undefined ? paramsOverride.statusFilter : statusFilter) !== 'all'
        ? (paramsOverride.statusFilter !== undefined ? paramsOverride.statusFilter : statusFilter)
        : undefined,
      sortBy: paramsOverride.sortBy !== undefined ? paramsOverride.sortBy : sortBy,
      sortOrder: paramsOverride.sortOrder !== undefined ? paramsOverride.sortOrder : sortOrder,
    };

    if (role === 'admin') {
      if (instructorFilter) params.instructorId = instructorFilter;
      if (categoryFilter) params.categoryId = categoryFilter;
    }

    set({ isLoading: true, error: null });
    try {
      const response =
        role === 'admin'
          ? await courseService.getAdminCourses(params)
          : await courseService.getMyCourses(params);

      const items = response?.items || [];
      const total = response?.total || 0;

      set({
        courses: items,
        total,
        page: params.page,
        isLoading: false,
        error: null,
      });
      return items;
    } catch (err) {
      set({
        isLoading: false,
        error: err.message || 'Failed to load courses.',
      });
      return [];
    }
  },

  /**
   * Fetch instructor's status summary metrics
   */
  fetchStats: async () => {
    try {
      const stats = await courseService.getMyStats();
      if (stats) {
        set({ stats });
      }
      return stats;
    } catch (err) {
      console.error('Failed to load course stats:', err);
      return null;
    }
  },

  /**
   * Fetch complete course detail for editing
   */
  fetchCourseById: async (id) => {
    set({ isLoading: true, error: null, activeCourse: null });
    try {
      const course = await courseService.getCourseById(id);
      set({ activeCourse: course, isLoading: false, error: null });
      return course;
    } catch (err) {
      set({
        isLoading: false,
        error: err.message || 'Failed to load course details.',
      });
      throw err;
    }
  },

  /**
   * Fetch course submission checklist
   */
  fetchChecklist: async (id) => {
    try {
      const checklist = await courseService.getCourseChecklist(id);
      set({ checklist: checklist || { ready: false, items: [] } });
      return checklist;
    } catch (err) {
      console.error('Failed to load course checklist:', err);
      return { ready: false, items: [] };
    }
  },

  /**
   * Create a new draft course
   */
  createCourse: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      const response = await courseService.createCourse(payload);
      const course = response?.course || response;
      set({
        isSaving: false,
        isCreateModalOpen: false,
        successMessage: `Draft course "${course.title}" created successfully.`,
      });
      return course;
    } catch (err) {
      set({
        isSaving: false,
        error: err.message || 'Failed to create course.',
      });
      throw err;
    }
  },

  /**
   * Update course details (PATCH)
   */
  updateCourse: async (id, payload) => {
    set({ isSaving: true, error: null });
    try {
      const response = await courseService.updateCourse(id, payload);
      const updated = response?.course || response;

      // Defensive key normalization supporting both camelCase and snake_case
      const normalized = {
        ...updated,
        isFree:
          updated.isFree !== undefined
            ? Boolean(updated.isFree)
            : updated.is_free !== undefined
            ? Boolean(updated.is_free)
            : get().activeCourse?.isFree,
        learningOutcomes:
          updated.learningOutcomes !== undefined
            ? updated.learningOutcomes
            : updated.learning_outcomes !== undefined
            ? updated.learning_outcomes
            : get().activeCourse?.learningOutcomes || [],
        requirements:
          updated.requirements !== undefined
            ? updated.requirements
            : get().activeCourse?.requirements || [],
        targetAudience:
          updated.targetAudience !== undefined
            ? updated.targetAudience
            : updated.target_audience !== undefined
            ? updated.target_audience
            : get().activeCourse?.targetAudience || '',
        price: updated.price !== undefined ? updated.price : get().activeCourse?.price,
        discountPrice:
          updated.discountPrice !== undefined
            ? updated.discountPrice
            : updated.discount_price !== undefined
            ? updated.discount_price
            : get().activeCourse?.discountPrice,
        thumbnailUrl:
          updated.thumbnailUrl !== undefined
            ? updated.thumbnailUrl
            : updated.thumbnail_url !== undefined
            ? updated.thumbnail_url
            : get().activeCourse?.thumbnailUrl || '',
        promoVideoAssetId:
          updated.promoVideoAssetId !== undefined
            ? updated.promoVideoAssetId
            : updated.promo_video_asset_id !== undefined
            ? updated.promo_video_asset_id
            : get().activeCourse?.promoVideoAssetId || '',
        promoVideo:
          updated.promoVideo !== undefined
            ? updated.promoVideo
            : get().activeCourse?.promoVideo,
      };

      set({
        activeCourse: { ...get().activeCourse, ...normalized },
        isSaving: false,
        successMessage: 'Course details saved successfully.',
      });
      // Refresh checklist if loaded
      get().fetchChecklist(id);
      return normalized;
    } catch (err) {
      set({
        isSaving: false,
        error: err.message || 'Failed to update course.',
      });
      throw err;
    }
  },

  /**
   * Soft delete a draft course
   */
  deleteCourse: async (id) => {
    set((state) => ({
      deleteModal: { ...state.deleteModal, isDeleting: true, error: null },
    }));
    try {
      await courseService.deleteCourse(id);
      set((state) => ({
        deleteModal: { isOpen: false, course: null, isDeleting: false, error: null },
        successMessage: 'Course deleted successfully.',
      }));
      return true;
    } catch (err) {
      set((state) => ({
        deleteModal: {
          ...state.deleteModal,
          isDeleting: false,
          error: err.message || 'Failed to delete course.',
        },
      }));
      throw err;
    }
  },

  // Filter & Page Setters
  setSearch: (search) => set({ search, page: 1 }),
  setStatusFilter: (statusFilter) => set({ statusFilter, page: 1 }),
  setSortBy: (sortBy) => set({ sortBy, page: 1 }),
  setSortOrder: (sortOrder) => set({ sortOrder, page: 1 }),
  setViewMode: (viewMode) => set({ viewMode }),
  setPage: (page) => set({ page }),

  // Modal Setters
  openCreateModal: () => set({ isCreateModalOpen: true, error: null }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),

  openDeleteModal: (course) =>
    set({ deleteModal: { isOpen: true, course, isDeleting: false, error: null } }),
  closeDeleteModal: () =>
    set({ deleteModal: { isOpen: false, course: null, isDeleting: false, error: null } }),

  openChecklistModal: async (course) => {
    set({
      checklistModal: { isOpen: true, course, data: null, isLoading: true },
    });
    try {
      const data = await courseService.getCourseChecklist(course.courseId || course.course_id);
      set((state) => ({
        checklistModal: { ...state.checklistModal, data, isLoading: false },
      }));
    } catch (err) {
      set((state) => ({
        checklistModal: {
          ...state.checklistModal,
          data: { ready: false, items: [] },
          isLoading: false,
        },
      }));
    }
  },
  closeChecklistModal: () =>
    set({ checklistModal: { isOpen: false, course: null, data: null, isLoading: false } }),

  clearAlerts: () => set({ error: null, successMessage: null }),
}));

