import axios, { AxiosError, AxiosInstance, AxiosProgressEvent } from 'axios';

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
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
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
    }>>(
      '/api/auth/refresh',
      { refreshToken }
    );
    return response.data;
  },

  forgotPassword: async (email: string): Promise<ApiResponse> => {
    const response = await apiClient.post<ApiResponse>('/api/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (data: {
    password: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<ApiResponse> => {
    const response = await apiClient.post<ApiResponse>(
      '/api/auth/reset-password',
      { password: data.password },
      {
        headers: {
          Authorization: `Bearer ${data.accessToken}`,
        },
      }
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

// AI API Types
export interface QuestionRequest {
  question: string;
  context?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableSearch?: boolean;
  topic?: string; // Any keyword for topic filtering
  maxSearchResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  searchDepth?: 'basic' | 'advanced';
  // Advanced search filters
  timeRange?: TimeRange;
  startDate?: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string (YYYY-MM-DD)
  country?: string; // ISO country code (e.g., 'US', 'UG', 'KE')
}

export interface Source {
  title: string;
  url: string;
  snippet?: string;
}

export interface QuestionResponse {
  answer: string;
  model: string;
  sources?: Source[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// AI API Functions
export const aiApi = {
  ask: async (data: QuestionRequest): Promise<ApiResponse<QuestionResponse>> => {
    const response = await apiClient.post<ApiResponse<QuestionResponse>>(
      '/api/ai/ask',
      data
    );
    return response.data;
  },

  askStream: async function* (
    data: QuestionRequest
  ): AsyncGenerator<string, void, unknown> {
    // Get token from localStorage
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    const response = await fetch(`${API_URL}/api/ai/ask/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `Streaming request failed: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch (e) {
        // If response is not JSON, use status text
      }
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.chunk) {
                yield parsed.chunk;
              }
              if (parsed.done) {
                return;
              }
              if (parsed.error) {
                throw new Error(parsed.error.message || 'Streaming error');
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};

// Search API Types
export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';

export interface SearchRequest {
  query: string;
  topic?: string; // Any keyword for topic filtering
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  // Time range filtering
  timeRange?: TimeRange;
  startDate?: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string (YYYY-MM-DD)
  // Location filtering
  country?: string; // ISO country code (e.g., 'US', 'UG', 'KE')
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
  author?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  topic?: string;
  cached?: boolean;
}

// Search API Functions
export const searchApi = {
  search: async (data: SearchRequest): Promise<ApiResponse<SearchResponse>> => {
    const response = await apiClient.post<ApiResponse<SearchResponse>>(
      '/api/search',
      data
    );
    return response.data;
  },

  getCacheStats: async (): Promise<ApiResponse<{
    size: number;
    maxSize: number;
    entries: number;
  }>> => {
    const response = await apiClient.get<ApiResponse<{
      size: number;
      maxSize: number;
      entries: number;
    }>>('/api/search/cache/stats');
    return response.data;
  },

  clearCache: async (): Promise<ApiResponse> => {
    const response = await apiClient.delete<ApiResponse>('/api/search/cache');
    return response.data;
  },
};

// Document API Types
export interface DocumentItem {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt?: string;
  updatedAt?: string;
}

export const documentApi = {
  upload: async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<DocumentItem>> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post<ApiResponse<DocumentItem>>(
      '/api/documents/upload',
      formData,
      {
        timeout: 30000,
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total && onProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      }
    );
    return response.data;
  },

  list: async (): Promise<ApiResponse<DocumentItem[]>> => {
    const response = await apiClient.get<ApiResponse<DocumentItem[]>>(
      '/api/documents'
    );
    return response.data;
  },

  download: async (filePath: string): Promise<Blob> => {
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Normalize API_URL to avoid double slashes
    const baseUrl = API_URL.replace(/\/+$/, ''); // Remove trailing slashes
    const url = `${baseUrl}/api/documents/download?path=${encodeURIComponent(filePath)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to download document';
      try {
        const errorData = await response.json();
        errorMessage = errorData?.error?.message || errorData?.message || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.blob();
  },

  delete: async (path: string): Promise<ApiResponse> => {
    const response = await apiClient.delete<ApiResponse>('/api/documents', {
      data: { path },
    });
    return response.data;
  },
};

export default apiClient;
