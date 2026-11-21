import axios from 'axios';
import { API_ENDPOINTS } from '@/constants/endpoints';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/**
 * Centralized Axios instance configured for HttpOnly cookie authentication
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Required for sending/receiving HttpOnly cookies across origins
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Share identical in-flight GET requests (browser only). When several components ask for the
 * same data at the same moment (header + page both loading the cart, React Strict Mode mounting
 * twice in development), only one request goes to the server and every caller gets its result.
 * Nothing is cached: once the response arrives, the next call fetches fresh data.
 * Pass { dedupe: false } or an AbortSignal to opt out.
 */
const inflightGets = new Map();
const rawGet = apiClient.get.bind(apiClient);
apiClient.get = (url, config = {}) => {
  if (typeof window === 'undefined' || config.dedupe === false || config.signal) {
    return rawGet(url, config);
  }
  const key = `${url}|${JSON.stringify(config.params || {})}|${config.responseType || ''}`;
  const pending = inflightGets.get(key);
  if (pending) return pending;
  const request = rawGet(url, config).finally(() => inflightGets.delete(key));
  inflightGets.set(key, request);
  return request;
};

// URLs that should never trigger an automatic refresh attempt on 401
const REFRESH_EXCLUDED_URLS = [
  API_ENDPOINTS.AUTH.LOGIN,
  API_ENDPOINTS.AUTH.REFRESH_TOKEN,
  API_ENDPOINTS.AUTH.LOGOUT,
];

// Concurrency control variables for silent token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Response Interceptor:
 * 1. Unwraps standard NestJS response envelope ({ success: true, data: { ... } })
 * 2. Catches 401 errors and handles concurrency-safe token refresh
 */
apiClient.interceptors.response.use(
  (response) => {
    // Transparently unwrap NestJS TransformInterceptor response envelope
    if (response.data && response.data.success !== undefined && response.data.data !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // If no response from server (network error, CORS block, etc.)
    if (!error.response) {
      return Promise.reject(new Error(error.message || 'Network error connecting to API server'));
    }

    const status = error.response.status;
    const requestUrl = originalRequest?.url || '';

    // Check if the endpoint is excluded from refresh loops
    const isExcluded = REFRESH_EXCLUDED_URLS.some((excluded) =>
      requestUrl.includes(excluded),
    );

    // Only attempt refresh on 401 Unauthorized (NEVER on 403 Forbidden or excluded routes)
    if (status === 401 && !originalRequest._retry && !isExcluded) {
      if (isRefreshing) {
        // Queue concurrent requests while a single refresh is in-flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Browser automatically sends HttpOnly 'refreshToken' cookie to /auth/refresh
        await axios.post(
          `${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH_TOKEN}`,
          {},
          { withCredentials: true },
        );

        // Process queued requests
        processQueue(null);

        // Replay original request (browser now attaches new HttpOnly 'accessToken' cookie)
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed (token expired, revoked, or invalid)
        processQueue(refreshError, null);

        // Clear client auth state and redirect if running in the browser
        if (typeof window !== 'undefined') {
          // Dynamically import store to avoid circular reference
          import('@/app/login/stores/useAuthStore').then(({ useAuthStore }) => {
            useAuthStore.getState().logout(false);
          });
          // Only redirect to login if the user was on a protected dashboard route
          if (window.location.pathname.startsWith('/dashboard')) {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Extract backend error message cleanly
    const errorMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      `Request failed with status ${status}`;

    const normalizedError = new Error(Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage);
    normalizedError.status = status; // lets callers tell auth failures (401/403) from other errors
    return Promise.reject(normalizedError);
  },
);

export default apiClient;

