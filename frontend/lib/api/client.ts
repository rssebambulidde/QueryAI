import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[API Client] Using API URL:', API_URL);
  if (API_URL.includes('localhost') && window.location.hostname !== 'localhost') {
    console.warn('[API Client] ⚠️ WARNING: API URL is localhost but not running locally!');
    console.warn('[API Client] Set NEXT_PUBLIC_API_URL in Cloudflare Pages environment variables.');
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const isLocalhost = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');
      const displayUrl = apiUrl.replace(/\/$/, '');
      if (isLocalhost && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        error.message = `Network Error: API URL is set to localhost. Please configure NEXT_PUBLIC_API_URL in Cloudflare Pages environment variables.`;
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        error.message = `Network Error: Unable to connect to the API server (${displayUrl}). Check that the backend is running and CORS allows this site.`;
      }
      return Promise.reject(error);
    }
    if (error.response?.status === 429) {
      return Promise.reject(error);
    }
    if (error.response?.status === 403 && error.response?.data?.error?.message) {
      error.message = error.response.data.error.message;
    }
    if (error.response?.status === 401) {
      const originalRequest = error.config;
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const isAuthPage = ['/login', '/signup', '/forgot-password', '/accept-invite'].includes(currentPath);
        const isRefreshRequest = originalRequest?.url?.includes('/api/auth/refresh');
        if (isAuthPage || isRefreshRequest) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          return Promise.reject(error);
        }
      }
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      if (refreshToken && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const { authApi } = await import('./auth');
          const refreshResponse = await authApi.refreshToken(refreshToken);
          if (refreshResponse.success && refreshResponse.data) {
            const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', newRefreshToken);
            }
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
          } else {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
            return Promise.reject(error);
          }
        } catch (refreshError) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
          return Promise.reject(error);
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
