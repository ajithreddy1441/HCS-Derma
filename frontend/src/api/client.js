import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('nexus_token');
      if (!window.location.pathname.startsWith('/scan')) window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const origin = import.meta.env.VITE_API_ORIGIN || '';

export function fileUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${origin}${path}`;
}

export default api;
