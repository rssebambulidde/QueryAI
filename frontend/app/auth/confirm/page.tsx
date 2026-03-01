'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';

const ERROR_MESSAGES: Record<string, string> = {
  otp_expired: 'Your confirmation link has expired. Please request a new one below.',
  access_denied: 'The confirmation link is invalid or has already been used.',
};

function EmailConfirmContent() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Verifying your email...');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    // Extract tokens from URL hash (Supabase puts them in hash)
    const hash = typeof window !== 'undefined' ? window.location.hash.substring(1) : '';
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const type = params.get('type');
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');

    // Check for Supabase error redirect
    if (errorCode || params.get('error')) {
      setStatus('error');
      const friendlyMessage = ERROR_MESSAGES[errorCode || '']
        || errorDescription?.replace(/\+/g, ' ')
        || 'Invalid or expired confirmation link. Please request a new one below.';
      setMessage(friendlyMessage);
      return;
    }

    // Check if this is an email confirmation
    if (type === 'signup' && accessToken) {
      setStatus('success');
      setMessage('Email confirmed successfully! You can now sign in.');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } else if (type === 'recovery') {
      // This is a password reset, redirect to reset-password page
      router.push('/reset-password');
    } else {
      setStatus('error');
      setMessage('Invalid or expired confirmation link. Please request a new one below.');
    }
  }, [router]);

  const handleResend = async () => {
    if (!resendEmail.trim()) return;
    setResendStatus('sending');
    try {
      await authApi.resendConfirmation(resendEmail.trim().toLowerCase());
      setResendStatus('sent');
    } catch {
      setResendStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-gray-600">{message}</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Email Confirmed!
            </h2>
            <p className="mt-2 text-gray-600">{message}</p>
            <p className="mt-4 text-sm text-gray-500">
              Redirecting to login page...
            </p>
          </div>
          <div className="text-center">
            <Link href="/login">
              <Button>Go to Login</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Confirmation Failed
          </h2>
          <Alert variant="error" className="mt-4">
            {message}
          </Alert>
        </div>

        {/* Resend confirmation form */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Resend confirmation email</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter your email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleResend}
              disabled={resendStatus === 'sending' || resendStatus === 'sent' || !resendEmail.trim()}
              size="sm"
            >
              {resendStatus === 'sending' ? 'Sending...' : resendStatus === 'sent' ? 'Sent!' : 'Resend'}
            </Button>
          </div>
          {resendStatus === 'sent' && (
            <p className="text-sm text-green-600">
              If an unverified account exists with this email, a new confirmation link has been sent.
            </p>
          )}
          {resendStatus === 'error' && (
            <p className="text-sm text-red-600">
              Something went wrong. Please try again.
            </p>
          )}
        </div>

        <div className="text-center space-y-2">
          <Link href="/login">
            <Button variant="outline" className="w-full">Go to Login</Button>
          </Link>
          <Link href="/signup">
            <Button variant="ghost" className="w-full">Create New Account</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function EmailConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <EmailConfirmContent />
    </Suspense>
  );
}
