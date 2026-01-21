import axios, { AxiosInstance } from 'axios';

// API Base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
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
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface User {
  id: string;
  email: string;
  full_name?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

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
  topic?: string;
  maxSearchResults?: number;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  startDate?: string;
  endDate?: string;
  country?: string;
  // RAG options
  enableDocumentSearch?: boolean;
  enableWebSearch?: boolean;
  topicId?: string;
  documentIds?: string[];
  maxDocumentChunks?: number;
  minScore?: number;
  // Conversation management
  conversationId?: string;
}

export interface QuestionResponse {
  answer: string;
  model: string;
  sources?: Source[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  conversationId?: string;
}

export interface Source {
  type: 'document' | 'web';
  title: string;
  url?: string;
  documentId?: string;
  snippet?: string;
  score?: number;
}

export interface DocumentItem {
  id?: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  status?: 'processing' | 'extracted' | 'embedding' | 'processed' | 'failed' | 'embedding_failed';
  textLength?: number;
  extractionError?: string;
  chunkCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  topic_id?: string;
  title?: string;
  created_at: string;
  updated_at: string;
  messageCount?: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  metadata?: Record<string, any>;
  created_at: string;
}

export type TimeRange = 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';

// Auth API
export const authApi = {
  signup: async (data: { email: string; password: string; fullName?: string }): Promise<ApiResponse<{ user: User; session: Session }>> => {
    const response = await apiClient.post('/api/auth/signup', data);
    return response.data;
  },

  login: async (data: { email: string; password: string }): Promise<ApiResponse<{ user: User; session: Session }>> => {
    const response = await apiClient.post('/api/auth/login', data);
    return response.data;
  },

  logout: async (): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/logout');
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse<Session>> => {
    const response = await apiClient.post('/api/auth/refresh', { refreshToken });
    return response.data;
  },

  forgotPassword: async (email: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (data: { password: string; accessToken: string; refreshToken: string }): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/reset-password', data);
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },
};

// AI API
export const aiApi = {
  ask: async (request: QuestionRequest): Promise<ApiResponse<QuestionResponse>> => {
    const response = await apiClient.post('/api/ai/ask', request);
    return response.data;
  },

  askStream: async function* (request: QuestionRequest): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${API_URL}/api/ai/ask/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: typeof window !== 'undefined' ? `Bearer ${localStorage.getItem('accessToken') || ''}` : '',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No reader available');
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.chunk) {
              yield data.chunk;
            }
            if (data.done) {
              return;
            }
            if (data.error) {
              throw new Error(data.error.message || 'Stream error');
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  },
};

// Document API
export const documentApi = {
  list: async (): Promise<ApiResponse<DocumentItem[]>> => {
    const response = await apiClient.get('/api/documents');
    return response.data;
  },

  upload: async (file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<DocumentItem>> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return response.data;
  },

  delete: async (pathOrId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete('/api/documents', {
      params: { path: pathOrId, id: pathOrId },
    });
    return response.data;
  },

  download: async (path: string): Promise<Blob> => {
    const response = await apiClient.get(`/api/documents/download?path=${encodeURIComponent(path)}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  process: async (documentId: string, options?: { maxChunkSize?: number; overlapSize?: number }): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/documents/${documentId}/process`, options || {});
    return response.data;
  },

  clearProcessing: async (documentId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/documents/${documentId}/chunks`);
    return response.data;
  },
};

// Conversation API
export const conversationApi = {
  list: async (options?: { limit?: number; offset?: number; includeMetadata?: boolean }): Promise<ApiResponse<Conversation[]>> => {
    const response = await apiClient.get('/api/conversations', {
      params: options,
    });
    return response.data;
  },

  get: async (id: string): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.get(`/api/conversations/${id}`);
    return response.data;
  },

  create: async (data: { title?: string; topicId?: string }): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.post('/api/conversations', data);
    return response.data;
  },

  update: async (id: string, data: { title?: string; topicId?: string }): Promise<ApiResponse<Conversation>> => {
    const response = await apiClient.put(`/api/conversations/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/conversations/${id}`);
    return response.data;
  },

  getMessages: async (id: string, options?: { limit?: number; offset?: number }): Promise<ApiResponse<Message[]>> => {
    const response = await apiClient.get(`/api/conversations/${id}/messages`, {
      params: options,
    });
    return response.data;
  },

  saveMessage: async (id: string, data: { role: 'user' | 'assistant'; content: string; sources?: Source[]; metadata?: Record<string, any> }): Promise<ApiResponse<Message>> => {
    const response = await apiClient.post(`/api/conversations/${id}/messages`, data);
    return response.data;
  },
};
