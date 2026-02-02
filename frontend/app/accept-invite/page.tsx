'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert } from '@/components/ui/alert';

const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password must be at least 8 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

function getParamsFromHash(): { accessToken: string | null; refreshToken: string | null; expiresIn: number } {
  if (typeof window === 'undefined') return { accessToken: null, refreshToken: null, expiresIn: 3600 };
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn = parseInt(params.get('expires_in') ?? '3600', 10) || 3600;
  return { accessToken, refreshToken, expiresIn };
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasValidHash, setHasValidHash] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
  });

  useEffect(() => {
    const { accessToken, refreshToken } = getParamsFromHash();
    if (accessToken && refreshToken) {
      setHasValidHash(true);
    } else {
      setHasValidHash(false);
      setError('Invalid or expired invite link. Please ask for a new invitation.');
    }
  }, []);

  const onSubmit = async (data: SetPasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const { accessToken, refreshToken } = getParamsFromHash();
      if (!accessToken || !refreshToken) {
        throw new Error('Invalid or expired invite link');
      }

      const response = await authApi.resetPassword({
        password: data.password,
        accessToken,
        refreshToken,
      });

      if (response.success) {
        setSuccess(true);
        const { expiresIn } = getParamsFromHash();
        const expiryTime = Date.now() + expiresIn * 1000;
        setTokens(accessToken, refreshToken, expiryTime);

        const meResponse = await authApi.getMe();
        if (meResponse.success && meResponse.data?.user) {
          setUser(meResponse.data.user);
        }
        setTimeout(() => router.replace('/dashboard'), 1500);
      } else {
        setError(response.error?.message ?? 'Failed to set password');
      }
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === 'object' &&
        'response' in err
          ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : undefined;
      setError(msg ?? 'Failed to set password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">You’re all set</h2>
            <p className="mt-4 text-gray-600">
              Your password has been set. Redirecting to the dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasValidHash === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Invalid invite link</h2>
            {error && (
              <Alert variant="error" className="mt-4 text-left">
                {error}
              </Alert>
            )}
            <p className="mt-4 text-gray-600">
              This link may have expired or already been used. Please ask your team admin to send a new invitation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasValidHash === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Set your password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You’ve been invited. Choose a password to finish setting up your account.
          </p>
        </div>

        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm space-y-4">
            <PasswordInput
              label="Password"
              autoComplete="new-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordInput
              label="Confirm password"
              autoComplete="new-password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Set password & continue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
