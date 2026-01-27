/**
 * Database Configuration (Legacy)
 * Re-exports from database.config.ts for backward compatibility
 */

// Re-export from pool manager for backward compatibility
export { supabaseAdmin, supabase, DatabasePool as default } from './database.config';
import { DatabasePool } from './database.config';
import logger from './logger';

// Test database connection (using pool manager)
export const testConnection = async (): Promise<boolean> => {
  try {
    const health = await DatabasePool.healthCheck();
    return health.healthy;
  } catch (error) {
    logger.error('Database connection error:', error);
    return false;
  }
};

// Health check for database (using pool manager)
export const checkDatabaseHealth = async (): Promise<{
  connected: boolean;
  message: string;
}> => {
  try {
    const health = await DatabasePool.healthCheck();
    return {
      connected: health.healthy,
      message: health.message,
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Database connection error: ${error.message}`,
    };
  }
};
