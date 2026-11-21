import { create } from 'zustand';
import { adminAccountService } from '../services/admin-account.service';

const errorMessage = (err, fallback) => {
  const msg = err?.response?.data?.message || err?.message || fallback;
  return Array.isArray(msg) ? msg.join(', ') : msg;
};

export const useAdminAccountStore = create((set, get) => ({
  accounts: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  search: '',
  status: '',
  page: 1,
  isLoading: false,
  isSaving: false,
  updatingId: null,
  error: null,
  successMessage: null,

  setSearch: (search) => set({ search, page: 1 }),
  setStatus: (status) => set({ status, page: 1 }),
  setPage: (page) => set({ page }),
  clearMessages: () => set({ error: null, successMessage: null }),

  fetchAccounts: async () => {
    const { search, status, page } = get();
    set({ isLoading: true, error: null });
    try {
      const res = await adminAccountService.listAccounts({ search, status, page });
      set({ accounts: res.users, pagination: res.pagination, isLoading: false });
    } catch (err) {
      set({ error: errorMessage(err, 'Failed to load admin accounts'), isLoading: false });
    }
  },

  createAdmin: async (payload) => {
    set({ isSaving: true, error: null });
    try {
      await adminAccountService.createAdmin(payload);
      set({ isSaving: false, successMessage: `Admin account created for ${payload.email}.` });
      await get().fetchAccounts();
      return { success: true };
    } catch (err) {
      const msg = errorMessage(err, 'Failed to create admin account');
      set({ isSaving: false });
      return { success: false, error: msg };
    }
  },

  toggleActive: async (account) => {
    set({ updatingId: account.user_id, error: null });
    try {
      await adminAccountService.setActive(account.user_id, !account.is_active);
      set({
        updatingId: null,
        successMessage: `${account.email} ${account.is_active ? 'deactivated' : 'activated'}.`,
      });
      await get().fetchAccounts();
    } catch (err) {
      set({ updatingId: null, error: errorMessage(err, 'Failed to update account status') });
    }
  },
}));

export default useAdminAccountStore;
