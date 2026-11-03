import axios from 'axios';

const API_BASE = '';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dermai_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear invalid session
      localStorage.removeItem('dermai_token');
      localStorage.removeItem('dermai_user');
      window.dispatchEvent(new Event('dermai-auth-expired'));
    }
    return Promise.reject(error);
  }
);

export const getStoredToken = () => {
  return localStorage.getItem('dermai_token');
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('dermai_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const setAuthSession = (token, user) => {
  localStorage.setItem('dermai_token', token);
  localStorage.setItem('dermai_user', JSON.stringify(user));
};

export const clearAuthSession = () => {
  localStorage.removeItem('dermai_token');
  localStorage.removeItem('dermai_user');
};

export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const token = localStorage.getItem('dermai_token');
  if (token && url.startsWith('/api/images/')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }
  return url;
};

export default api;
