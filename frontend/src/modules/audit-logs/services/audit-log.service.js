import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

const unwrap = (res) => (res && res.success !== undefined && res.data !== undefined ? res.data : res);

/**
 * Governance audit trail API (Super Admin, permission audit_logs:read).
 */
export const auditLogService = {
  /**
   * @param {{ source?: string, search?: string, from?: string, to?: string, page?: number, limit?: number }} params
   * @returns {Promise<{ data: object[], total: number, page: number, limit: number, totalPages: number }>}
   */
  async listAuditLogs(params = {}) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));
    const res = await apiClient.get(API_ENDPOINTS.AUDIT_LOGS.BASE, { params: clean });
    const data = unwrap(res);
    return {
      data: Array.isArray(data?.data) ? data.data : [],
      total: data?.total || 0,
      page: data?.page || 1,
      limit: data?.limit || 25,
      totalPages: data?.totalPages || 0,
    };
  },

  async listSources() {
    const res = await apiClient.get(API_ENDPOINTS.AUDIT_LOGS.SOURCES);
    return unwrap(res)?.sources || [];
  },
};

export default auditLogService;
