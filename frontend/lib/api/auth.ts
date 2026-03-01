import { apiClient } from './client';
import type { User, Session, ApiResponse } from '../api';

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
