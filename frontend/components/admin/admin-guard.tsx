'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useUserRole } from '@/lib/hooks/use-user-role';

interface AdminGuardProps {
  children: React.ReactNode;
  /** @deprecated Only super_admin role exists now. Kept for backward compatibility. */
  requireOwner?: boolean;
  /** Redirect path if unauthorized (default: /dashboard) */
  redirectTo?: string;
  /** Show loading state while checking */
  showLoading?: boolean;
}

/**
 * Component guard for admin/owner-only pages
 * Redirects unauthorized users
 */
export function AdminGuard({
  children,
  requireOwner = false,
  redirectTo = '/dashboard',
  showLoading = true,
}: AdminGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const { isSuperAdmin } = useUserRole();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!isSuperAdmin) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, isSuperAdmin, router, redirectTo]);

  if (isLoading && showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return <>{children}</>;
}
