import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/debug/env
 * Debug endpoint to check if environment variables are loaded
 * Only in development mode
 */
router.get(
  '/env',
  asyncHandler(async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Debug endpoint not available in production',
      });
    }

    // Don't expose actual keys, just check if they exist
    const envCheck = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_URL_VALUE: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET',
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      SUPABASE_ANON_KEY_LENGTH: process.env.SUPABASE_ANON_KEY?.length || 0,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY_LENGTH: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
    };

    res.status(200).json({
      success: true,
      data: envCheck,
    });
  })
);

export default router;
