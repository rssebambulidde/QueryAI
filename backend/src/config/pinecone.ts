import { Pinecone } from '@pinecone-database/pinecone';
import config from './env';
import logger from './logger';

let pineconeClient: Pinecone | null = null;

/**
 * Initialize Pinecone client
 */
export function initializePinecone(): Pinecone | null {
  if (pineconeClient) {
    return pineconeClient;
  }

  if (!config.PINECONE_API_KEY) {
    logger.warn('Pinecone API key not configured. Vector search features will be disabled.');
    return null;
  }

  try {
    pineconeClient = new Pinecone({
      apiKey: config.PINECONE_API_KEY,
    });

    logger.info('Pinecone client initialized successfully');
    return pineconeClient;
  } catch (error: any) {
    logger.error('Failed to initialize Pinecone client', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get Pinecone client instance
 */
export function getPineconeClient(): Pinecone | null {
  if (!pineconeClient) {
    return initializePinecone();
  }
  return pineconeClient;
}

/**
 * Get Pinecone index
 */
export async function getPineconeIndex() {
  const client = getPineconeClient();
  if (!client) {
    throw new Error('Pinecone client not initialized. Please configure PINECONE_API_KEY.');
  }

  const indexName = config.PINECONE_INDEX_NAME || 'queryai-embeddings';
  
  try {
    const index = client.index(indexName);
    return index;
  } catch (error: any) {
    logger.error('Failed to get Pinecone index', {
      error: error.message,
      indexName,
    });
    throw error;
  }
}

/**
 * Check if Pinecone is configured
 */
export function isPineconeConfigured(): boolean {
  return !!config.PINECONE_API_KEY;
}

/**
 * Get index name
 */
export function getIndexName(): string {
  return config.PINECONE_INDEX_NAME || 'queryai-embeddings';
}

// Initialize on module load
initializePinecone();
