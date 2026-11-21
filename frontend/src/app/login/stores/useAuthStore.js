import { create } from 'zustand';
import { authService } from '../services/auth.service';

/**
 * Dedicated Login & Authentication Zustand Store
 * Located in login folder as requested.
 * Strictly manages authentication state and dynamic user profile from DB.
 * NEVER stores JWT tokens in client state or localStorage (HttpOnly cookies only).
 */
let inFlightSessionPromise = null;

export const useAuthStore = create((set, get) => ({
  user: null, // { userId, email, firstName, lastName, roles, roleNames, permissions, primaryDashboardRoute, primaryRoleSlug }
  isAuthenticated: false,
  isLoading: true, // true on initial load while hydrating session
  error: null,

  /**
   * Unified Login for all dynamic roles
   */
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      const user = response?.user || response;

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true, user };
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        'Authentication failed. Please check your credentials and try again.';

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: errorMessage,
      });

      throw new Error(errorMessage);
    }
  },

  /**
   * Session Hydration on Mount / F5 Refresh
   * Calls /auth/me (browser attaches HttpOnly cookies automatically)
   * Deduplicates concurrent in-flight requests.
   */
  checkSession: async () => {
    if (inFlightSessionPromise) {
      return inFlightSessionPromise;
    }

    if (!get().isAuthenticated) {
      set({ isLoading: true });
    }

    inFlightSessionPromise = (async () => {
      try {
        const user = await authService.getMe();
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return user;
      } catch (err) {
        // Network error / server restart / 5xx: keep an existing session instead of logging out.
        // Only a real auth rejection (401/403, or a failed refresh) ends the session.
        const isAuthFailure = err?.status === 401 || err?.status === 403 || err?.response?.status === 401;
        if (!isAuthFailure && get().isAuthenticated) {
          set({ isLoading: false });
          return get().user;
        }

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        return null;
      } finally {
        inFlightSessionPromise = null;
      }
    })();

    return inFlightSessionPromise;
  },

  /**
   * Logout
   * Clears server-side HttpOnly cookies and client state
   */
  logout: async (callApi = true) => {
    if (callApi) {
      try {
        await authService.logout();
      } catch (e) {
        // Continue clearing client state even if backend network request fails
      }
    }

    // Clear any client-accessible cookies on domain
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name) {
          document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;`;
          document.cookie = `${name}=; Path=/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;`;
        }
      }
    }

    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  /**
   * Manually update user profile in state
   */
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  /**
   * Clear error message
   */
  clearError: () => set({ error: null }),
}));

export default useAuthStore;

