import { apiClient } from '@/lib/axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

export const dashboardService = {
  async getOverview() {
    return apiClient.get(API_ENDPOINTS.DASHBOARD.OVERVIEW);
  },
};
