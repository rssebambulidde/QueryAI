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
 * Shared reconnect strategy - limits retries to avoid log spam
 */
function reconnectStrategy(retries: number): number | Error {
  if (retries > 10) {
    logger.error('Redis reconnection failed after 10 retries');
    return new Error('Redis reconnection failed');
  }
  return Math.min(retries * 50, 3000);
}

/**
 * Get Redis configuration from environment variables.
 * Explicitly parses REDIS_URL into host/port/password to avoid libraries
 * silently falling back to localhost when URL parsing fails.
 */
export function getRedisConfig(): any {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      logger.info('Redis config from REDIS_URL', { host: parsed.hostname, port: parsed.port });
      return {
        url: redisUrl,
        socket: {
          host: parsed.hostname,
          port: parseInt(parsed.port || '6379', 10),
          reconnectStrategy,
          connectTimeout: 10000,
        },
        password: parsed.password || undefined,
        username: parsed.username || undefined,
        database: parsed.pathname ? parseInt(parsed.pathname.slice(1) || '0', 10) : 0,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: false,
      };
    } catch (e) {
      logger.warn('Failed to parse REDIS_URL, using raw url', { url: redisUrl?.slice(0, 20) });
      return {
        url: redisUrl,
        socket: { reconnectStrategy, connectTimeout: 10000 },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: false,
      };
    }
  }

  // Fallback to individual connection parameters
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  logger.info('Redis config from individual params', { host, port });
  return {
    socket: {
      host,
      port,
      reconnectStrategy,
      connectTimeout: 10000,
    },
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    database: parseInt(process.env.REDIS_DATABASE || '0', 10),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: false,
  };
}

/**
 * Check if Redis is configured and reachable (not localhost in production).
 * In production (e.g. Railway), avoid connecting to localhost:6379 when Redis
 * is not actually provided, which causes ECONNREFUSED and log noise.
 */
export function isRedisConfigured(): boolean {
  const url = process.env.REDIS_URL;
  const host = process.env.REDIS_HOST;
  if (url) {
    // In production, treat redis://localhost or redis://127.0.0.1 as not configured
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.RAILWAY_ENVIRONMENT === 'production' ||
      !!process.env.RAILWAY_PUBLIC_DOMAIN;
    if (isProduction && url) {
      try {
        const u = new URL(url);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return false;
      } catch {
        // ignore
      }
    }
    return true;
  }
  if (host) {
    const isProduction =
      process.env.NODE_ENV === 'production' ||
      process.env.RAILWAY_ENVIRONMENT === 'production' ||
      !!process.env.RAILWAY_PUBLIC_DOMAIN;
    if (isProduction && (host === 'localhost' || host === '127.0.0.1')) return false;
    return true;
  }
  return false;
}

/**
 * Create Redis client with connection pooling
 */
export async function createRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isReady) {
    return redisClient;
  }

  if (!isRedisConfigured()) {
    // Redis is optional - don't throw error, just log and return null-like behavior
    logger.debug('Redis is not configured. Caching will be disabled.');
    throw new Error('Redis is not configured. Set REDIS_URL or REDIS_HOST environment variable.');
  }

  const redisConfig = getRedisConfig();
  logger.info('Creating Redis client', { configKeys: Object.keys(redisConfig) });
  const client = createClient(redisConfig) as RedisClientType;

  // Error handling - only log once to avoid log spam
  let errorCount = 0;
  client.on('error', (err) => {
    errorCount++;
    if (errorCount <= 3) {
      logger.error('Redis client error', { error: err.message, count: errorCount });
    } else if (errorCount === 4) {
      logger.error('Redis client error (suppressing further errors)', { totalErrors: errorCount });
    }
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
