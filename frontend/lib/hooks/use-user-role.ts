'use client';

import { useAuthStore } from '@/lib/store/auth-store';

/**
 * Hook to check user role and permissions
 * Returns utilities for role-based access control
 */
export function useUserRole() {
  const { user } = useAuthStore();

  const role = user?.role || 'user';
  
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const isUser = role === 'user';

  /**
   * Check if user has admin or super_admin access
   */
  const hasAdminAccess = (): boolean => {
    return isAdmin;
  };

  /**
   * Check if user has super_admin access
   */
  const hasSuperAdminAccess = (): boolean => {
    return isSuperAdmin;
  };

  /**
   * Check if user has access to a specific role level
   */
  const hasRole = (requiredRole: 'user' | 'admin' | 'super_admin'): boolean => {
    const roleHierarchy: Record<string, number> = {
      user: 1,
      admin: 2,
      super_admin: 3,
    };
    
    const userLevel = roleHierarchy[role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  };

  return {
    role,
    isAdmin,
    isSuperAdmin,
    isUser,
    hasAdminAccess,
    hasSuperAdminAccess,
    hasRole,
    // Legacy aliases for backward compatibility
    isOwner: isSuperAdmin,
    hasOwnerAccess: hasSuperAdminAccess,
  };
}
