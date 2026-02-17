import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AuthService, SignupData, LoginData } from '../services/auth.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter, inviteGuestLimiter } from '../middleware/rateLimiter';
import { ValidationError } from '../types/error';
import { StorageService } from '../services/storage.service';
import { DatabaseService } from '../services/database.service';
import config from '../config/env';

const router = Router();

/**
 * GET /api/auth/email-config
 * Debug: check if redirect base URL is set (for magic link / invite emails).
 * Returns only whether it's configured; does not expose the URL.
 */
router.get(
  '/email-config',
  (req: Request, res: Response) => {
    const frontendUrl = config.CORS_ORIGIN || config.API_BASE_URL;
    const configured = !!frontendUrl && !String(frontendUrl).includes('undefined');
    res.status(200).json({
      success: true,
      redirectBaseUrlConfigured: configured,
      hint: configured
        ? 'Backend has a frontend URL. If emails still fail, check Supabase Auth Logs and Redirect URLs.'
        : 'Set CORS_ORIGIN or API_BASE_URL in Railway to your frontend URL (e.g. https://your-app.vercel.app).',
    });
  }
);

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

    const loginData: LoginData = {
      email: email.trim().toLowerCase(),
      password,
    };

    const result = await AuthService.login(loginData);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
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
 * POST /api/auth/magic-link
 * Request magic link for passwordless sign-in
 */
router.post(
  '/magic-link',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    await AuthService.requestMagicLink(email.trim().toLowerCase());

    // Always return success to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, a login link has been sent. Check your inbox.',
    });
  })
);

/**
 * POST /api/auth/invite
 * Invite a user by email (sends Supabase "Invite user" email). Requires authentication.
 */
router.post(
  '/invite',
  authenticate,
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    const result = await AuthService.inviteUserByEmail(email.trim().toLowerCase());

    if (!result.invited && result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invitation sent. They will receive an email to set up their account.',
    });
  })
);

/**
 * POST /api/auth/invite-guest
 * Invite a friend by email from the signup page (no auth required). Rate-limited by IP.
 */
router.post(
  '/invite-guest',
  inviteGuestLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    const result = await AuthService.inviteUserByEmail(email.trim().toLowerCase());

    if (!result.invited && result.error) {
      return res.status(400).json({
        success: false,
        message: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Invitation sent. Your friend will receive an email to set up their account.',
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
