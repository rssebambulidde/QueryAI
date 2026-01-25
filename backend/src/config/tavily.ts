import { tavily } from '@tavily/core';
import config from './env';
import logger from './logger';

// Validate Tavily API key
if (!config.TAVILY_API_KEY) {
  logger.warn('TAVILY_API_KEY is not set. Search features will not work.');
}

// Initialize Tavily client
export const tavilyClient = config.TAVILY_API_KEY
  ? tavily({ apiKey: config.TAVILY_API_KEY })
  : null;

// Test Tavily connection
export const testTavilyConnection = async (): Promise<boolean> => {
  try {
    if (!config.TAVILY_API_KEY || !tavilyClient) {
      logger.warn('Tavily API key not configured');
      return false;
    }

    // Make a simple test search
    const response = await tavilyClient.search('test query', {
      maxResults: 1,
    });

    logger.info('Tavily connection successful', {
      resultsCount: response.results?.length || 0,
    });
    return true;
  } catch (error: any) {
    logger.error('Tavily connection test failed:', {
      error: error.message,
    });
    return false;
  }
};

export default tavilyClient;
