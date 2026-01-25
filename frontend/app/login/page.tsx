'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error, clearError } =
    useAuthStore();
  const [showAlert, setShowAlert] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    // Only redirect if authenticated, not loading, and no error
    // This prevents redirect loops when login fails or is rate limited
    if (isAuthenticated && !isLoading && !error) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, error, router]);

  useEffect(() => {
    if (error) {
      setShowAlert(true);
      // For rate limit errors, show longer and don't auto-clear
      const isRateLimit = error.toLowerCase().includes('too many');
      const timeout = isRateLimit ? 30000 : 5000; // 30 seconds for rate limit, 5 seconds for others
      
      const timer = setTimeout(() => {
        setShowAlert(false);
        clearError();
      }, timeout);
      return () => clearTimeout(timer);
    } else {
      setShowAlert(false);
    }
  }, [error, clearError]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data.email, data.password);
      // Don't manually redirect - let the useEffect handle it
      // This prevents double redirects and loops
    } catch (err) {
      // Error is handled by the store
      // Don't redirect on error - let user see the error message
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to QueryAI
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link
              href="/signup"
              className="font-medium text-orange-600 hover:text-orange-500"
            >
              create a new account
            </Link>
          </p>
        </div>

        {showAlert && error && (
          <Alert variant="error">{error}</Alert>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm space-y-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-orange-600 hover:text-orange-500"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
