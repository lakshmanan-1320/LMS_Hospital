import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

const unwrap = (res) => (res && res.success !== undefined && res.data !== undefined ? res.data : res);

/**
 * Roles & Permissions API (Super Admin). Changes apply on users' next request.
 */
export const rolesPermissionsService = {
  /** @returns {Promise<{ roles: object[], permissions: object[] }>} */
  async getMatrix() {
    const res = await apiClient.get(API_ENDPOINTS.ROLES_PERMISSIONS.BASE);
    const data = unwrap(res);
    return { roles: data?.roles || [], permissions: data?.permissions || [] };
  },

  /**
   * Replace a role's permission set.
   * @param {string} roleName
   * @param {{ permissions: string[], reason: string }} payload
   */
  async updateRolePermissions(roleName, payload) {
    const res = await apiClient.patch(API_ENDPOINTS.ROLES_PERMISSIONS.ROLE(roleName), payload);
    return unwrap(res);
  },
};

export default rolesPermissionsService;
