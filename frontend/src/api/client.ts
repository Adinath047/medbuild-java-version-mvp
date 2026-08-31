// client/src/api/client.ts
// Axios instance — connects to Spring Boot Java Backend (/api)

import axios from 'axios';

const _env = (import.meta as any).env ?? {};

const getBaseURL = (): string => {
  if (_env.VITE_API_URL) return _env.VITE_API_URL;
  return '/api';
};

export const apiClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── In-Memory Access Token Storage with LocalStorage Continuity ──
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('emr_token', token);
    } else {
      localStorage.removeItem('emr_token');
    }
  }
};

export const getAccessToken = (): string | null => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem('emr_token');
    if (cached) {
      inMemoryAccessToken = cached;
      return cached;
    }
  }
  return null;
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
  const token = getAccessToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
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

    // Handle 402 Payment Required (License Locked / Read-Only Mode)
    if (err.response?.status === 402) {
      const data = err.response.data;
      console.warn('[client] 402 Payment Required: Hospital license is in read-only mode.', data);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('emr:license_locked', { detail: data }));
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