/**
 * OpenAI Configuration (Legacy)
 * Re-exports from openai.config.ts for backward compatibility
 */

// Re-export from pool manager for backward compatibility
export { openai, OpenAIPool as default } from './openai.config';
import { OpenAIPool } from './openai.config';
import logger from './logger';

// Test OpenAI connection (using pool manager)
export const testOpenAIConnection = async (): Promise<boolean> => {
  try {
    const health = await OpenAIPool.healthCheck();
    return health.healthy;
  } catch (error: any) {
    logger.error('OpenAI connection test failed:', {
      error: error.message,
      code: error.code,
    });
    return false;
  }
};
