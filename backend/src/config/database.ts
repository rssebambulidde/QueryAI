import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './env';
import logger from './logger';

// Create Supabase client with service role key (for admin operations)
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create Supabase client with anon key (for user operations)
// This will be used when we have user authentication tokens
export const supabase: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  }
);

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (error) {
      // If table doesn't exist, that's okay - we'll create it
      if (error.code === '42P01') {
        logger.warn('Database tables not yet created. Run migrations first.');
        return true; // Connection works, just tables missing
      }
      logger.error('Database connection test failed:', error);
      return false;
    }

    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection error:', error);
    return false;
  }
};

// Health check for database
export const checkDatabaseHealth = async (): Promise<{
  connected: boolean;
  message: string;
}> => {
  try {
    // Try to query user_profiles table (should exist after migration)
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .limit(1);

    if (error) {
      // If table doesn't exist (42P01), connection works but tables not created
      if (error.code === '42P01' || error.code === 'PGRST116') {
        return {
          connected: true,
          message: 'Database connected (tables not yet created - run migrations)',
        };
      }

      // Other errors indicate connection issues
      return {
        connected: false,
        message: `Database connection failed: ${error.message}`,
      };
    }

    // Success - table exists and query worked
    return {
      connected: true,
      message: 'Database connection healthy',
    };
  } catch (error: any) {
    // Check if it's a connection error or just missing tables
    const errorMessage = error.message || String(error);
    
    if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      return {
        connected: true,
        message: 'Database connected (tables not yet created - run migrations)',
      };
    }

    return {
      connected: false,
      message: `Database connection error: ${errorMessage}`,
    };
  }
};

export default supabaseAdmin;
