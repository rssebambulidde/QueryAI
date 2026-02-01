'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkAuth } = useAuthStore();
  const { isMobile } = useMobile();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Verifying your email...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Get token from URL query params
        const token = searchParams.get('token');
        const email = searchParams.get('email');

        if (!token) {
          throw new Error('Verification token is missing');
        }

        // Call backend to verify email
        const response = await authApi.verifyEmail({ token, email: email || undefined });

        if (response.success) {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
          
          // Refresh auth state to get updated user
          await checkAuth();
          
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            router.push('/dashboard');
          }, 2000);
        } else {
          throw new Error(response.error?.message || 'Email verification failed');
        }
      } catch (err: any) {
        console.error('Email verification error:', err);
        setStatus('error');
        setError(err.message || 'Failed to verify email. The link may have expired.');
      }
    };

    verifyEmail();
  }, [searchParams, router, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className={cn(
        "max-w-md w-full space-y-8",
        isMobile && "px-4"
      )}>
        <div className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className={cn(
                "mx-auto animate-spin text-orange-600",
                isMobile ? "w-12 h-12" : "w-16 h-16"
              )} />
              <h2 className={cn(
                "mt-6 font-extrabold text-gray-900",
                isMobile ? "text-xl" : "text-3xl"
              )}>
                Verifying Email
              </h2>
              <p className={cn(
                "mt-2 text-gray-600",
                isMobile ? "text-sm" : "text-base"
              )}>
                {message}
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className={cn(
                "mx-auto text-green-600",
                isMobile ? "w-12 h-12" : "w-16 h-16"
              )} />
              <h2 className={cn(
                "mt-6 font-extrabold text-gray-900",
                isMobile ? "text-xl" : "text-3xl"
              )}>
                Email Verified!
              </h2>
              <p className={cn(
                "mt-2 text-gray-600",
                isMobile ? "text-sm" : "text-base"
              )}>
                {message}
              </p>
              <p className={cn(
                "mt-2 text-gray-500",
                isMobile ? "text-xs" : "text-sm"
              )}>
                Redirecting to dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className={cn(
                "mx-auto text-red-600",
                isMobile ? "w-12 h-12" : "w-16 h-16"
              )} />
              <h2 className={cn(
                "mt-6 font-extrabold text-gray-900",
                isMobile ? "text-xl" : "text-3xl"
              )}>
                Verification Failed
              </h2>
              {error && (
                <Alert variant="error" className="mt-4">
                  {error}
                </Alert>
              )}
              <div className={cn(
                "mt-6 space-y-3",
                isMobile ? "space-y-2" : "space-y-3"
              )}>
                <p className={cn(
                  "text-gray-600",
                  isMobile ? "text-sm" : "text-base"
                )}>
                  The verification link may have expired or is invalid.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => router.push('/login')}
                    className={cn(
                      "w-full",
                      isMobile && "min-h-[44px] text-base"
                    )}
                  >
                    Go to Login
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/signup')}
                    className={cn(
                      "w-full",
                      isMobile && "min-h-[44px] text-base"
                    )}
                  >
                    Sign Up Again
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-orange-600" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
