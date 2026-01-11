import axios, { AxiosError, AxiosInstance } from 'axios';

// API Client Configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Auth Types
export interface SignupData {
  email: string;
  password: string;
  fullName?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName?: string;
  };
  session: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface User {
  id: string;
  email: string;
  fullName?: string;
}

// Auth API Functions
export const authApi = {
  signup: async (data: SignupData): Promise<ApiResponse<AuthResponse>> => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/api/auth/signup',
      data
    );
    return response.data;
  },

  login: async (data: LoginData): Promise<ApiResponse<AuthResponse>> => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/api/auth/login',
      data
    );
    return response.data;
  },

  logout: async (): Promise<ApiResponse> => {
    const response = await apiClient.post<ApiResponse>('/api/auth/logout');
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }>> => {
    const response = await apiClient.post<ApiResponse<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>>('/api/auth/refresh', { refreshToken });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<ApiResponse> => {
    const response = await apiClient.post<ApiResponse>(
      '/api/auth/forgot-password',
      { email }
    );
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>(
      '/api/auth/me'
    );
    return response.data;
  },
};

export default apiClient;
