// client/src/api/client.ts
// Axios instance — connects to Spring Boot Java Backend (/api)

import axios from 'axios';

const _env = (import.meta as any).env ?? {};

const getBaseURL = (): string => {
  if (_env.VITE_API_URL) return _env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const { hostname, port, protocol } = window.location;
    if ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '5173') {
      return `${protocol}//localhost:8080/api`;
    }
  }
  return '/api';
};

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── In-Memory Access Token Storage (Never in localStorage or sessionStorage) ──
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

// ── Cookie helper ─────────────────────────────────────────────────────────
function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

// ── Request interceptor ───────────────────────────────────────────────────
apiClient.interceptors.request.use(config => {
  if (inMemoryAccessToken) {
    config.headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }
  const csrf = getCookie('csrf_token');
  if (csrf) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

// ── Shared Promise Lock (Eliminates Refresh Storms & Concurrent 401 Race Conditions) ──
let refreshPromise: Promise<string> | null = null;

// ── Response interceptor with silent JWT refresh ──────────────────────────
apiClient.interceptors.response.use(
  res => res,
  async err => {
    const originalRequest = err.config;

    // Handle 401 Unauthorized with silent token refresh
    if (err.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const url: string = originalRequest.url || '';
      // Don't attempt to refresh if the failed call was already login, refresh, or logout
      if (url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout')) {
        setAccessToken(null);
        localStorage.removeItem('emr_user');
        localStorage.removeItem('emr_token');
        if (!url.includes('/auth/logout')) {
          window.dispatchEvent(new Event('emr:logout'));
        }
        return Promise.reject(err);
      }

      originalRequest._retry = true;

      // If a refresh is already in flight, await the existing shared promise
      if (!refreshPromise) {
        refreshPromise = apiClient
          .post('/auth/refresh')
          .then(res => {
            const newToken = res.data?.token || res.data?.accessToken;
            if (!newToken) throw new Error('No access token received from refresh endpoint');
            setAccessToken(newToken);
            return newToken;
          })
          .catch(refreshErr => {
            setAccessToken(null);
            localStorage.removeItem('emr_user');
            localStorage.removeItem('emr_token');
            window.dispatchEvent(new Event('emr:logout'));
            return Promise.reject(refreshErr);
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const newToken = await refreshPromise;
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (e) {
        return Promise.reject(e);
      }
    }

    if (!err.response && (err.message === 'Network Error' || !navigator.onLine)) {
      console.warn(
        `[client] Offline Mode — Server unreachable (${err.config?.url}). Falling back to local IndexedDB.`
      );
    }

    return Promise.reject(err);
  }
);

export default apiClient;