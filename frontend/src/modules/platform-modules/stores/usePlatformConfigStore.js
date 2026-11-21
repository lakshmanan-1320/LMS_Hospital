import { create } from 'zustand';
import { platformModuleService } from '../services/platform-module.service';
import { useAuthStore } from '@/app/login/stores/useAuthStore';

/**
 * Module availability for the current visitor, used to build menus, the public header and
 * page guards. The backend (ModuleAccessGuard) still enforces every request; this only
 * hides what the visitor can't use.
 *
 * - Public visitors: from /platform-modules/public-config.
 * - Signed-in users: from /platform-modules/my-access ('full' | 'read_only' | 'none').
 */
export const usePlatformConfigStore = create((set, get) => ({
  /** key -> boolean (on and visible on the public website) */
  publicModules: {},
  /** key -> 'full' | 'read_only' | 'none' for the signed-in user */
  myAccess: {},
  publicLoaded: false,
  myAccessLoaded: false,
  myAccessUserId: null,

  fetchPublicConfig: async () => {
    try {
      const res = await platformModuleService.getPublicConfig();
      const publicModules = Object.fromEntries((res?.modules || []).map((m) => [m.key, Boolean(m.enabled)]));
      set({ publicModules, publicLoaded: true });
    } catch {
      // Keep defaults (everything shown); the backend still blocks disabled modules.
      set({ publicLoaded: true });
    }
  },

  fetchMyAccess: async (userId) => {
    try {
      const modules = await platformModuleService.getMyAccess();
      set({
        myAccess: Object.fromEntries(modules.map((m) => [m.key, m.access])),
        myAccessLoaded: true,
        myAccessUserId: userId,
      });
    } catch {
      set({ myAccessLoaded: true, myAccessUserId: userId });
    }
  },

  clearMyAccess: () => set({ myAccess: {}, myAccessLoaded: false, myAccessUserId: null }),
}));

/**
 * Access to one module for the current visitor:
 * 'full' | 'read_only' | 'none' | 'unknown' (still loading, treat as available).
 */
export function useModuleAccess(moduleKey) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { publicModules, myAccess, publicLoaded, myAccessLoaded } = usePlatformConfigStore();

  if (isAuthenticated) {
    if (!myAccessLoaded) return 'unknown';
    return myAccess[moduleKey] || 'none';
  }
  if (!publicLoaded) return 'unknown';
  if (!(moduleKey in publicModules)) return 'none';
  return publicModules[moduleKey] ? 'full' : 'none';
}

/**
 * Public-website visibility of a module (header links, homepage sections), regardless of login.
 * true while loading, so links don't flicker away.
 */
export function usePublicModule(moduleKey) {
  const { publicModules, publicLoaded } = usePlatformConfigStore();
  if (!publicLoaded) return true;
  return publicModules[moduleKey] !== false;
}

export default usePlatformConfigStore;
