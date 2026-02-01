import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/authorization.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError, AuthorizationError } from '../types/error';
import { supabaseAdmin } from '../config/database';
import { DatabaseService } from '../services/database.service';
import logger from '../config/logger';
import { apiLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * GET /api/admin/users
 * List all users (admin/super_admin only)
 */
router.get(
  '/users',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit = 50, offset = 0, search } = req.query;

    let query = supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, role, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string, 10), parseInt(offset as string, 10) + parseInt(limit as string, 10) - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    const { data: users, error } = await query;

    if (error) {
      logger.error('Error fetching users:', error);
      throw new ValidationError('Failed to fetch users');
    }

    res.json({
      success: true,
      data: {
        users: users || [],
        total: users?.length || 0,
      },
    });
  })
);

/**
 * GET /api/admin/users/:id
 * Get user details by ID (admin/super_admin only)
 */
router.get(
  '/users/:id',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;

    const profile = await DatabaseService.getUserProfile(userId);
    if (!profile) {
      throw new ValidationError('User not found');
    }

    // Get subscription info
    const subscription = await DatabaseService.getUserSubscription(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: profile.role || 'user',
          subscriptionTier: subscription?.tier || 'free',
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
      },
    });
  })
);

/**
 * PUT /api/admin/users/:id/role
 * Update user role (super_admin only)
 */
router.put(
  '/users/:id/role',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const { role } = req.body;

    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      throw new ValidationError('Invalid role. Must be: user, admin, or super_admin');
    }

    // Prevent changing own role (security measure)
    if (req.user?.id === userId && role !== 'super_admin') {
      throw new AuthorizationError('Cannot change your own role');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user role:', error);
      throw new ValidationError('Failed to update user role');
    }

    logger.info(`User role updated by ${req.user?.id}: ${userId} -> ${role}`);

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
        },
      },
    });
  })
);

/**
 * PUT /api/admin/users/by-email/:email/role
 * Update user role by email (super_admin only)
 */
router.put(
  '/users/by-email/:email/role',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const userEmail = Array.isArray(email) ? email[0] : email;
    const { role } = req.body;

    if (!role || !['user', 'admin', 'super_admin'].includes(role)) {
      throw new ValidationError('Invalid role. Must be: user, admin, or super_admin');
    }

    // Find user by email
    const { data: profile, error: findError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (findError || !profile) {
      throw new ValidationError('User not found');
    }

    // Prevent changing own role
    if (req.user?.id === profile.id && role !== 'super_admin') {
      throw new AuthorizationError('Cannot change your own role');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ role })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user role:', error);
      throw new ValidationError('Failed to update user role');
    }

    logger.info(`User role updated by ${req.user?.id}: ${userEmail} (${profile.id}) -> ${role}`);

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
        },
      },
    });
  })
);

export default router;
