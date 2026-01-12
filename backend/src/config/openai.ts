import OpenAI from 'openai';
import config from './env';
import logger from './logger';

// Validate OpenAI API key
if (!config.OPENAI_API_KEY) {
  logger.warn('OPENAI_API_KEY is not set. AI features will not work.');
}

// Initialize OpenAI client
export const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY || '',
});

// Test OpenAI connection
export const testOpenAIConnection = async (): Promise<boolean> => {
  try {
    if (!config.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured');
      return false;
    }

    // Make a simple API call to test connection
    const response = await openai.models.list();
    logger.info('OpenAI connection successful', {
      modelsAvailable: response.data.length,
    });
    return true;
  } catch (error: any) {
    logger.error('OpenAI connection test failed:', {
      error: error.message,
      code: error.code,
    });
    return false;
  }
};

export default openai;
