import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';

export const useSystemStore = create((set) => ({
  status: 'idle', // 'idle' | 'loading' | 'success' | 'error'
  healthData: null,
  error: null,
  lastChecked: null,

  fetchHealth: async () => {
    set({ status: 'loading', error: null });
    try {
      const response = await apiClient.get('/health');
      set({
        status: 'success',
        healthData: response.data,
        error: null,
        lastChecked: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      set({
        status: 'error',
        healthData: null,
        error: err.message,
        lastChecked: new Date().toLocaleTimeString(),
      });
    }
  },
}));

