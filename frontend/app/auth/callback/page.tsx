'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth-store';
import { authApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const finishWithSession = useCallback(
    async (accessToken: string, refreshToken: string, expiresIn: number, email: string, id: string, fullName?: string) => {
      setTokens(accessToken, refreshToken, expiresIn * 1000 + Date.now());
      setUser({ id, email, full_name: fullName, role: 'user', subscriptionTier: 'free' });
      try {
        await authApi.getMe();
      } catch {
        // Profile may be created by /me
      }
      router.replace('/dashboard');
    },
    [setUser, setTokens, router]
  );

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        toast.error('Authentication is not configured.');
        setStatus('error');
        router.replace('/login');
        return;
      }
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session?.user) {
          throw new Error('No session');
        }
        const { access_token, refresh_token, expires_in } = session;
        const u = session.user;
        await finishWithSession(
          access_token,
          refresh_token,
          expires_in ?? 3600,
          u.email ?? '',
          u.id,
          (u.user_metadata?.full_name as string) || (u.user_metadata?.name as string)
        );
      } catch (e: any) {
        console.error('Auth callback error:', e);
        toast.error(e?.message ?? 'Authentication failed');
        setStatus('error');
        setTimeout(() => router.replace('/login'), 2000);
      }
    };

    run();
  }, [finishWithSession, toast, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent" />
            <p className="mt-4 text-gray-600">Completing authentication...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-600 text-4xl mb-4">✕</div>
            <p className="text-gray-600">Authentication failed. Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}
