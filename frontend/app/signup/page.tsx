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

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Name is required'),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { signup, isAuthenticated, isLoading, error, clearError } =
    useAuthStore();
  const [showAlert, setShowAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (error) {
      setShowAlert(true);
      const timer = setTimeout(() => {
        setShowAlert(false);
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);



  const onSubmit = async (data: SignupFormData) => {
    setSuccessMessage(null);
    try {
      await signup(data.email, data.password, data.fullName);
      router.push('/login?registered=true');
    } catch (err: any) {
      // Check if email confirmation is required
      if (err.message === 'EMAIL_CONFIRMATION_REQUIRED') {
        // Show success message - user needs to confirm email
        setSuccessMessage(
          'Account created successfully! Please check your email to confirm your account before signing in.'
        );
        setShowAlert(true);
        clearError(); // Clear any error state
        // Don't redirect - stay on signup page with message
      } else {
        // Other errors are handled by the store
      }
    }
  };

  const { isMobile } = useMobile();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <h2 className={cn(
            "mt-6 text-center font-extrabold text-gray-900",
            isMobile ? "text-2xl" : "text-3xl"
          )}>
            Create your account
          </h2>
          <p className="mt-2 text-center text-gray-600 text-sm">
            Or{' '}
            <Link
              href="/login"
              className="font-medium text-orange-600 hover:text-orange-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        {showAlert && successMessage && (
          <Alert variant="success">
            {successMessage}
            <div className="mt-2 text-sm">
              <Link
                href="/verify-email"
                className="font-medium text-orange-600 hover:text-orange-500 underline"
              >
                Need help verifying your email?
              </Link>
            </div>
          </Alert>
        )}
        {showAlert && error && !successMessage && (
          <Alert variant="error">{error}</Alert>
        )}

        <form className="mt-6 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm space-y-4">
            <Input
              label="Full Name"
              type="text"
              autoComplete="name"
              placeholder="John Doe"
              error={errors.fullName?.message}
              {...register('fullName')}
            />

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
              autoComplete="new-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />
            <p className="text-xs text-gray-500">
              Password must be at least 8 characters long
            </p>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={isLoading}
            >
              Create account
            </Button>
          </div>
        </form>


      </div>
    </div>
  );
}
