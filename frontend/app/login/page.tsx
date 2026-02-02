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
import { PasswordInput } from '@/components/ui/password-input';
import { Alert } from '@/components/ui/alert';
import { useMobile } from '@/lib/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { authApi } from '@/lib/api';
import { Mail } from 'lucide-react';

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
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkSuccess, setMagicLinkSuccess] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);

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

  const onMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = magicLinkEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMagicLinkError('Please enter a valid email address');
      return;
    }
    setMagicLinkError(null);
    setMagicLinkLoading(true);
    try {
      const response = await authApi.requestMagicLink(email);
      if (response.success) {
        setMagicLinkSuccess(true);
      } else {
        setMagicLinkError(response.error?.message || 'Failed to send login link');
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as Error).message : 'Failed to send login link';
      setMagicLinkError(msg);
    } finally {
      setMagicLinkLoading(false);
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

            <PasswordInput
              label="Password"
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-50 px-2 text-gray-500">Or</span>
            </div>
          </div>

          <div className="space-y-3">
            {!showMagicLink ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setShowMagicLink(true)}
              >
                <Mail className="w-4 h-4 mr-2" />
                Sign in with magic link
              </Button>
            ) : magicLinkSuccess ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <p className="font-medium">Check your email</p>
                <p className="mt-1">We sent a login link to <strong>{magicLinkEmail}</strong>. Click the link in the email to sign in.</p>
                <p className="mt-2 text-green-700">You can close this page after signing in.</p>
                <button
                  type="button"
                  onClick={() => { setShowMagicLink(false); setMagicLinkSuccess(false); setMagicLinkEmail(''); }}
                  className="mt-2 text-orange-600 hover:text-orange-700 font-medium"
                >
                  Use password instead
                </button>
              </div>
            ) : (
              <form onSubmit={onMagicLinkSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-700">Enter your email and we&apos;ll send you a link to sign in (no password needed).</p>
                <Input
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={magicLinkEmail}
                  onChange={(e) => setMagicLinkEmail(e.target.value)}
                  error={magicLinkError ?? undefined}
                  className="bg-white"
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    isLoading={magicLinkLoading}
                    disabled={magicLinkLoading}
                  >
                    Send login link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowMagicLink(false); setMagicLinkError(null); setMagicLinkEmail(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
