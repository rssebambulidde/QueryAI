import { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '../types/error';
import { DatabaseService } from '../services/database.service';
import logger from '../config/logger';

/**
 * Authorization middleware to check if user has admin or super_admin role
 * Must be used after authenticate middleware
 */
export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new AuthorizationError('Authentication required');
    }

    const profile = await DatabaseService.getUserProfile(req.user.id);
    
    if (!profile) {
      throw new AuthorizationError('User profile not found');
    }

    const role = profile.role || 'user';
    
    if (role !== 'admin' && role !== 'super_admin') {
      logger.warn(`Unauthorized admin access attempt by user ${req.user.id} (role: ${role})`);
      throw new AuthorizationError('Admin access required');
    }

    // Attach role to request for use in route handlers
    req.user.role = role as 'admin' | 'super_admin';
    
    next();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      next(error);
    } else {
      logger.error('Authorization middleware error:', error);
      next(new AuthorizationError('Authorization failed'));
    }
  }
};

/**
 * Authorization middleware to check if user has super_admin role
 * Must be used after authenticate middleware
 */
export const requireSuperAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new AuthorizationError('Authentication required');
    }

    const profile = await DatabaseService.getUserProfile(req.user.id);
    
    if (!profile) {
      throw new AuthorizationError('User profile not found');
    }

    const role = profile.role || 'user';
    
    if (role !== 'super_admin') {
      logger.warn(`Unauthorized super_admin access attempt by user ${req.user.id} (role: ${role})`);
      throw new AuthorizationError('Super admin access required');
    }

    // Attach role to request
    req.user.role = 'super_admin';
    
    next();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      next(error);
    } else {
      logger.error('Authorization middleware error:', error);
      next(new AuthorizationError('Authorization failed'));
    }
  }
};

/**
 * Helper function to check if user has admin or super_admin role
 * Can be used in route handlers for conditional logic
 */
export const isAdminOrSuperAdmin = async (userId: string): Promise<boolean> => {
  try {
    const profile = await DatabaseService.getUserProfile(userId);
    if (!profile) return false;
    const role = profile.role || 'user';
    return role === 'admin' || role === 'super_admin';
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Helper function to check if user has super_admin role
 */
export const isSuperAdmin = async (userId: string): Promise<boolean> => {
  try {
    const profile = await DatabaseService.getUserProfile(userId);
    if (!profile) return false;
    const role = profile.role || 'user';
    return role === 'super_admin';
  } catch (error) {
    logger.error('Error checking super_admin status:', error);
    return false;
  }
};

// Legacy aliases for backward compatibility
export const requireOwner = requireSuperAdmin;
export const isAdminOrOwner = isAdminOrSuperAdmin;
export const isOwner = isSuperAdmin;

/**
 * Helper function to check if user has required subscription tier
 * Admins and super_admins bypass subscription tier checks
 * @param userId - User ID to check
 * @param requiredTiers - Array of allowed subscription tiers (e.g., ['premium', 'pro'])
 * @returns Object with { hasAccess: boolean, reason?: string }
 */
export const checkSubscriptionTierWithAdminBypass = async (
  userId: string,
  requiredTiers: string[]
): Promise<{ hasAccess: boolean; reason?: string }> => {
  try {
    // First check if user is admin or super_admin - they bypass subscription checks
    const isAdmin = await isAdminOrSuperAdmin(userId);
    if (isAdmin) {
      return { hasAccess: true };
    }

    // For regular users, check subscription tier
    const subscription = await DatabaseService.getUserSubscription(userId);
    if (!subscription) {
      return {
        hasAccess: false,
        reason: `This feature requires ${requiredTiers.join(' or ')} subscription`,
      };
    }

    if (!requiredTiers.includes(subscription.tier)) {
      return {
        hasAccess: false,
        reason: `This feature requires ${requiredTiers.join(' or ')} subscription`,
      };
    }

    return { hasAccess: true };
  } catch (error) {
    logger.error('Error checking subscription tier with admin bypass:', error);
    return {
      hasAccess: false,
      reason: 'Unable to verify subscription access',
    };
  }
};
