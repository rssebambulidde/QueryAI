import { apiClient } from './client';
import type { ApiResponse, DocumentItem } from '../api';

export const documentApi = {
  list: async (): Promise<ApiResponse<DocumentItem[]>> => {
    const response = await apiClient.get('/api/documents');
    return response.data;
  },
  upload: async (file: File, onProgress?: (progress: number) => void, topicId?: string): Promise<ApiResponse<DocumentItem>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (topicId) formData.append('topicId', topicId);
    const response = await apiClient.post('/api/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
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
    const response = await apiClient.delete('/api/documents', { data: { id: pathOrId, path: pathOrId } });
    return response.data;
  },
  download: async (path: string): Promise<Blob> => {
    const response = await apiClient.get(`/api/documents/download?path=${encodeURIComponent(path)}`, { responseType: 'blob' });
    return response.data;
  },
  process: async (documentId: string, options?: { maxChunkSize?: number; overlapSize?: number }): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/documents/${documentId}/process`, options || {});
    return response.data;
  },
  clearProcessing: async (documentId: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.post(`/api/documents/${documentId}/clear-processing`);
    return response.data;
  },
  update: async (documentId: string, data: { metadata?: Record<string, unknown>; filename?: string }): Promise<ApiResponse<{ id: string; filename?: string; metadata?: Record<string, unknown> }>> => {
    const response = await apiClient.patch(`/api/documents/${documentId}`, data);
    return response.data;
  },
  getText: async (documentId: string): Promise<ApiResponse<{ documentId: string; text: string; stats: { length: number; wordCount: number; pageCount?: number; paragraphCount?: number }; extractedAt: string }>> => {
    const response = await apiClient.get(`/api/documents/${documentId}/text`);
    return response.data;
  },
};
