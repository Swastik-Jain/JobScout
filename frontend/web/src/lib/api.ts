import axios from 'axios';

// In dev, VITE_BACKEND_URL is unset → baseURL is '' → Vite proxy forwards to localhost:8000.
// In production (Vercel), set VITE_BACKEND_URL=https://your-backend.onrender.com in Vercel's
// Environment Variables dashboard so requests reach the real FastAPI backend.
const configuredBaseUrl = (import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/+$/, '');

const normalizePath = (path: string): string => (path.startsWith('/') ? path : `/${path}`);

export const resolveApiUrl = (path: string): string =>
  configuredBaseUrl ? `${configuredBaseUrl}${normalizePath(path)}` : normalizePath(path);

const api = axios.create({
  baseURL: configuredBaseUrl || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Guard against accidental relative URLs and inject Bearer token from localStorage.
api.interceptors.request.use((config) => {
  if (config.url) {
    config.url = normalizePath(config.url);
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('jb_token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    // Global error handling could dispatch a toast notification here
    return Promise.reject(error);
  }
);

export default api;
