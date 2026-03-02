import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AuthService, SignupData, LoginData } from '../services/auth.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter, buildProgressiveKey, checkProgressiveLimit, recordLoginFailure, resetLoginFailures } from '../middleware/rateLimiter';
import { ValidationError } from '../types/error';
import { StorageService } from '../services/storage.service';
import { DatabaseService } from '../services/database.service';
import config from '../config/env';

const router = Router();



/**
 * POST /api/auth/signup
 * Sign up a new user
 */
router.post(
  '/signup',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const logger = (await import('../config/logger')).default;
    logger.info('Signup request received', { email: req.body.email });

    const { email, password, fullName } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const signupData: SignupData = {
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName?.trim(),
    };

    const result = await AuthService.signup(signupData);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result,
    });
  })
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const logger = (await import('../config/logger')).default;
    logger.info('Login request received', { email: req.body.email });

    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Progressive rate limiting check
    const progressiveKey = buildProgressiveKey(req, email);
    const { blocked, retryAfter } = await checkProgressiveLimit(progressiveKey);
    if (blocked) {
      logger.warn('Progressive rate limit hit', { email, retryAfter });
      res.status(429).json({
        success: false,
        error: {
          message: `Too many failed login attempts. Please try again in ${retryAfter} seconds.`,
          code: 'PROGRESSIVE_RATE_LIMIT',
          retryAfter,
        },
      });
      return;
    }

    const loginData: LoginData = {
      email: email.trim().toLowerCase(),
      password,
    };

    try {
      const result = await AuthService.login(loginData);

      // Reset failures on successful login
      await resetLoginFailures(progressiveKey);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error: any) {
      // Record failure for progressive limiting
      await recordLoginFailure(progressiveKey);
      throw error;
    }
  })
);

/**
 * POST /api/auth/logout
 * Logout user (requires authentication)
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      await AuthService.logout(token);
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    const result = await AuthService.refreshToken(refreshToken);

    if (!result) {
      throw new ValidationError('Invalid or expired refresh token');
    }

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result,
    });
  })
);

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    await AuthService.requestPasswordReset(email.trim().toLowerCase());

    // Always return success to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent',
    });
  })
);



/**
 * POST /api/auth/resend-confirmation
 * Resend signup confirmation email
 */
router.post(
  '/resend-confirmation',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    await AuthService.resendConfirmationEmail(email.trim().toLowerCase());

    // Always return success to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'If an unverified account exists with this email, a new confirmation link has been sent',
    });
  })
);

/**
 * POST /api/auth/reset-password
 * Reset password using token from reset email (requires authentication)
 */
router.post(
  '/reset-password',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { password } = req.body;

    if (!password) {
      throw new ValidationError('Password is required');
    }

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      throw new ValidationError('Access token is required');
    }

    await AuthService.resetPassword(token, password);

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  })
);

/**
 * POST /api/auth/change-email
 * Request email change (Supabase sends confirmation to new address)
 */
router.post(
  '/change-email',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { newEmail } = req.body;
    if (!newEmail) throw new ValidationError('New email is required');

    await AuthService.changeEmail(req.user!.id, newEmail.trim().toLowerCase());

    res.status(200).json({
      success: true,
      message: 'If the email is valid, a confirmation link has been sent to the new address.',
    });
  })
);

/**
 * POST /api/auth/change-password
 * Change password (requires current password verification)
 */
router.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current and new passwords are required');
    }

    await AuthService.changePassword(req.user!.id, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

/**
 * POST /api/auth/delete-account
 * Permanently delete account and all user data
 */
router.post(
  '/delete-account',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { password } = req.body;
    if (!password) throw new ValidationError('Password is required for account deletion');

    await AuthService.deleteAccount(req.user!.id, password);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  })
);

/**
 * GET /api/auth/login-activity
 * Get recent login activity for the current user
 */
router.get(
  '/login-activity',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const activity = await AuthService.getLoginActivity(req.user!.id, limit);

    res.status(200).json({
      success: true,
      data: { activity },
    });
  })
);

/**
 * GET /api/auth/me
 * Get current user (requires authentication)
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    let [profile, subscription] = await Promise.all([
      DatabaseService.getUserProfile(req.user!.id),
      DatabaseService.getUserSubscription(req.user!.id),
    ]);
    // Ensure profile exists (e.g. for Google sign-in via signInWithIdToken)
    if (!profile) {
      await DatabaseService.createUserProfile(req.user!.id, req.user!.email || '', undefined);
      await DatabaseService.createDefaultSubscription(req.user!.id);
      [profile, subscription] = await Promise.all([
        DatabaseService.getUserProfile(req.user!.id),
        DatabaseService.getUserSubscription(req.user!.id),
      ]);
    }

    // Sync email if Supabase auth email differs from profile (e.g. after email change confirmation)
    if (profile && req.user!.email && profile.email !== req.user!.email) {
      await DatabaseService.updateUserProfile(req.user!.id, { email: req.user!.email });
      profile = { ...profile, email: req.user!.email };
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user!.id,
          email: req.user!.email,
          full_name: profile?.full_name,
          avatar_url: profile?.avatar_url,
          role: profile?.role || 'user',
          subscriptionTier: subscription?.tier || 'free',
        },
      },
    });
  })
);

/**
 * POST /api/auth/profile/avatar
 * Upload profile avatar image (requires authentication)
 */
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new ValidationError('File must be an image'));
    }
  },
});

router.post(
  '/profile/avatar',
  authenticate,
  avatarUpload.single('avatar'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const logger = (await import('../config/logger')).default;

    if (!req.file) {
      throw new ValidationError('Avatar file is required');
    }

    const avatarUrl = await StorageService.uploadAvatar(userId, req.file);

    logger.info('Avatar uploaded', { userId, avatarUrl });

    res.status(200).json({
      success: true,
      data: {
        avatar_url: avatarUrl,
      },
    });
  })
);

/**
 * PUT /api/auth/profile
 * Update user profile (requires authentication)
 */
router.put(
  '/profile',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const logger = (await import('../config/logger')).default;
    const { full_name, avatar_url } = req.body;

    const updates: Partial<import('../types/database').Database.UserProfile> = {};

    if (full_name !== undefined) {
      updates.full_name = full_name?.trim() || null;
    }

    if (avatar_url !== undefined) {
      updates.avatar_url = avatar_url?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No fields to update');
    }

    const [updatedProfile, subscription] = await Promise.all([
      DatabaseService.updateUserProfile(userId, updates),
      DatabaseService.getUserSubscription(userId),
    ]);

    if (!updatedProfile) {
      throw new ValidationError('Failed to update profile');
    }

    logger.info('Profile updated', { userId, updates });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: updatedProfile.id,
          email: updatedProfile.email,
          full_name: updatedProfile.full_name,
          avatar_url: updatedProfile.avatar_url,
          subscriptionTier: subscription?.tier || 'free',
        },
      },
    });
  })
);

export default router;
