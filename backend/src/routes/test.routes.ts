import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/test
 * Simple test endpoint to verify routes are working
 */
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Test endpoint is working!',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/test/auth-routes
 * Test if auth routes are registered
 */
router.get('/auth-routes', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Auth routes test endpoint',
    availableEndpoints: [
      'POST /api/auth/signup',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'POST /api/auth/refresh',
      'POST /api/auth/forgot-password',
      'GET /api/auth/me',
    ],
  });
});

export default router;
