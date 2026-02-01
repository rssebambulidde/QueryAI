'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store/auth-store';
import { authApi } from '@/lib/api';
import { useToast } from '@/lib/hooks/use-toast';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          throw new Error('No session found');
        }

        // Get the access token and user from Supabase
        const supabaseAccessToken = session.access_token;
        const supabaseUser = session.user;

        // Exchange Supabase token for backend token
        // This assumes your backend has an endpoint to handle OAuth callback
        // You may need to adjust this based on your backend implementation
        try {
          const response = await authApi.login({
            email: supabaseUser.email || '',
            password: '', // OAuth users don't have passwords
          });

          // If direct login doesn't work, you might need a special OAuth endpoint
          // For now, we'll try to create/login via a special endpoint
          // This is a placeholder - adjust based on your backend API
          
          // Alternative: Call a special OAuth endpoint if your backend supports it
          // const oauthResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/oauth/google`, {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({
          //     accessToken: supabaseAccessToken,
          //     user: supabaseUser,
          //   }),
          // });

          // For now, sign out from Supabase and show message
          await supabase.auth.signOut();
          
          toast.error('OAuth integration with backend is pending. Please use email/password login for now.');
          router.push('/login');
          setStatus('error');
        } catch (error: any) {
          // If backend doesn't support OAuth yet, show message
          await supabase.auth.signOut();
          toast.error('OAuth integration is being set up. Please use email/password login.');
          router.push('/login');
          setStatus('error');
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        toast.error(error.message || 'Authentication failed');
        setStatus('error');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [router, setUser, setTokens, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent"></div>
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
