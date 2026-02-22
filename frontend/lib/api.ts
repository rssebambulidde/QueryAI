import axios, { AxiosInstance } from 'axios';

// API Base URL
// Note: NEXT_PUBLIC_ variables are embedded at BUILD TIME in Next.js
// If you change this variable, you must rebuild/redeploy
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Debug: Log API URL in development (will be undefined in production if not set)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[API Client] Using API URL:', API_URL);
  if (API_URL.includes('localhost') && window.location.hostname !== 'localhost') {
    console.warn('[API Client] ⚠️ WARNING: API URL is localhost but not running locally!');
    console.warn('[API Client] Set NEXT_PUBLIC_API_URL in Cloudflare Pages environment variables.');
  }
}

// Create axios instance (exported for use by api-health, api-validation, api-ab-testing)
export const apiClient: AxiosInstance = axios.create({
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
    // Handle network errors (no response from server)
    if (!error.response) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const isLocalhost = apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');
      
      // Provide helpful error message for network errors
      const displayUrl = apiUrl.replace(/\/$/, '');
      if (isLocalhost && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
        // Production environment but API URL is localhost
        error.message = `Network Error: API URL is set to localhost. Please configure NEXT_PUBLIC_API_URL in Cloudflare Pages environment variables.`;
      } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        // Generic network error - include URL so user can verify what the app is trying to reach
        error.message = `Network Error: Unable to connect to the API server (${displayUrl}). Check that the backend is running and CORS allows this site.`;
      }
      return Promise.reject(error);
    }
    
    // Handle rate limit errors (429) - don't retry, just show error
    if (error.response?.status === 429) {
      // Rate limit exceeded - return error immediately without retry
      return Promise.reject(error);
    }

    // Use backend user-friendly messages for 403 (limit/feature errors)
    if (error.response?.status === 403 && error.response?.data?.error?.message) {
      error.message = error.response.data.error.message;
    }

    if (error.response?.status === 401) {
      // Token expired or invalid - try to refresh
      const originalRequest = error.config;
      
      // Don't retry if this is already a refresh request or if we're on an auth page
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath === '/login' || currentPath === '/signup' || currentPath === '/forgot-password' || currentPath === '/accept-invite';
        const isRefreshRequest = originalRequest?.url?.includes('/api/auth/refresh');
        
        if (isAuthPage || isRefreshRequest) {
          // Clear tokens and dispatch unauthorized event
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          return Promise.reject(error);
        }
      }
      
      // Try to refresh the token
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      
      if (refreshToken && originalRequest && !originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          // Import authApi here to avoid circular dependency
          const { authApi } = await import('./api');
          const refreshResponse = await authApi.refreshToken(refreshToken);
          
          if (refreshResponse.success && refreshResponse.data) {
            // Update tokens
            const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data;
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', newRefreshToken);
            }
            
            // Update the original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            
            // Retry the original request
            return apiClient(originalRequest);
          } else {
            // Refresh failed - clear tokens and logout
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
            return Promise.reject(error);
          }
        } catch (refreshError) {
          // Refresh failed - clear tokens and logout
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
          return Promise.reject(error);
        }
      } else {
        // No refresh token available - clear tokens and logout
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

// Types
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role?: 'user' | 'super_admin';
  subscriptionTier?: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
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
  mode?: 'research' | 'chat';
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
  enableWebSearch?: boolean;
  // Conversation management
  conversationId?: string;
  resendUserMessageId?: string; // When editing: update this user message and replace following assistant
  // Advanced features
  enableQueryExpansion?: boolean;
  queryExpansionSettings?: {
    expansionMethod?: 'synonym' | 'semantic' | 'hybrid';
    maxExpansions?: number;
    confidenceThreshold?: number;
  };
  enableReranking?: boolean;
  rerankingSettings?: {
    rerankingMethod?: 'cross-encoder' | 'reciprocal-rank-fusion' | 'learned';
    topK?: number;
    diversityWeight?: number;
  };
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
  // Advanced features
  queryExpansion?: {
    original: string;
    expanded: string;
    reasoning?: string;
  };
  reranking?: {
    impact: {
      before: number[];
      after: number[];
      improvement: number;
    };
    preview?: {
      originalRanking: Array<{ id: string; title: string; score: number }>;
      reranked: Array<{ id: string; title: string; score: number }>;
    };
  };
  contextChunks?: Array<{
    id: string;
    content: string;
    source: {
      type: 'document' | 'web';
      title: string;
      url?: string;
      documentId?: string;
    };
    score: number;
    tokens: number;
    selected: boolean;
    reasoning?: string;
  }>;
  selectionReasoning?: string;
  cost?: {
    perQuery: number;
    total: number;
    breakdown: {
      embedding?: number;
      search?: number;
      ai?: {
        prompt: number;
        completion: number;
        total: number;
      };
      storage?: number;
      other?: number;
    };
  };
}

export interface Source {
  type: 'document' | 'web';
  title: string;
  url?: string;
  documentId?: string;
  snippet?: string;
  score?: number;
  pageNumber?: number;
  sectionTitle?: string;
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
  metadata?: Record<string, unknown>;
}

/** @deprecated Topics retired in v2 — kept for type compatibility */
export interface Topic {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  scope_config?: Record<string, any>;
  parent_topic_id?: string | null;
  topic_path?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  topic_id?: string;
  title?: string;
  mode?: 'research' | 'chat';
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
  version: number;
  parent_message_id?: string | null;
  created_at: string;
}

/** Lightweight version summary for UI version indicators. */
export interface MessageVersion {
  id: string;
  version: number;
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

  requestMagicLink: async (email: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/magic-link', { email });
    return response.data;
  },

  inviteUser: async (email: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/invite', { email });
    return response.data;
  },

  /** Invite a friend from the signup page (no auth required). Rate-limited by IP. */
  inviteFriend: async (email: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/invite-guest', { email });
    return response.data;
  },

  resetPassword: async (data: { password: string; accessToken: string; refreshToken: string }): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(
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

  verifyEmail: async (data: { token: string; email?: string }): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/verify-email', data);
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.get('/api/auth/me');
    return response.data;
  },

  uploadAvatar: async (file: File): Promise<ApiResponse<{ avatar_url: string }>> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await apiClient.post('/api/auth/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateProfile: async (data: { full_name?: string; avatar_url?: string }): Promise<ApiResponse<{ user: User }>> => {
    const response = await apiClient.put('/api/auth/profile', data);
    return response.data;
  },

  changeEmail: async (data: { newEmail: string }): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/change-email', data);
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<void>> => {
    const response = await apiClient.post('/api/auth/change-password', data);
    return response.data;
  },
};

/**
 * Internal SSE streaming helper for generation endpoints (summarize, essay, report).
 * Yields plain text chunks. Throws on HTTP or stream errors.
 */
async function* _streamGeneration(
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: typeof window !== 'undefined' ? `Bearer ${localStorage.getItem('accessToken') || ''}` : '',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No reader available');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) { reader.cancel(); return; }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); continue; }
        if (line.startsWith('data: ')) {
          const payload = line.slice(6);
          switch (currentEvent) {
            case 'chunk':
              yield payload;
              break;
            case 'done':
              return;
            case 'error':
              try { const err = JSON.parse(payload); throw new Error(err.message || 'Stream error'); } catch (e) { if (e instanceof Error && e.message !== 'Stream error') throw e; }
              break;
            default:
              // Legacy fallback
              try {
                const data = JSON.parse(payload);
                if (data.chunk) yield data.chunk;
                if (data.done) return;
                if (data.error) throw new Error(data.error.message || 'Stream error');
              } catch { /* skip */ }
              break;
          }
          currentEvent = '';
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// AI API
export const aiApi = {
  ask: async (request: QuestionRequest): Promise<ApiResponse<QuestionResponse>> => {
    const response = await apiClient.post('/api/ai/ask', request);
    return response.data;
  },

  askStream: async function* (
    request: QuestionRequest,
    options?: {
      signal?: AbortSignal;
      onError?: (error: Error) => void;
      maxRetries?: number;
      retryDelay?: number;
    }
  ): AsyncGenerator<string | { followUpQuestions?: string[]; refusal?: boolean; qualityScore?: number; sources?: Source[] }, void, unknown> {
    const maxRetries = options?.maxRetries ?? 3;
    const retryDelay = options?.retryDelay ?? 1000;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const response = await fetch(`${API_URL}/api/ai/ask/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: typeof window !== 'undefined' ? `Bearer ${localStorage.getItem('accessToken') || ''}` : '',
          },
          body: JSON.stringify(request),
          signal: options?.signal,
        });

        if (!response.ok) {
          // Don't retry on client errors (4xx) except 429
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          // Retry on server errors (5xx) and rate limits (429)
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No reader available');
        }

        let buffer = '';

        try {
          while (true) {
            // Check if aborted
            if (options?.signal?.aborted) {
              reader.cancel();
              return;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
                continue;
              }

              if (line.startsWith('data: ')) {
                const payload = line.slice(6);

                switch (currentEvent) {
                  case 'chunk':
                    // Plain text — no JSON parsing needed
                    yield payload;
                    break;
                  case 'sources':
                    try {
                      yield { sources: JSON.parse(payload) as Source[] };
                    } catch { /* skip malformed */ }
                    break;
                  case 'followUpQuestions':
                    try {
                      const fup = JSON.parse(payload);
                      yield { followUpQuestions: fup.questions, refusal: fup.refusal };
                    } catch { /* skip malformed */ }
                    break;
                  case 'qualityScore':
                    try {
                      const qs = JSON.parse(payload);
                      yield { qualityScore: qs.score };
                    } catch { /* skip malformed */ }
                    break;
                  case 'done':
                    return;
                  case 'error':
                    try {
                      const err = JSON.parse(payload);
                      throw new Error(err.message || 'Stream error');
                    } catch (e) {
                      if (e instanceof Error && e.message !== 'Stream error') throw e;
                    }
                    break;
                  default:
                    // Legacy fallback: unnamed data-only lines (backwards compat)
                    try {
                      const data = JSON.parse(payload);
                      if (data.sources) { yield { sources: data.sources }; }
                      if (data.chunk) { yield data.chunk; }
                      if (data.followUpQuestions) { yield { followUpQuestions: data.followUpQuestions, refusal: data.refusal }; }
                      if (data.qualityScore !== undefined) { yield { qualityScore: data.qualityScore }; }
                      if (data.done) { return; }
                      if (data.error) { throw new Error(data.error.message || 'Stream error'); }
                    } catch { /* skip */ }
                    break;
                }
                currentEvent = '';
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Success - exit retry loop
        return;
      } catch (error: any) {
        // Don't retry if aborted
        if (options?.signal?.aborted || error.name === 'AbortError') {
          return;
        }

        // Don't retry on network errors if we've exhausted retries
        if (retryCount >= maxRetries) {
          if (options?.onError) {
            options.onError(error);
          }
          throw error;
        }

        // Retry with exponential backoff
        retryCount++;
        const delay = retryDelay * Math.pow(2, retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
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

  // ── Streaming generation variants ────────────────────────────────────

  summarizeStream: async function* (
    originalResponse: string,
    keyword: string,
    sources?: Source[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    yield* _streamGeneration('/api/ai/summarize/stream', { originalResponse, keyword, sources }, signal);
  },

  writeEssayStream: async function* (
    originalResponse: string,
    keyword: string,
    sources?: Source[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    yield* _streamGeneration('/api/ai/essay/stream', { originalResponse, keyword, sources }, signal);
  },

  generateReportStream: async function* (
    originalResponse: string,
    keyword: string,
    sources?: Source[],
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    yield* _streamGeneration('/api/ai/report/stream', { originalResponse, keyword, sources }, signal);
  },

  researchSessionSummary: async (conversationId: string, topicName: string): Promise<ApiResponse<{ summary: string }>> => {
    const response = await apiClient.post('/api/ai/research-session-summary', { conversationId, topicName });
    return response.data;
  },

  suggestedStarters: async (topicId: string): Promise<ApiResponse<{ starters: string[] }>> => {
    const response = await apiClient.get('/api/ai/suggested-starters', { params: { topicId } });
    return response.data;
  },

  regenerate: async (
    messageId: string,
    conversationId: string,
    options?: {
      model?: string;
      maxDocumentChunks?: number;
      maxSearchResults?: number;
      enableWebSearch?: boolean;
      enableDocumentSearch?: boolean;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ApiResponse<{
    newMessage: Message;
    versions: Message[];
    answer: string;
    model: string;
    sources?: Source[];
    followUpQuestions?: string[];
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    responseVersion: number;
  }>> => {
    const response = await apiClient.post('/api/ai/regenerate', {
      messageId,
      conversationId,
      options,
    });
    return response.data;
  },

  /**
   * Streaming regeneration — same SSE protocol as askStream with an additional
   * `version` event emitted at the end containing the new version info.
   */
  regenerateStream: async function* (
    messageId: string,
    conversationId: string,
    options?: {
      model?: string;
      maxDocumentChunks?: number;
      maxSearchResults?: number;
      enableWebSearch?: boolean;
      enableDocumentSearch?: boolean;
      temperature?: number;
      maxTokens?: number;
    },
    signal?: AbortSignal,
  ): AsyncGenerator<
    string | { sources?: Source[]; followUpQuestions?: string[]; qualityScore?: number; version?: { version: number; messageId: string; versions: Array<{ id: string; version: number; content: string; sources?: Source[]; metadata?: Record<string, any>; created_at: string }> } },
    void,
    unknown
  > {
    const response = await fetch(`${API_URL}/api/ai/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: typeof window !== 'undefined' ? `Bearer ${localStorage.getItem('accessToken') || ''}` : '',
      },
      body: JSON.stringify({ messageId, conversationId, options }),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) errorMessage = parsed.error.message;
      } catch { /* use default */ }
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) { reader.cancel(); return; }
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); continue; }
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);

            switch (currentEvent) {
              case 'chunk':
                yield payload;
                break;
              case 'sources':
                try { yield { sources: JSON.parse(payload) as Source[] }; } catch { /* skip */ }
                break;
              case 'followUpQuestions':
                try { const fup = JSON.parse(payload); yield { followUpQuestions: fup.questions }; } catch { /* skip */ }
                break;
              case 'qualityScore':
                try { const qs = JSON.parse(payload); yield { qualityScore: qs.score }; } catch { /* skip */ }
                break;
              case 'version':
                try { yield { version: JSON.parse(payload) }; } catch { /* skip */ }
                break;
              case 'done':
                return;
              case 'error':
                try { const err = JSON.parse(payload); throw new Error(err.message || 'Regeneration stream error'); } catch (e) { if (e instanceof Error && e.message !== 'Regeneration stream error') throw e; }
                break;
              default:
                break;
            }
            currentEvent = '';
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  getMessageVersions: async (
    messageId: string,
  ): Promise<ApiResponse<{ versions: Message[] }>> => {
    const response = await apiClient.get(`/api/ai/messages/${messageId}/versions`);
    return response.data;
  },
};

// ─── Search API ──────────────────────────────────────────────────────────────

export interface SemanticSearchResult {
  id: string;
  documentId: string;
  title?: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

// searchApi.semantic retired in v2 (document search removed)

// ─── Queue API ───────────────────────────────────────────────────────────────

export interface QueueJobSubmitResult {
  jobId: string;
  status: string;
  priority?: number;
}

export interface QueueJobStatus {
  id: string;
  state: string;
  progress?: number;
  result?: { success: boolean; answer?: string; sources?: Source[]; error?: string; processingTime?: number };
  error?: string;
  timestamp?: number;
}

export const queueApi = {
  submit: async (request: QuestionRequest, priority?: 'low' | 'normal' | 'high' | 'urgent'): Promise<ApiResponse<QueueJobSubmitResult>> => {
    const response = await apiClient.post('/api/ai/ask/queue', { ...request, priority });
    return response.data;
  },

  getStatus: async (jobId: string): Promise<ApiResponse<QueueJobStatus>> => {
    const response = await apiClient.get(`/api/ai/queue/job/${jobId}`);
    return response.data;
  },

  cancel: async (jobId: string): Promise<ApiResponse<boolean>> => {
    const response = await apiClient.delete(`/api/ai/queue/job/${jobId}`);
    return response.data;
  },

  getStats: async (): Promise<ApiResponse<any>> => {
    const response = await apiClient.get('/api/ai/queue/stats');
    return response.data;
  },
};

// Document processing progress types
export type ProcessingStage =
  | 'queued'
  | 'downloading'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'failed';

export interface ProcessingStageRecord {
  name: ProcessingStage;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface DocumentProcessingStatus {
  documentId: string;
  status: string;
  processing: {
    stage: ProcessingStage;
    progressPercent: number;
    stageLabel: string;
    startedAt: string;
    error?: string;
    failedStage?: ProcessingStage;
    stages: ProcessingStageRecord[];
  } | null;
  extractionError: string | null;
  embeddingError: string | null;
}

// Document API — trimmed to getText only (used by source-panel for preview)
export const documentApi = {
  getText: async (documentId: string): Promise<ApiResponse<{ documentId: string; text: string; stats: { length: number; wordCount: number; pageCount?: number; paragraphCount?: number }; extractedAt: string }>> => {
    const response = await apiClient.get(`/api/documents/${documentId}/text`);
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

  create: async (data: { title?: string; topicId?: string; mode?: 'research' | 'chat' }): Promise<ApiResponse<Conversation>> => {
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

  deleteMessage: async (conversationId: string, messageId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/api/conversations/${conversationId}/messages/${messageId}`);
    return response.data;
  },

  exportConversation: async (
    id: string,
    format: 'pdf' | 'markdown' | 'docx',
    options?: { includeSources?: boolean; includeBibliography?: boolean }
  ): Promise<Blob> => {
    const response = await apiClient.get(`/api/conversations/${id}/export`, {
      params: { format, ...options },
      responseType: 'blob',
    });
    return response.data;
  },
};

// topicApi retired in v2

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

  trackCitationClick: async (params: {
    messageId?: string;
    conversationId?: string;
    sourceIndex: number;
    sourceUrl?: string;
    sourceType: 'document' | 'web';
  }): Promise<ApiResponse<{ id: string | null }>> => {
    const response = await apiClient.post('/api/analytics/citation-click', params);
    return response.data;
  },

  getCitationClickStats: async (
    days: number = 30
  ): Promise<ApiResponse<{
    period: string;
    totalClicks: number;
    uniqueUsers: number;
    clicksByType: Record<string, number>;
    topDomains: { domain: string; clicks: number; unique_users: number }[];
    avgClicksPerMessage: number;
  }>> => {
    const response = await apiClient.get('/api/analytics/citation-clicks', {
      params: { days },
    });
    return response.data;
  },

  getCitationDomainRates: async (
    days: number = 30
  ): Promise<ApiResponse<{
    period: string;
    domains: { domain: string; totalClicked: number; uniqueClickers: number }[];
  }>> => {
    const response = await apiClient.get('/api/analytics/citation-clicks/domains', {
      params: { days },
    });
    return response.data;
  },

  // ── Cross-conversation cited sources ──────────────────────────────

  getCitedSources: async (options?: {
    topicId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{ sources: CitedSource[] }>> => {
    const response = await apiClient.get('/api/analytics/cited-sources', {
      params: options,
    });
    return response.data;
  },

  getSourceConversations: async (
    citedSourceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{ conversations: SourceConversation[] }>> => {
    const response = await apiClient.get(`/api/analytics/cited-sources/${citedSourceId}/conversations`, {
      params: options,
    });
    return response.data;
  },

  getTopicCitedSources: async (
    topicId: string,
    limit: number = 20
  ): Promise<ApiResponse<{ sources: TopicCitedSource[] }>> => {
    const response = await apiClient.get(`/api/analytics/cited-sources/topic/${topicId}`, {
      params: { limit },
    });
    return response.data;
  },
};

// Cited Sources Types
export interface CitedSource {
  id: string;
  source_url: string | null;
  source_type: 'document' | 'web';
  document_id: string | null;
  source_title: string;
  source_domain: string | null;
  first_cited_at: string;
  last_cited_at: string;
  citation_count: number;
  conversation_count: number;
}

export interface SourceConversation {
  conversation_id: string;
  conversation_title: string | null;
  message_id: string;
  snippet: string | null;
  topic_id: string | null;
  topic_name: string | null;
  cited_at: string;
}

export interface TopicCitedSource {
  id: string;
  source_url: string | null;
  source_type: 'document' | 'web';
  document_id: string | null;
  source_title: string;
  source_domain: string | null;
  topic_citation_count: number;
  total_citation_count: number;
}

// Subscription API Types
export interface Subscription {
  id: string;
  user_id: string;
  tier: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'expired';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  paypal_subscription_id?: string;
  billing_period?: 'monthly' | 'annual';
  annual_discount?: number;
  grace_period_end?: string;
  created_at: string;
  updated_at: string;
}

export interface TierLimits {
  queriesPerMonth: number | null;
  documentUploads: number | null;
  maxTopics: number | null;
  features: {
    documentUpload: boolean;
    embedding: boolean;
    analytics: boolean;
    apiAccess: boolean;
    whiteLabel: boolean;
  };
}

export interface UsageLimit {
  allowed: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
}

export interface SubscriptionData {
  subscription: Subscription;
  limits: TierLimits;
  usage: {
    queries: UsageLimit;
    documentUploads: UsageLimit;
    topics: UsageLimit;
    tavilySearches?: UsageLimit;
  };
}

export interface BillingHistory {
  payments: Payment[];
  total: number;
}

// Usage API Types
export interface UsageStats {
  queries: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number; // 0-100, or -1 for unlimited
  };
  documentUploads: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
  };
  topics: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
  };
  tavilySearches: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
  };
  apiCalls?: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
  };
  periodStart: string;
  periodEnd: string;
  tier: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
}

export interface UsageHistory {
  date: string;
  queries: number;
  documentUploads: number;
  apiCalls: number;
}

export interface UsageWarnings {
  approaching: boolean;
  warnings: Array<{ type: 'queries' | 'documentUploads' | 'topics' | 'tavilySearches'; percentage: number }>;
}

export interface OverageRecord {
  metric_type: 'queries' | 'document_upload' | 'tavily_searches';
  limit_value: number;
  usage_value: number;
  overage_units: number;
  unit_price: number;
  amount_charged: number;
}

export interface OverageSummary {
  periodStart: string;
  periodEnd: string;
  currency: string;
  totalCharged: number;
  records: OverageRecord[];
}

// Usage API
export const usageApi = {
  getCurrent: async (): Promise<ApiResponse<{ usage: UsageStats }>> => {
    const response = await apiClient.get('/api/usage/current');
    return response.data;
  },

  getHistory: async (days?: number): Promise<ApiResponse<{ history: UsageHistory[]; days: number }>> => {
    const response = await apiClient.get('/api/usage/history', {
      params: days ? { days } : {},
    });
    return response.data;
  },

  getWarnings: async (): Promise<ApiResponse<UsageWarnings>> => {
    const response = await apiClient.get('/api/usage/warnings');
    return response.data;
  },
};

// Billing API (overage)
export const billingApi = {
  getOverage: async (params?: {
    periodStart?: string;
    periodEnd?: string;
    currency?: 'USD' | 'UGX';
  }): Promise<ApiResponse<OverageSummary>> => {
    const response = await apiClient.get('/api/billing/overage', { params: params ?? {} });
    return response.data;
  },

  initiateOveragePayment: async (params: {
    periodStart: string;
    periodEnd: string;
    currency?: 'USD' | 'UGX';
  }): Promise<
    ApiResponse<
      | { noOverage: true; message: string }
      | { payment_id: string; redirect_url: string; order_id: string; amount: number; currency: string }
    >
  > => {
    const response = await apiClient.post('/api/billing/overage/initiate', {
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      currency: params.currency ?? 'USD',
    });
    return response.data;
  },
};

// Enterprise API
export const enterpriseApi = {
  submitInquiry: async (params: {
    name: string;
    email: string;
    company?: string;
    message?: string;
  }): Promise<ApiResponse<{ id: string; message: string }>> => {
    const response = await apiClient.post('/api/enterprise/inquiry', params);
    return response.data;
  },
};

// Cost Analytics (Week 12)
export interface CostSummary {
  totalCost: number;
  totalQueries: number;
  totalTokens: number;
  averageCostPerQuery: number;
  modelBreakdown: Record<string, { count: number; totalCost: number; totalTokens: number }>;
}

export interface CostTrendPoint {
  date: string;
  totalCost: number;
  totalQueries: number;
  totalTokens: number;
  byModel: Record<string, { cost: number; queries: number; tokens: number }>;
}

export const costApi = {
  getSummary: async (params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<CostSummary>> => {
    const response = await apiClient.get('/api/analytics/cost/summary', { params: params ?? {} });
    return response.data;
  },

  getTrends: async (params: {
    startDate: string;
    endDate: string;
    interval?: 'hour' | 'day' | 'week';
  }): Promise<
    ApiResponse<{ trends: CostTrendPoint[]; interval: string; startDate: string; endDate: string }>
  > => {
    const response = await apiClient.get('/api/analytics/cost/trends', { params: params ?? {} });
    return response.data;
  },
};

export const subscriptionApi = {
  get: async (): Promise<ApiResponse<SubscriptionData>> => {
    const response = await apiClient.get('/api/subscription');
    return response.data;
  },

  getLimits: async (): Promise<ApiResponse<{
    queries: UsageLimit;
    documentUploads: UsageLimit;
    topics: UsageLimit;
  }>> => {
    const response = await apiClient.get('/api/subscription/limits');
    return response.data;
  },

  upgrade: async (tier: 'free' | 'starter' | 'premium' | 'pro'): Promise<ApiResponse<{ subscription: Subscription }>> => {
    const response = await apiClient.put('/api/subscription/upgrade', { tier });
    return response.data;
  },

  cancel: async (immediate: boolean = false): Promise<ApiResponse<{ subscription: Subscription }>> => {
    const response = await apiClient.post('/api/subscription/cancel', { immediate });
    return response.data;
  },

  downgrade: async (tier: 'free' | 'starter' | 'premium' | 'pro', immediate: boolean = false): Promise<ApiResponse<{ subscription: Subscription }>> => {
    const response = await apiClient.put('/api/subscription/downgrade', { tier, immediate });
    return response.data;
  },

  reactivate: async (): Promise<ApiResponse<{ subscription: Subscription }>> => {
    const response = await apiClient.post('/api/subscription/reactivate');
    return response.data;
  },

  getBillingHistory: async (): Promise<ApiResponse<BillingHistory>> => {
    const response = await apiClient.get('/api/subscription/billing-history');
    return response.data;
  },

  downloadInvoice: async (paymentId: string): Promise<Blob> => {
    const response = await apiClient.get(`/api/subscription/invoice/${paymentId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getHistory: async (): Promise<ApiResponse<{ history: any[]; total: number }>> => {
    const response = await apiClient.get('/api/subscription/history');
    return response.data;
  },

  getProratedPricing: async (
    toTier: 'free' | 'starter' | 'premium' | 'pro',
    currency: 'UGX' | 'USD' = 'UGX',
    toBillingPeriod?: 'monthly' | 'annual'
  ): Promise<ApiResponse<{ proratedPricing: any }>> => {
    const params: { toTier: string; currency: string; toBillingPeriod?: string } = { toTier, currency };
    if (toBillingPeriod) params.toBillingPeriod = toBillingPeriod;
    const response = await apiClient.get('/api/subscription/prorated-pricing', { params });
    return response.data;
  },

  startTrial: async (tier: 'starter' | 'premium' | 'pro', trialDays: number = 7): Promise<ApiResponse<{ subscription: Subscription; trial_end: string }>> => {
    const response = await apiClient.post('/api/subscription/start-trial', { tier, trialDays });
    return response.data;
  },

  getPayPalStatus: async (): Promise<ApiResponse<{
    hasPayPalSubscription: boolean;
    subscription: Subscription;
    paypalStatus: { subscriptionId: string; status: string; next_billing_time?: string } | null;
  }>> => {
    const response = await apiClient.get('/api/subscription/paypal-status');
    return response.data;
  },
};

// Payment API
export interface Payment {
  id: string;
  user_id: string;
  subscription_id?: string;
  paypal_order_id?: string;
  paypal_payment_id?: string;
  paypal_subscription_id?: string;
  payment_provider?: 'paypal';
  tier: 'free' | 'starter' | 'premium' | 'pro' | 'enterprise';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payment_method?: string;
  payment_description?: string;
  callback_data?: Record<string, any>;
  webhook_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface PaymentInitiateRequest {
  tier: 'starter' | 'premium' | 'pro' | 'enterprise';
  currency: 'UGX' | 'USD';
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  billing_period?: 'monthly' | 'annual';
  return_url?: string; // URL to redirect to after payment completion
  prefer_card?: boolean; // If true, PayPal checkout will prefer card payment form
}

export interface PaymentInitiateResponse {
  payment: {
    id: string;
    tier: 'starter' | 'premium' | 'pro' | 'enterprise';
    amount: number;
    currency: string;
    status: string;
    billing_period?: 'monthly' | 'annual';
  };
  redirect_url: string;
  /** One-time payment: PayPal order ID */
  order_id?: string;
  /** Recurring: PayPal subscription ID */
  subscription_id?: string;
  recurring?: boolean;
  billing_period?: 'monthly' | 'annual';
  /** @deprecated Use order_id or subscription_id */
  order_tracking_id?: string;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
}

export interface RefundResponse {
  refund: {
    id: string;
    payment_id: string;
    amount: number;
    currency: string;
    status: string;
  };
  refund_status: string;
}

export const paymentApi = {
  initiate: async (
    data: PaymentInitiateRequest & { recurring?: boolean }
  ): Promise<ApiResponse<PaymentInitiateResponse>> => {
    const response = await apiClient.post('/api/payment/initiate', data);
    return response.data;
  },

  getStatus: async (orderTrackingId: string): Promise<ApiResponse<{ payment: Payment }>> => {
    const response = await apiClient.get(`/api/payment/status/${orderTrackingId}`);
    return response.data;
  },

  getHistory: async (): Promise<ApiResponse<{ payments: Payment[] }>> => {
    const response = await apiClient.get('/api/payment/history');
    return response.data;
  },

  refund: async (data: RefundRequest): Promise<ApiResponse<RefundResponse>> => {
    const response = await apiClient.post('/api/payment/refund', data);
    return response.data;
  },

  syncSubscription: async (subscriptionId?: string): Promise<ApiResponse<{ synced: boolean; message: string }>> => {
    const response = await apiClient.post('/api/payment/sync-subscription', {
      subscription_id: subscriptionId,
    });
    return response.data;
  },
};

// Metrics API Types
export interface RetrievalMetrics {
  totalQueries: number;
  averagePrecision: number;
  averageRecall: number;
  averageF1Score: number;
  averageMRR: number;
  averageAP: number;
  averageNDCG?: number;
  queries: Array<{
    query: string;
    userId: string;
    queryId?: string;
    timestamp: number;
    totalRetrieved: number;
    totalRelevant: number;
    relevantRetrieved: number;
    precision: number;
    recall: number;
    f1Score: number;
    meanReciprocalRank: number;
    averagePrecision: number;
    ndcg?: number;
  }>;
}

export interface RetrievalMetricsSummary {
  totalQueries: number;
  averagePrecision: number;
  averageRecall: number;
  averageF1Score: number;
  averageMRR: number;
  averageAP: number;
  averageNDCG?: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface LatencyStats {
  stats: Array<{
    operationType: string;
    count: number;
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    p95Latency: number;
    p99Latency: number;
  }>;
  summary: {
    totalOperations: number;
    averageLatency: number;
    operationsTracked: number;
  };
}

export interface LatencyTrend {
  date: string;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  count: number;
}

export interface LatencyTrends {
  trends: LatencyTrend[];
  operationType: string;
  interval: 'hour' | 'day' | 'week';
  dateRange: {
    start: string;
    end: string;
  };
}

export interface LatencyAlert {
  id: string;
  operationType: string;
  latency: number;
  threshold: number;
  timestamp: string;
  message: string;
}

export interface ErrorStats {
  stats: Array<{
    serviceType: string;
    errorCategory: string;
    count: number;
    percentage: number;
  }>;
  summary: {
    totalErrors: number;
    servicesTracked: number;
    categoriesTracked: number;
  };
}

export interface ErrorTrend {
  date: string;
  count: number;
  errorRate: number;
}

export interface ErrorTrends {
  trends: ErrorTrend[];
  serviceType: string;
  errorCategory: string | null;
  interval: 'hour' | 'day' | 'week';
  dateRange: {
    start: string;
    end: string;
  };
}

export interface QualityStats {
  stats: Array<{
    metricType: string;
    count: number;
    averageScore: number;
    minScore: number;
    maxScore: number;
  }>;
  summary: {
    totalMetrics: number;
    averageScore: number;
    metricTypesTracked: number;
  };
}

export interface QualityTrend {
  date: string;
  averageScore: number;
  count: number;
}

export interface QualityTrends {
  trends: QualityTrend[];
  metricType: string;
  interval: 'hour' | 'day' | 'week';
  dateRange: {
    start: string;
    end: string;
  };
}

export interface PerformanceMetrics {
  responseTime: {
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
  throughput: number; // requests/second
  errorRate: number; // percentage
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
}

// Metrics API
export const metricsApi = {
  // Retrieval Quality Metrics
  getRetrievalMetrics: async (options?: {
    startDate?: string;
    endDate?: string;
    topicId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<RetrievalMetrics>> => {
    const response = await apiClient.get('/api/metrics/retrieval', {
      params: options,
    });
    return response.data;
  },

  getRetrievalMetricsSummary: async (): Promise<ApiResponse<RetrievalMetricsSummary>> => {
    const response = await apiClient.get('/api/metrics/retrieval/summary');
    return response.data;
  },

  // Latency/Performance Metrics
  getLatencyStats: async (options?: {
    operationType?: string;
    startDate?: string;
    endDate?: string;
    minLatency?: number;
    maxLatency?: number;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<LatencyStats>> => {
    const response = await apiClient.get('/api/metrics/latency/stats', {
      params: options,
    });
    return response.data;
  },

  getLatencyTrends: async (options: {
    operationType: string;
    startDate: string;
    endDate: string;
    interval?: 'hour' | 'day' | 'week';
  }): Promise<ApiResponse<LatencyTrends>> => {
    const response = await apiClient.get('/api/metrics/latency/trends', {
      params: options,
    });
    return response.data;
  },

  getLatencyAlerts: async (limit?: number): Promise<ApiResponse<{ alerts: LatencyAlert[]; total: number }>> => {
    const response = await apiClient.get('/api/metrics/latency/alerts', {
      params: limit ? { limit } : {},
    });
    return response.data;
  },

  getLatencyAlertStats: async (options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.get('/api/metrics/latency/alerts/stats', {
      params: options,
    });
    return response.data;
  },

  // Error Metrics
  getErrorStats: async (options?: {
    serviceType?: string;
    errorCategory?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<ErrorStats>> => {
    const response = await apiClient.get('/api/metrics/errors/stats', {
      params: options,
    });
    return response.data;
  },

  getErrorTrends: async (options: {
    serviceType: string;
    errorCategory?: string;
    startDate: string;
    endDate: string;
    interval?: 'hour' | 'day' | 'week';
  }): Promise<ApiResponse<ErrorTrends>> => {
    const response = await apiClient.get('/api/metrics/errors/trends', {
      params: options,
    });
    return response.data;
  },

  getErrorAlerts: async (limit?: number): Promise<ApiResponse<{ alerts: any[]; total: number }>> => {
    const response = await apiClient.get('/api/metrics/errors/alerts', {
      params: limit ? { limit } : {},
    });
    return response.data;
  },

  getErrorAlertStats: async (options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<any>> => {
    const response = await apiClient.get('/api/metrics/errors/alerts/stats', {
      params: options,
    });
    return response.data;
  },

  // Quality Metrics
  getQualityStats: async (options?: {
    metricType?: string;
    startDate?: string;
    endDate?: string;
    minScore?: number;
    maxScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<QualityStats>> => {
    const response = await apiClient.get('/api/metrics/quality/stats', {
      params: options,
    });
    return response.data;
  },

  getQualityTrends: async (options: {
    metricType: string;
    startDate: string;
    endDate: string;
    interval?: 'hour' | 'day' | 'week';
  }): Promise<ApiResponse<QualityTrends>> => {
    const response = await apiClient.get('/api/metrics/quality/trends', {
      params: options,
    });
    return response.data;
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Feedback API — thumbs up/down, comments, citation flagging
// ═══════════════════════════════════════════════════════════════════════

export interface FlaggedCitation {
  sourceUrl: string;
  sourceTitle: string;
  reason?: string;
}

export interface FeedbackSubmission {
  messageId: string;
  conversationId?: string;
  topicId?: string;
  rating: -1 | 1;
  comment?: string;
  flaggedCitations?: FlaggedCitation[];
  model?: string;
  /** Context for evaluator routing on negative feedback */
  question?: string;
  answer?: string;
  sources?: Array<{ type?: string; title?: string; url?: string; snippet?: string }>;
}

export interface MessageFeedback {
  id: string;
  user_id: string;
  message_id: string;
  conversation_id: string | null;
  topic_id: string | null;
  rating: -1 | 1;
  comment: string | null;
  flagged_citations: FlaggedCitation[];
  model: string | null;
  created_at: string;
}

export const feedbackApi = {
  /** Submit or update feedback for a message. */
  submitFeedback: async (
    feedback: FeedbackSubmission,
  ): Promise<ApiResponse<{ feedbackId: string }>> => {
    const response = await apiClient.post('/api/feedback', feedback);
    return response.data;
  },

  /** Get current user's feedback for a specific message. */
  getFeedback: async (
    messageId: string,
  ): Promise<ApiResponse<{ feedback: MessageFeedback | null }>> => {
    const response = await apiClient.get(`/api/feedback/message/${messageId}`);
    return response.data;
  },

  /** Remove feedback for a message. */
  deleteFeedback: async (
    messageId: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> => {
    const response = await apiClient.delete(`/api/feedback/message/${messageId}`);
    return response.data;
  },
};

// ═══════════════════════════════════════════════════════════════════
// Workspace API
// ═══════════════════════════════════════════════════════════════════

export interface WorkspaceTopicNode {
  id: string;
  name: string;
  description: string | null;
  conversationCount: number;
  documentCount: number;
  createdAt: string;
}

export interface WorkspaceDocumentNode {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  topicId: string | null;
  status: string;
  createdAt: string;
}

export interface WorkspaceConversationEdge {
  topicId: string;
  count: number;
}

export interface WorkspaceTopicCitation {
  topicId: string;
  citations: Array<{
    sourceTitle: string;
    sourceType: 'document' | 'web';
    documentId: string | null;
    citationCount: number;
  }>;
}

export interface WorkspaceGraphData {
  topics: WorkspaceTopicNode[];
  documents: WorkspaceDocumentNode[];
  conversationCounts: WorkspaceConversationEdge[];
  topicCitations: WorkspaceTopicCitation[];
}

export const workspaceApi = {
  /** Get the full research workspace graph data. */
  getGraph: async (): Promise<ApiResponse<WorkspaceGraphData>> => {
    const response = await apiClient.get('/api/workspace');
    return response.data;
  },
};

// ── Admin LLM Settings API ───────────────────────────────────────────────────

export interface LLMProviderModel {
  id: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1M: number;
  outputCostPer1M: number;
  capabilities: string[];
  isDefault?: boolean;
}

export interface LLMProviderInfo {
  id: string;
  displayName: string;
  models: LLMProviderModel[];
  configured: boolean;
}

export interface LLMModeConfig {
  providerId: string;
  modelId: string;
}

export interface LLMDefaults {
  temperature: number;
  maxTokens: number;
}

export interface LLMSettingsResponse {
  chatConfig: LLMModeConfig;
  researchConfig: LLMModeConfig;
  providers: LLMProviderInfo[];
  apiKeyStatus: Record<string, boolean>;
  defaults: LLMDefaults;
  featureFlags: Record<string, boolean>;
}

export interface LLMTestResult {
  status: string;
  response: string;
  model: string;
  latencyMs: number;
  tokensUsed: number;
}

export const adminApi = {
  /** Get current LLM settings, providers, models. */
  getLLMSettings: async (): Promise<ApiResponse<LLMSettingsResponse>> => {
    const response = await apiClient.get('/api/admin/settings/llm');
    return response.data;
  },

  /** Update provider + model for a mode. */
  updateLLMSettings: async (
    mode: 'chat' | 'research',
    providerId: string,
    modelId: string,
  ): Promise<ApiResponse<{ mode: string; providerId: string; modelId: string }>> => {
    const response = await apiClient.put('/api/admin/settings/llm', { mode, providerId, modelId });
    return response.data;
  },

  /** Update API keys per provider (redacted on server). */
  updateLLMApiKeys: async (
    keys: Record<string, string>,
  ): Promise<ApiResponse<{ providers: string[] }>> => {
    const response = await apiClient.put('/api/admin/settings/llm/api-keys', { keys });
    return response.data;
  },

  /** Test a provider + model connection. */
  testLLMConnection: async (
    providerId: string,
    modelId: string,
  ): Promise<ApiResponse<LLMTestResult>> => {
    const response = await apiClient.post('/api/admin/settings/llm/test', { providerId, modelId });
    return response.data;
  },

  /** Update default temperature / max tokens. */
  updateLLMDefaults: async (
    defaults: Partial<LLMDefaults>,
  ): Promise<ApiResponse<LLMDefaults>> => {
    const response = await apiClient.put('/api/admin/settings/llm/defaults', defaults);
    return response.data;
  },

  /** Get platform-wide LLM usage / cost stats. */
  getLLMUsageStats: async (
    days: number = 30,
  ): Promise<ApiResponse<LLMUsageStats>> => {
    const response = await apiClient.get('/api/admin/settings/llm/usage', { params: { days } });
    return response.data;
  },
};

export interface LLMUsageStats {
  period: { start: string; end: string };
  totalCost: number;
  totalQueries: number;
  totalTokens: number;
  averageCostPerQuery: number;
  modelBreakdown: Array<{
    model: string;
    queries: number;
    totalCost: number;
    totalTokens: number;
    avgCostPerQuery: number;
  }>;
  dailyTrend: Array<{ date: string; cost: number; queries: number }>;
}

// Export A/B Testing API
export { abTestingApi } from './api-ab-testing';
export type {
  ABTest,
  ABTestMetrics,
  CreateABTestInput,
  UpdateABTestInput,
  VariantConfig,
  StatisticalSignificance,
} from './api-ab-testing';

// Export Validation API
export { validationApi } from './api-validation';
export type {
  ValidationTestSuite,
  ValidationTestCase,
  ValidationTestResult,
  ValidationRun,
  ValidationReport,
  CreateTestSuiteInput,
  UpdateTestSuiteInput,
  RunTestSuiteInput,
} from './api-validation';

// Export Health Monitoring API
export { healthApi } from './api-health';
export type {
  SystemHealth,
  ComponentHealth,
  ResponseTimeMetric,
  ErrorRateMetric,
  ThroughputMetric,
  ComponentPerformance,
  PerformanceAlert,
  AlertConfiguration,
  HealthMetrics,
  SystemStatus,
  ComponentStatus,
} from './api-health';
