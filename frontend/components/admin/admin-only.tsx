'use client';

import { useUserRole } from '@/lib/hooks/use-user-role';

interface AdminOnlyProps {
  children: React.ReactNode;
  /** Require super_admin role instead of admin */
  requireOwner?: boolean;
  /** Fallback content to show if user doesn't have access */
  fallback?: React.ReactNode;
}

/**
 * Component wrapper that only renders children for admin/owner users
 * Use this for conditional rendering within pages (not for route protection)
 */
export function AdminOnly({
  children,
  requireOwner = false,
  fallback = null,
}: AdminOnlyProps) {
  const { isAdmin, isSuperAdmin, hasSuperAdminAccess } = useUserRole();

  const hasAccess = requireOwner ? hasSuperAdminAccess() : isAdmin;

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
