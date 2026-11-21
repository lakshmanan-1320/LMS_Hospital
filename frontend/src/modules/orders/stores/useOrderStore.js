import { create } from 'zustand';
import { orderService } from '../services/order.service';

export const useOrderStore = create((set, get) => ({
  orders: [],
  total: 0,
  selectedOrder: null,
  selectedInvoice: null,

  isLoading: false,
  isDetailLoading: false,
  isInvoiceLoading: false,
  error: null,

  // Filters & Pagination
  search: '',
  statusFilter: 'all',
  page: 1,
  limit: 10,

  /**
   * Fetch orders adaptively based on current user role.
   * @param {'student'|'admin'|'super-admin'} role
   */
  fetchOrders: async (role = 'student') => {
    set({ isLoading: true, error: null });
    const { search, statusFilter, page, limit } = get();

    const queryParams = {
      limit,
      offset: (page - 1) * limit,
    };

    if (search && search.trim()) {
      queryParams.search = search.trim();
    }

    if (statusFilter && statusFilter !== 'all') {
      queryParams.status = statusFilter;
    }

    try {
      const response =
        role === 'admin' || role === 'super-admin'
          ? await orderService.listAllOrders(queryParams)
          : await orderService.listMyOrders(queryParams);

      set({
        orders: Array.isArray(response?.items) ? response.items : [],
        total: Number(response?.total) || 0,
        isLoading: false,
      });
    } catch (err) {
      set({
        orders: [],
        total: 0,
        isLoading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to load orders.',
      });
    }
  },

  /**
   * Load detailed order by order ID or Order Number
   */
  fetchOrderDetails: async (identifier) => {
    if (!identifier) return;
    set({ isDetailLoading: true, error: null });
    try {
      const order = await orderService.getOrder(identifier);
      set({ selectedOrder: order, isDetailLoading: false });
      return order;
    } catch (err) {
      set({
        selectedOrder: null,
        isDetailLoading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to load order details.',
      });
      return null;
    }
  },

  /**
   * Load invoice data for printable receipt
   */
  fetchInvoice: async (identifier) => {
    if (!identifier) return;
    set({ isInvoiceLoading: true, error: null });
    try {
      const invoice = await orderService.getInvoice(identifier);
      set({ selectedInvoice: invoice, isInvoiceLoading: false });
      return invoice;
    } catch (err) {
      set({
        selectedInvoice: null,
        isInvoiceLoading: false,
        error: err?.response?.data?.message || err?.message || 'Failed to load invoice.',
      });
      return null;
    }
  },

  setSearch: (search) => {
    set({ search, page: 1 });
  },

  setStatusFilter: (statusFilter) => {
    set({ statusFilter, page: 1 });
  },

  setPage: (page) => {
    set({ page });
  },

  clearSelectedOrder: () => {
    set({ selectedOrder: null });
  },

  clearSelectedInvoice: () => {
    set({ selectedInvoice: null });
  },

  resetFilters: () => {
    set({ search: '', statusFilter: 'all', page: 1 });
  },
}));

