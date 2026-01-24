import { Router, Request, Response } from 'express';
import { AuthService, SignupData, LoginData } from '../services/auth.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';
import { ValidationError } from '../types/error';

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
    // User is attached by authenticate middleware
    const { DatabaseService } = await import('../services/database.service');
    const profile = await DatabaseService.getUserProfile(req.user!.id);
    const subscription = await DatabaseService.getUserSubscription(req.user!.id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user!.id,
          email: req.user!.email,
          fullName: profile?.full_name,
          subscriptionTier: subscription?.tier || 'free',
        },
      },
    });
  })
);

export default router;
