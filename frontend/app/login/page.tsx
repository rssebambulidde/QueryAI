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
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
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
      await login(data.email, data.password, data.rememberMe || false);
      // Don't manually redirect - let the useEffect handle it
      // This prevents double redirects and loops
    } catch (err) {
      // Error is handled by the store
      // Don't redirect on error - let user see the error message
    }
  };

  const { isMobile } = useMobile();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className={cn(
            "mt-6 text-center font-extrabold text-gray-900",
            isMobile ? "text-2xl" : "text-3xl"
          )}>
            Sign in to QueryAI
          </h2>
          <p className={cn(
            "mt-2 text-center text-gray-600",
            isMobile ? "text-sm" : "text-sm"
          )}>
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

        <form className="mt-6 space-y-6" onSubmit={handleSubmit(onSubmit)}>
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('rememberMe')}
                className={cn(
                  "rounded border-gray-300 text-orange-600 focus:ring-orange-500",
                  isMobile ? "w-5 h-5" : "w-4 h-4"
                )}
              />
              <span className={cn(
                "text-gray-700",
                isMobile ? "text-sm" : "text-sm"
              )}>
                Remember me for 7 days
              </span>
            </label>
            <div className="text-sm">
              <Link
                href="/forgot-password"
                className="font-medium text-orange-600 hover:text-orange-500"
              >
                Forgot password?
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
