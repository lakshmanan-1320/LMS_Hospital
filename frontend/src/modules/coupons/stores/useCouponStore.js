import { create } from 'zustand';
import { couponService } from '../services/coupon.service';

const INITIAL_FILTERS = {
  search: '',
  status: 'all',
  scope: 'all',
  courseId: '',
};

export const useCouponStore = create((set, get) => ({
  coupons: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  isLoading: false,
  isSaving: false,
  isDeleting: false,
  filters: { ...INITIAL_FILTERS },

  // For modal/editing state
  selectedCoupon: null,
  isFormModalOpen: false,
  isDeleteModalOpen: false,

  // Instructor courses dropdown
  myCourses: [],
  isLoadingCourses: false,

  error: null,
  successMessage: null,

  /**
   * Set filters and re-fetch coupons from page 1
   */
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      page: 1,
    }));
    get().fetchCoupons();
  },

  /**
   * Change pagination page
   */
  setPage: (newPage) => {
    set({ page: newPage });
    get().fetchCoupons();
  },

  /**
   * Fetch coupons from backend with active filters
   */
  fetchCoupons: async (overrideParams = {}) => {
    set({ isLoading: true, error: null });
    const { page, limit, filters } = get();

    const params = {
      page: overrideParams.page || page,
      limit: overrideParams.limit || limit,
      sortBy: 'created_at',
      sortOrder: 'DESC',
      ...overrideParams,
    };

    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.status && filters.status !== 'all') params.status = filters.status;
    if (filters.scope && filters.scope !== 'all') params.scope = filters.scope;
    if (filters.courseId) params.courseId = filters.courseId;

    try {
      const response = await couponService.listCoupons(params);
      const data = response?.data || response;

      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : Array.isArray(response?.items)
        ? response.items
        : [];

      const total =
        typeof data?.total === 'number'
          ? data.total
          : typeof response?.total === 'number'
          ? response.total
          : items.length;

      const totalPages =
        data?.totalPages ||
        Math.max(1, Math.ceil(total / (data?.limit || limit || 10)));

      set({
        coupons: items,
        total,
        page: data?.page || page,
        limit: data?.limit || limit,
        totalPages,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load coupons';
      set({ isLoading: false, error: msg });
    }
  },

  /**
   * Fetch courses for instructor dropdown
   */
  fetchMyCourses: async () => {
    set({ isLoadingCourses: true });
    try {
      const response = await couponService.getMyCourses();
      const courses = Array.isArray(response) ? response : response?.data || [];
      set({ myCourses: courses, isLoadingCourses: false });
      return courses;
    } catch (err) {
      set({ isLoadingCourses: false });
      return [];
    }
  },

  /**
   * Create a new coupon
   */
  createCoupon: async (couponData) => {
    set({ isSaving: true, error: null, successMessage: null });
    try {
      const response = await couponService.createCoupon(couponData);
      set({
        isSaving: false,
        isFormModalOpen: false,
        selectedCoupon: null,
        successMessage: `Coupon "${couponData.code.trim().toUpperCase()}" created successfully!`,
      });
      // Refresh coupon listing
      await get().fetchCoupons();
      return { success: true, data: response };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create coupon';
      set({ isSaving: false, error: msg });
      return { success: false, error: msg };
    }
  },

  /**
   * Update an existing coupon
   */
  updateCoupon: async (couponId, couponData) => {
    set({ isSaving: true, error: null, successMessage: null });
    try {
      const response = await couponService.updateCoupon(couponId, couponData);
      set({
        isSaving: false,
        isFormModalOpen: false,
        selectedCoupon: null,
        successMessage: `Coupon updated successfully!`,
      });
      await get().fetchCoupons();
      return { success: true, data: response };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update coupon';
      set({ isSaving: false, error: msg });
      return { success: false, error: msg };
    }
  },

  /**
   * Delete coupon
   */
  deleteCoupon: async (couponId) => {
    set({ isDeleting: true, error: null, successMessage: null });
    try {
      await couponService.deleteCoupon(couponId);
      set({
        isDeleting: false,
        isDeleteModalOpen: false,
        selectedCoupon: null,
        successMessage: 'Coupon deleted successfully.',
      });
      await get().fetchCoupons();
      return { success: true };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to delete coupon';
      set({ isDeleting: false, error: msg });
      return { success: false, error: msg };
    }
  },

  // Modal helpers
  openCreateModal: () => {
    set({
      selectedCoupon: null,
      isFormModalOpen: true,
      error: null,
      successMessage: null,
    });
  },

  openEditModal: (coupon) => {
    set({
      selectedCoupon: coupon,
      isFormModalOpen: true,
      error: null,
      successMessage: null,
    });
  },

  closeFormModal: () => {
    set({
      selectedCoupon: null,
      isFormModalOpen: false,
      error: null,
    });
  },

  openDeleteModal: (coupon) => {
    set({
      selectedCoupon: coupon,
      isDeleteModalOpen: true,
      error: null,
      successMessage: null,
    });
  },

  closeDeleteModal: () => {
    set({
      selectedCoupon: null,
      isDeleteModalOpen: false,
      error: null,
    });
  },

  resetStatus: () => set({ error: null, successMessage: null }),
}));

