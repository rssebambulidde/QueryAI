import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { supabaseAdmin, supabase } from '../config/database';
import config from '../config/env';

const router = Router();

/**
 * GET /api/test/supabase
 * Test Supabase connection and configuration
 */
router.get(
  '/supabase',
  asyncHandler(async (req: Request, res: Response) => {
    const logger = (await import('../config/logger')).default;

    // Test configuration
    const configCheck = {
      SUPABASE_URL: config.SUPABASE_URL,
      SUPABASE_URL_SET: !!config.SUPABASE_URL,
      SUPABASE_URL_LENGTH: config.SUPABASE_URL?.length || 0,
      SUPABASE_ANON_KEY_SET: !!config.SUPABASE_ANON_KEY,
      SUPABASE_ANON_KEY_LENGTH: config.SUPABASE_ANON_KEY?.length || 0,
      SUPABASE_SERVICE_ROLE_KEY_SET: !!config.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_SERVICE_ROLE_KEY_LENGTH: config.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    };

    // Try to connect with anon key
    let anonTest: { success: boolean; error: string | null } = { success: false, error: null };
    try {
      const { data, error } = await supabase.from('user_profiles').select('count').limit(1);
      if (error) {
        anonTest = { success: false, error: error.message };
      } else {
        anonTest = { success: true, error: null };
      }
    } catch (error: any) {
      anonTest = { success: false, error: error.message || String(error) };
    }

    // Try to connect with service role key
    let adminTest: { success: boolean; error: string | null } = { success: false, error: null };
    try {
      const { data, error } = await supabaseAdmin.from('user_profiles').select('count').limit(1);
      if (error) {
        adminTest = { success: false, error: error.message };
      } else {
        adminTest = { success: true, error: null };
      }
    } catch (error: any) {
      adminTest = { success: false, error: error.message || String(error) };
    }

    res.status(200).json({
      success: true,
      data: {
        config: configCheck,
        anonKeyTest: anonTest,
        serviceRoleKeyTest: adminTest,
        recommendation: !configCheck.SUPABASE_URL_SET || !configCheck.SUPABASE_ANON_KEY_SET || !configCheck.SUPABASE_SERVICE_ROLE_KEY_SET
          ? 'Some environment variables are missing. Check Railway variables.'
          : !anonTest.success || !adminTest.success
          ? 'Variables are set but connection failed. Check if URL and keys match the same Supabase project.'
          : 'All checks passed!',
      },
    });
  })
);

export default router;
