/**
 * Redis Configuration
 * Configures Redis client connection with connection pooling
 */

import { createClient } from 'redis';
import logger from './logger';
import config from './env';

// Infer Redis client type from createClient
type RedisClientType = ReturnType<typeof createClient>;

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  username?: string;
  database?: number;
  socket?: {
    reconnectStrategy?: (retries: number) => number | Error;
    connectTimeout?: number;
  };
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
}

let redisClient: RedisClientType | null = null;
let redisClientPromise: Promise<RedisClientType> | null = null;

/**
 * Get Redis configuration from environment variables
 */
export function getRedisConfig(): RedisConfig {
  // Support both Redis URL and individual connection parameters
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    // Parse Redis URL (format: redis://[username]:[password]@[host]:[port]/[database])
    return {
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 retries');
            return new Error('Redis reconnection failed');
          }
          // Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc., max 3s
          return Math.min(retries * 50, 3000);
        },
        connectTimeout: 10000, // 10 seconds
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: false, // Don't queue commands when offline
    };
  }

  // Fallback to individual connection parameters
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    database: parseInt(process.env.REDIS_DATABASE || '0', 10),
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 retries');
          return new Error('Redis reconnection failed');
        }
        return Math.min(retries * 50, 3000);
      },
      connectTimeout: 10000,
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: false,
  };
}

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.REDIS_URL || process.env.REDIS_HOST);
}

/**
 * Create Redis client with connection pooling
 */
export async function createRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isReady) {
    return redisClient;
  }

  if (!isRedisConfigured()) {
    throw new Error('Redis is not configured. Set REDIS_URL or REDIS_HOST environment variable.');
  }

  const redisConfig = getRedisConfig();
  const client = createClient(redisConfig) as RedisClientType;

  // Error handling
  client.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });

  client.on('connect', () => {
    logger.info('Redis client connecting...');
  });

  client.on('ready', () => {
    logger.info('Redis client ready');
  });

  client.on('reconnecting', () => {
    logger.warn('Redis client reconnecting...');
  });

  client.on('end', () => {
    logger.warn('Redis client connection ended');
  });

  // Connect to Redis
  try {
    await client.connect();
    redisClient = client;
    logger.info('Redis client connected successfully');
    return client;
  } catch (error: any) {
    logger.error('Failed to connect to Redis', { error: error.message });
    throw error;
  }
}

/**
 * Get or create Redis client (singleton pattern with connection pooling)
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    try {
      // Check if client is ready (connected and ready to send commands)
      if (redisClient.isReady) {
        return redisClient;
      }
      // If client exists but not ready, try to reconnect
      if (!redisClient.isOpen) {
        await redisClient.connect();
        return redisClient;
      }
    } catch (error: any) {
      // If check fails, create new client
      logger.warn('Redis client check failed, creating new client', {
        error: error.message,
      });
      redisClient = null;
    }
  }

  if (redisClientPromise) {
    return redisClientPromise;
  }

  redisClientPromise = createRedisClient();
  
  try {
    const client = await redisClientPromise;
    redisClientPromise = null;
    return client;
  } catch (error) {
    redisClientPromise = null;
    throw error;
  }
}

/**
 * Close Redis client connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis client disconnected');
    } catch (error: any) {
      logger.error('Error closing Redis client', { error: error.message });
    } finally {
      redisClient = null;
      redisClientPromise = null;
    }
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    if (!isRedisConfigured()) {
      return false;
    }

    const client = await getRedisClient();
    await client.ping();
    return true;
  } catch (error: any) {
    logger.warn('Redis health check failed', { error: error.message });
    return false;
  }
}

export default {
  getRedisClient,
  closeRedisClient,
  isRedisConfigured,
  checkRedisHealth,
  getRedisConfig,
};
