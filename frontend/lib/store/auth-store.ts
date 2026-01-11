'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, User } from '../api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
        // Also store in localStorage for API client
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });
          if (response.success && response.data) {
            const { user, session } = response.data;
            set({
              user,
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            // Store tokens in localStorage for API client
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', session.accessToken);
              localStorage.setItem('refreshToken', session.refreshToken);
            }
          } else {
            throw new Error(response.error?.message || 'Login failed');
          }
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.error?.message ||
            error.message ||
            'Login failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      signup: async (email, password, fullName) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.signup({ email, password, fullName });
          if (response.success && response.data) {
            const { user, session } = response.data;
            set({
              user,
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            // Store tokens in localStorage for API client
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', session.accessToken);
              localStorage.setItem('refreshToken', session.refreshToken);
            }
          } else {
            throw new Error(response.error?.message || 'Signup failed');
          }
        } catch (error: any) {
          const errorMessage =
            error.response?.data?.error?.message ||
            error.message ||
            'Signup failed';
          set({ error: errorMessage, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
        }
      },

      checkAuth: async () => {
        const { accessToken } = get();
        if (!accessToken) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await authApi.getMe();
          if (response.success && response.data) {
            set({
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            throw new Error('Authentication failed');
          }
        } catch (error) {
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
          });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
