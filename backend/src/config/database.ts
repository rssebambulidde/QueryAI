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
    // Simple query to test connection
    const { error } = await supabaseAdmin.rpc('version');

    if (error) {
      // Try alternative: query a system table
      const { error: altError } = await supabaseAdmin
        .from('_prisma_migrations')
        .select('id')
        .limit(1);

      if (altError && altError.code !== '42P01') {
        return {
          connected: false,
          message: `Database connection failed: ${error.message}`,
        };
      }
    }

    return {
      connected: true,
      message: 'Database connection healthy',
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Database connection error: ${error.message}`,
    };
  }
};

export default supabaseAdmin;
