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
  resendUserMessageId?: string; // When editing: update this user message and replace following assistant
}

export interface QuestionResponse {
  answer: string;
  model: string;
  sources?: Source[];
  followUpQuestions?: string[]; // AI-generated follow-up questions
  refusal?: boolean; // true when response is an off-topic refusal (11.1)
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
  status?: 'stored' | 'processing' | 'extracted' | 'embedding' | 'embedded' | 'processed' | 'failed' | 'embedding_failed';
  textLength?: number;
  extractionError?: string;
  embeddingError?: string;
  chunkCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Topic {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  scope_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  topic_id?: string;
  title?: string;
  metadata?: {
    filters?: {
      topic?: string;
      timeRange?: TimeRange;
      startDate?: string;
      endDate?: string;
      country?: string;
    };
    [key: string]: any;
  };
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

  askStream: async function* (request: QuestionRequest): AsyncGenerator<string | { followUpQuestions?: string[]; refusal?: boolean }, void, unknown> {
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
            if (data.followUpQuestions) {
              yield { followUpQuestions: data.followUpQuestions, refusal: data.refusal };
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

  summarize: async (originalResponse: string, keyword: string, sources?: Source[]): Promise<ApiResponse<{ summary: string }>> => {
    const response = await apiClient.post('/api/ai/summarize', { originalResponse, keyword, sources });
    return response.data;
  },

  writeEssay: async (originalResponse: string, keyword: string, sources?: Source[]): Promise<ApiResponse<{ essay: string }>> => {
    const response = await apiClient.post('/api/ai/essay', { originalResponse, keyword, sources });
    return response.data;
  },

  generateReport: async (originalResponse: string, keyword: string, sources?: Source[]): Promise<ApiResponse<{ report: string }>> => {
    const response = await apiClient.post('/api/ai/report', { originalResponse, keyword, sources });
    return response.data;
  },

  researchSessionSummary: async (conversationId: string, topicName: string): Promise<ApiResponse<{ summary: string }>> => {
    const response = await apiClient.post('/api/ai/research-session-summary', { conversationId, topicName });
    return response.data;
  },

  suggestedStarters: async (topicId: string): Promise<ApiResponse<{ starters: string[] }>> => {
    const response = await apiClient.get('/api/ai/suggested-starters', { params: { topicId } });
    return response.data;
  },
};

// Document API
export const documentApi = {
  list: async (): Promise<ApiResponse<DocumentItem[]>> => {
    const response = await apiClient.get('/api/documents');
    return response.data;
  },

  upload: async (file: File, onProgress?: (progress: number) => void, topicId?: string): Promise<ApiResponse<DocumentItem>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (topicId) {
      formData.append('topicId', topicId);
    }

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

  update: async (id: string, data: { title?: string; topicId?: string | null; metadata?: any; filters?: any }): Promise<ApiResponse<Conversation>> => {
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

// Topic API
export const topicApi = {
  list: async (): Promise<ApiResponse<Topic[]>> => {
    const response = await apiClient.get('/api/topics');
    return response.data;
  },

  get: async (id: string): Promise<ApiResponse<Topic>> => {
    const response = await apiClient.get(`/api/topics/${id}`);
    return response.data;
  },

  create: async (data: { name: string; description?: string; scopeConfig?: Record<string, any> }): Promise<ApiResponse<Topic>> => {
    const response = await apiClient.post('/api/topics', data);
    return response.data;
  },

  update: async (id: string, data: { name?: string; description?: string; scopeConfig?: Record<string, any> }): Promise<ApiResponse<Topic>> => {
    const response = await apiClient.put(`/api/topics/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/topics/${id}`);
    return response.data;
  },
};

// API Key interface
export interface ApiKey {
  id: string;
  user_id: string;
  topic_id?: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  description?: string;
  rate_limit_per_hour: number;
  rate_limit_per_day: number;
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  key?: string; // Only present on creation
}

// API Key API
export const apiKeyApi = {
  list: async (): Promise<ApiResponse<ApiKey[]>> => {
    const response = await apiClient.get('/api/api-keys');
    return response.data;
  },

  get: async (id: string): Promise<ApiResponse<ApiKey>> => {
    const response = await apiClient.get(`/api/api-keys/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    description?: string;
    topicId?: string;
    rateLimitPerHour?: number;
    rateLimitPerDay?: number;
    expiresAt?: string;
  }): Promise<ApiResponse<ApiKey>> => {
    const response = await apiClient.post('/api/api-keys', data);
    return response.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      rateLimitPerHour?: number;
      rateLimitPerDay?: number;
      isActive?: boolean;
      expiresAt?: string;
    }
  ): Promise<ApiResponse<ApiKey>> => {
    const response = await apiClient.put(`/api/api-keys/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/api-keys/${id}`);
    return response.data;
  },

  getUsage: async (id: string, options?: { startDate?: string; endDate?: string; limit?: number }): Promise<ApiResponse<{
    usage: Array<{
      id: string;
      api_key_id: string;
      endpoint: string;
      method: string;
      status_code?: number;
      response_time_ms?: number;
      created_at: string;
    }>;
    statistics: {
      totalRequests: number;
      successCount: number;
      errorCount: number;
      avgResponseTime: number;
      endpointStats: Record<string, { count: number; avgTime: number }>;
    };
  }>> => {
    const response = await apiClient.get(`/api/api-keys/${id}/usage`, {
      params: options,
    });
    return response.data;
  },
};

// Embedding Config interface
export interface EmbeddingConfig {
  id: string;
  user_id: string;
  topic_id: string;
  name: string;
  embed_code?: string;
  customization?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Embedding API
// Collection types
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  conversation_count?: number;
  conversations?: Conversation[];
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export const collectionApi = {
  list: async (): Promise<ApiResponse<Collection[]>> => {
    const response = await apiClient.get('/api/collections');
    return response.data;
  },

  get: async (id: string): Promise<ApiResponse<Collection>> => {
    const response = await apiClient.get(`/api/collections/${id}`);
    return response.data;
  },

  create: async (input: CreateCollectionInput): Promise<ApiResponse<Collection>> => {
    const response = await apiClient.post('/api/collections', input);
    return response.data;
  },

  update: async (id: string, input: UpdateCollectionInput): Promise<ApiResponse<Collection>> => {
    const response = await apiClient.put(`/api/collections/${id}`, input);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/collections/${id}`);
    return response.data;
  },

  addConversation: async (collectionId: string, conversationId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/collections/${collectionId}/conversations/${conversationId}`);
    return response.data;
  },

  removeConversation: async (collectionId: string, conversationId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/collections/${collectionId}/conversations/${conversationId}`);
    return response.data;
  },

  search: async (collectionId: string, query: string): Promise<ApiResponse<Conversation[]>> => {
    const response = await apiClient.get(`/api/collections/${collectionId}/search`, {
      params: { q: query },
    });
    return response.data;
  },
};

export const embeddingApi = {
  list: async (): Promise<ApiResponse<EmbeddingConfig[]>> => {
    const response = await apiClient.get('/api/embeddings');
    return response.data;
  },

  get: async (id: string): Promise<ApiResponse<EmbeddingConfig>> => {
    const response = await apiClient.get(`/api/embeddings/${id}`);
    return response.data;
  },

  create: async (data: {
    name: string;
    topicId: string;
    customization?: Record<string, any>;
  }): Promise<ApiResponse<EmbeddingConfig>> => {
    const response = await apiClient.post('/api/embeddings', data);
    return response.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      customization?: Record<string, any>;
      isActive?: boolean;
    }
  ): Promise<ApiResponse<EmbeddingConfig>> => {
    const response = await apiClient.put(`/api/embeddings/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/embeddings/${id}`);
    return response.data;
  },
};

// Analytics API Types
export interface QueryStatistics {
  totalQueries: number;
  queriesThisMonth: number;
  queriesLastMonth: number;
  queriesThisWeek: number;
  averagePerDay: number;
  peakDay: {
    date: string;
    count: number;
  };
}

export interface TopQuery {
  query: string;
  count: number;
  lastAsked: string;
  conversationId?: string;
}

export interface APIUsageMetrics {
  totalApiCalls: number;
  apiCallsThisMonth: number;
  apiCallsLastMonth: number;
  apiCallsThisWeek: number;
  averagePerDay: number;
  byEndpoint: Array<{
    endpoint: string;
    count: number;
  }>;
}

export interface UsageByDate {
  date: string;
  queries: number;
  apiCalls: number;
  documentUploads: number;
}

export interface AnalyticsOverview {
  queryStatistics: QueryStatistics;
  topQueries: TopQuery[];
  apiUsageMetrics: APIUsageMetrics;
  usageByDate: UsageByDate[];
  documentUploads: {
    total: number;
    thisMonth: number;
    lastMonth: number;
  };
}

export const analyticsApi = {
  getOverview: async (days: number = 30): Promise<ApiResponse<AnalyticsOverview>> => {
    const response = await apiClient.get('/api/analytics/overview', {
      params: { days },
    });
    return response.data;
  },

  getQueryStatistics: async (
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<QueryStatistics>> => {
    const response = await apiClient.get('/api/analytics/query-statistics', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getTopQueries: async (
    limit: number = 10,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<{ queries: TopQuery[] }>> => {
    const response = await apiClient.get('/api/analytics/top-queries', {
      params: { limit, startDate, endDate },
    });
    return response.data;
  },

  getAPIUsage: async (
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<APIUsageMetrics>> => {
    const response = await apiClient.get('/api/analytics/api-usage', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getUsageByDate: async (
    days: number = 30,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<{ usage: UsageByDate[] }>> => {
    const response = await apiClient.get('/api/analytics/usage-by-date', {
      params: { days, startDate, endDate },
    });
    return response.data;
  },
};
