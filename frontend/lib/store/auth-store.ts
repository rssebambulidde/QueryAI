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
            // Debug: Log subscription tier from login
            if (typeof window !== 'undefined') {
              console.log('[AuthStore] Login response - User data:', user);
              console.log('[AuthStore] Login response - Subscription tier:', user.subscriptionTier || 'not set');
            }
            set({
              user,
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
              isAuthenticated: true,
              isLoading: false,
              error: null, // Clear any previous errors
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
          // Check if it's a rate limit error
          const isRateLimit = error.response?.status === 429 || 
                             error.response?.data?.error?.message?.toLowerCase().includes('too many');
          
          const errorMessage = isRateLimit
            ? (error.response?.data?.error?.message || 'Too many requests. Please wait 15 minutes before trying again.')
            : (error.response?.data?.error?.message ||
               error.message ||
               'Login failed');
          
          // Clear any stale tokens on rate limit to prevent loops
          if (isRateLimit) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
            }
            set({ 
              error: errorMessage, 
              isLoading: false,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              user: null,
            });
            return; // Exit without throwing to stop any retry logic
          }
          
          set({ 
            error: errorMessage, 
            isLoading: false 
          });
          
          throw error;
        }
      },

      signup: async (email, password, fullName) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.signup({ email, password, fullName });
          if (response.success && response.data) {
            const { user, session } = response.data;
            // Check if session tokens are valid (not empty)
            // If empty, email confirmation is required
            const hasValidSession = !!(session.accessToken && session.refreshToken);
            
            set({
              user: hasValidSession ? user : null, // Only set user if authenticated
              accessToken: session.accessToken || null,
              refreshToken: session.refreshToken || null,
              isAuthenticated: hasValidSession, // Only true if we have valid tokens
              isLoading: false,
            });
            
            // Store tokens in localStorage only if valid
            if (typeof window !== 'undefined' && hasValidSession) {
              localStorage.setItem('accessToken', session.accessToken);
              localStorage.setItem('refreshToken', session.refreshToken);
            } else if (typeof window !== 'undefined') {
              // Clear tokens if email confirmation required
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
            }
            
            // If email confirmation is required, throw a special error
            if (!hasValidSession) {
              throw new Error('EMAIL_CONFIRMATION_REQUIRED');
            }
          } else {
            throw new Error(response.error?.message || 'Signup failed');
          }
        } catch (error: any) {
          // Don't show error for email confirmation - handle it differently
          if (error.message === 'EMAIL_CONFIRMATION_REQUIRED') {
            set({ isLoading: false });
            throw error; // Re-throw so signup page can handle it
          }
          
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
        const { accessToken, isLoading } = get();
        
        // Prevent multiple simultaneous checkAuth calls
        if (isLoading) {
          console.log('[AuthStore] checkAuth already in progress, skipping...');
          return;
        }
        
        if (!accessToken) {
          set({ isAuthenticated: false, user: null, isLoading: false });
          return;
        }

        // Check if we recently called checkAuth (within last 2 seconds) to prevent rapid calls
        const lastCheckKey = 'lastCheckAuthTime';
        if (typeof window !== 'undefined') {
          const lastCheck = localStorage.getItem(lastCheckKey);
          if (lastCheck) {
            const timeSinceLastCheck = Date.now() - parseInt(lastCheck, 10);
            if (timeSinceLastCheck < 2000) {
              console.log('[AuthStore] checkAuth called too soon after last call, skipping...');
              return;
            }
          }
          localStorage.setItem(lastCheckKey, Date.now().toString());
        }

        set({ isLoading: true, error: null });
        try {
          const response = await authApi.getMe();
          if (response.success && response.data) {
            const userData = response.data.user;
            // Debug: Log subscription tier
            if (typeof window !== 'undefined') {
              console.log('[AuthStore] User data from /api/auth/me:', userData);
              console.log('[AuthStore] Subscription tier:', userData.subscriptionTier || 'not set');
            }
            set({
              user: userData,
              isAuthenticated: true,
              isLoading: false,
              error: null, // Clear any previous errors
            });
          } else {
            throw new Error(response.error?.message || 'Authentication failed');
          }
        } catch (error: any) {
          console.error('Auth check error:', error);
          
          // Check if it's a rate limit error
          const isRateLimit = error.response?.status === 429 || 
                             error.response?.data?.error?.message?.toLowerCase().includes('too many');
          
          // Clear auth state on failure
          const errorMessage = isRateLimit 
            ? (error.response?.data?.error?.message || 'Too many requests. Please wait 15 minutes before trying again.')
            : (error.response?.data?.error?.message || error.message || 'Authentication failed');
          
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            error: errorMessage,
          });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
          
          // Don't throw rate limit errors to prevent loops
          if (isRateLimit) {
            return; // Exit without throwing
          }
          
          // Re-throw other errors so caller knows it failed
          throw error;
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

// Listen for unauthorized events from API interceptor
if (typeof window !== 'undefined') {
  window.addEventListener('auth:unauthorized', () => {
    const store = useAuthStore.getState();
    store.setUser(null);
    store.setTokens(null, null);
  });
}
