import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

const unwrap = (res) => (res && res.success !== undefined && res.data !== undefined ? res.data : res);

/**
 * Dynamic Module Management API (Super Admin).
 * Module availability is separate from role permissions: see docs/module-access-rules.md.
 */
export const platformModuleService = {
  /** All modules with audiences, dependencies and status. */
  async listModules() {
    const res = await apiClient.get(API_ENDPOINTS.PLATFORM_MODULES.BASE);
    const data = unwrap(res);
    return Array.isArray(data) ? data : [];
  },

  /** What turning a module off would affect (users, workload, dependents). */
  async getImpact(moduleKey) {
    const res = await apiClient.get(API_ENDPOINTS.PLATFORM_MODULES.IMPACT(moduleKey));
    return unwrap(res);
  },

  /**
   * Change a module.
   * @param {string} moduleKey
   * @param {{ isEnabled?: boolean, publicVisible?: boolean, roleVisibility?: Record<string, boolean>, reason: string }} payload
   */
  async updateModule(moduleKey, payload) {
    const res = await apiClient.patch(API_ENDPOINTS.PLATFORM_MODULES.BY_KEY(moduleKey), payload);
    return unwrap(res);
  },

  /**
   * Save several module changes together (all or nothing), one reason for the audit log.
   * @param {Array<{ key: string, isEnabled?: boolean, publicVisible?: boolean, roleVisibility?: Record<string, boolean> }>} changes
   * @param {string} reason
   */
  async updateModulesBatch(changes, reason) {
    const res = await apiClient.patch(API_ENDPOINTS.PLATFORM_MODULES.BASE, { changes, reason });
    return unwrap(res);
  },

  /** Signed-in user's access per module: 'full' | 'read_only' | 'none'. */
  async getMyAccess() {
    const res = await apiClient.get(API_ENDPOINTS.PLATFORM_MODULES.MY_ACCESS);
    return unwrap(res)?.modules || [];
  },

  /** Public website configuration (which public modules are on). */
  async getPublicConfig() {
    const res = await apiClient.get(API_ENDPOINTS.PLATFORM_MODULES.PUBLIC_CONFIG);
    return unwrap(res);
  },
};

export default platformModuleService;
