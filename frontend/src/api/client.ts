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

// ── Cookie helper ─────────────────────────────────────────────────────────
function getCookie(name: string): string | undefined {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

// ── Request interceptor ───────────────────────────────────────────────────
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('emr_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  const csrf = getCookie('csrf_token');
  if (csrf) {
    config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────
apiClient.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('emr_user');
      localStorage.removeItem('emr_token');
      const url: string = err.config?.url || '';
      if (!url.endsWith('/auth/logout') && !url.endsWith('/auth/me')) {
        window.dispatchEvent(new Event('emr:logout'));
      }
    }

    if (!err.response && err.message === 'Network Error') {
      console.error(
        '[client] Network Error — likely CORS or Spring Boot server unreachable.\n' +
        `  Attempted URL: ${err.config?.baseURL}${err.config?.url}\n` +
        '  Check: 1) Spring Boot Java Backend is running on port 8080  2) CORS permits origin'
      );
    }

    return Promise.reject(err);
  }
);

export default apiClient;