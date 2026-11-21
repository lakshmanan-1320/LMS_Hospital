import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

const unwrap = (res) => (res && res.success !== undefined && res.data !== undefined ? res.data : res);

/**
 * Admin Accounts API (Super Admin). The backend scopes Super Admin to privileged
 * accounts (Admin / Super Admin); Students and Instructors are managed by Admins.
 */
export const adminAccountService = {
  /**
   * @param {{ search?: string, status?: 'active'|'inactive'|'', page?: number, limit?: number }} params
   */
  async listAccounts({ search = '', status = '', page = 1, limit = 20 } = {}) {
    const res = await apiClient.get(API_ENDPOINTS.USERS.BASE, {
      params: { search: search || undefined, status: status || undefined, page, limit },
    });
    const data = unwrap(res);
    return {
      users: Array.isArray(data?.users) ? data.users : [],
      pagination: data?.pagination || { page, limit, total: 0, totalPages: 0 },
    };
  },

  /**
   * Create an Admin account.
   * @param {{ firstName: string, lastName: string, email: string, password: string }} payload
   */
  async createAdmin(payload) {
    const res = await apiClient.post(API_ENDPOINTS.USERS.BASE, { ...payload, role: 'ADMIN', isVerified: true });
    return unwrap(res);
  },

  async setActive(userId, isActive) {
    const res = await apiClient.patch(API_ENDPOINTS.USERS.STATUS(userId), { isActive });
    return unwrap(res);
  },
};

export default adminAccountService;
