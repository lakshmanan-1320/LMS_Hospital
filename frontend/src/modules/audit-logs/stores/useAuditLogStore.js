import { create } from 'zustand';
import { auditLogService } from '../services/audit-log.service';

export const useAuditLogStore = create((set, get) => ({
  logs: [],
  sources: [],
  total: 0,
  totalPages: 0,
  isLoading: false,
  error: null,

  filters: { source: '', search: '', from: '', to: '' },
  page: 1,
  limit: 25,

  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value }, page: 1 })),
  resetFilters: () => set({ filters: { source: '', search: '', from: '', to: '' }, page: 1 }),
  setPage: (page) => set({ page }),

  fetchSources: async () => {
    try {
      const sources = await auditLogService.listSources();
      set({ sources });
    } catch {
      set({ sources: [] });
    }
  },

  fetchLogs: async () => {
    const { filters, page, limit } = get();
    set({ isLoading: true, error: null });
    try {
      const res = await auditLogService.listAuditLogs({
        source: filters.source,
        search: filters.search.trim(),
        // Date inputs give YYYY-MM-DD; include the whole "to" day.
        from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : '',
        to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : '',
        page,
        limit,
      });
      set({ logs: res.data, total: res.total, totalPages: res.totalPages, isLoading: false });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load audit logs';
      set({ error: Array.isArray(msg) ? msg.join(', ') : msg, isLoading: false });
    }
  },
}));

export default useAuditLogStore;
