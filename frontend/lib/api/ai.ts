import { apiClient } from './client';
import type { ApiResponse, QuestionRequest, QuestionResponse, Source } from '../api';

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
  ): AsyncGenerator<string | { followUpQuestions?: string[]; refusal?: boolean; qualityScore?: number }, void, unknown> {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No reader available');
        let buffer = '';
        try {
          while (true) {
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
                    yield payload;
                    break;
                  case 'sources':
                    // This copy doesn't yield sources (used by non-RAG callers); skip
                    break;
                  case 'followUpQuestions':
                    try {
                      const fup = JSON.parse(payload);
                      yield { followUpQuestions: fup.questions, refusal: fup.refusal };
                    } catch { /* skip */ }
                    break;
                  case 'qualityScore':
                    try {
                      const qs = JSON.parse(payload);
                      yield { qualityScore: qs.score };
                    } catch { /* skip */ }
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
                    // Legacy fallback for unnamed data-only lines
                    try {
                      const data = JSON.parse(payload);
                      if (data.chunk) yield data.chunk;
                      if (data.followUpQuestions) yield { followUpQuestions: data.followUpQuestions, refusal: data.refusal };
                      if (data.qualityScore !== undefined) yield { qualityScore: data.qualityScore };
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
        return;
      } catch (error: any) {
        if (options?.signal?.aborted || error.name === 'AbortError') return;
        if (retryCount >= maxRetries) {
          if (options?.onError) options.onError(error);
          throw error;
        }
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
  researchSessionSummary: async (conversationId: string, topicName: string): Promise<ApiResponse<{ summary: string }>> => {
    const response = await apiClient.post('/api/ai/research-session-summary', { conversationId, topicName });
    return response.data;
  },
  suggestedStarters: async (topicId: string): Promise<ApiResponse<{ starters: string[] }>> => {
    const response = await apiClient.get('/api/ai/suggested-starters', { params: { topicId } });
    return response.data;
  },
};
