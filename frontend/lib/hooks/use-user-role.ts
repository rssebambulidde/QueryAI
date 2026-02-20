'use client';

import { useAuthStore } from '@/lib/store/auth-store';

/**
 * Hook to check user role and permissions
 * Returns utilities for role-based access control
 */
export function useUserRole() {
  const { user } = useAuthStore();

  const role = user?.role || 'user';
  
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = isSuperAdmin; // Only super_admin exists now
  const isUser = role === 'user';

  /**
   * Check if user has super_admin access
   */
  const hasAdminAccess = (): boolean => {
    return isSuperAdmin;
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
  const hasRole = (requiredRole: 'user' | 'super_admin'): boolean => {
    const roleHierarchy: Record<string, number> = {
      user: 1,
      super_admin: 2,
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
