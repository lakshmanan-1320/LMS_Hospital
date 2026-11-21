import { create } from 'zustand';
import { refundService } from '../services/refund.service';

export const useRefundStore = create((set, get) => ({
  myRefunds: [],
  allRefunds: [],
  auditLedger: [],
  selectedRefund: null,
  total: 0,
  auditTotal: 0,

  isLoading: false,
  isSubmitting: false,
  isReviewing: false,
  error: null,

  statusFilter: 'all',
  eventTypeFilter: 'all',
  page: 1,
  limit: 20,

  setStatusFilter: (status) => set({ statusFilter: status, page: 1 }),
  setEventTypeFilter: (eventType) => set({ eventTypeFilter: eventType }),
  setPage: (page) => set({ page }),

  clearSelectedRefund: () => set({ selectedRefund: null }),

  /**
   * Fetch student's own refund requests.
   */
  fetchMyRefunds: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await refundService.listMyRefunds();
      set({
        myRefunds: res.items || [],
        total: res.total || 0,
        isLoading: false,
      });
      return res;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch refunds';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  /**
   * Submit a new refund request for an order.
   */
  submitRefundRequest: async (payload) => {
    set({ isSubmitting: true, error: null });
    try {
      const refund = await refundService.requestRefund(payload);
      // Prepend to myRefunds list
      set((state) => ({
        myRefunds: [refund, ...state.myRefunds],
        isSubmitting: false,
      }));
      return { success: true, data: refund };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to submit refund request';
      set({ error: msg, isSubmitting: false });
      return { success: false, error: msg };
    }
  },

  /**
   * Fetch all platform refunds (Admin / Super Admin).
   */
  fetchAllRefunds: async () => {
    const { statusFilter, page, limit } = get();
    set({ isLoading: true, error: null });
    try {
      const params = {
        limit,
        offset: (page - 1) * limit,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await refundService.listAllRefunds(params);
      set({
        allRefunds: res.items || [],
        total: res.total || 0,
        isLoading: false,
      });
      return res;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch platform refunds';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  /**
   * Admin reviews a refund (Approve or Reject).
   */
  reviewRefund: async (refundId, payload) => {
    set({ isReviewing: true, error: null });
    try {
      const res = await refundService.reviewRefund(refundId, payload);
      // Refresh list
      await get().fetchAllRefunds();
      set({ isReviewing: false });
      return { success: true, data: res };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to review refund';
      set({ error: msg, isReviewing: false });
      return { success: false, error: msg };
    }
  },

  /**
   * Fetch financial audit ledger logs (Admin / Super Admin).
   */
  fetchAuditLedger: async (customParams = {}) => {
    const { eventTypeFilter } = get();
    set({ isLoading: true, error: null });
    try {
      const params = {
        limit: 50,
        offset: 0,
        ...customParams,
      };
      if (eventTypeFilter !== 'all') {
        params.eventType = eventTypeFilter;
      }
      const res = await refundService.listAuditLedger(params);
      set({
        auditLedger: res.items || [],
        auditTotal: res.total || 0,
        isLoading: false,
      });
      return res;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch audit ledger';
      set({ error: msg, isLoading: false });
      return null;
    }
  },

  /**
   * Fetch single refund details.
   */
  fetchRefundDetails: async (identifier) => {
    set({ isLoading: true, error: null });
    try {
      const refund = await refundService.getRefund(identifier);
      set({ selectedRefund: refund, isLoading: false });
      return refund;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load refund details';
      set({ error: msg, isLoading: false });
      return null;
    }
  },
}));

