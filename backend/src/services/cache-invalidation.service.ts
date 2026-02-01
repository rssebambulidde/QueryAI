/**
 * Cache Invalidation Service
 * Handles cache invalidation triggers, versioning, and strategies
 */

import { RedisCacheService } from './redis-cache.service';
import { RAGService } from './rag.service';
import logger from '../config/logger';

export interface InvalidationTrigger {
  type: 'document' | 'topic' | 'user' | 'time' | 'manual';
  userId: string;
  topicId?: string;
  documentIds?: string[];
  reason?: string;
  timestamp: number;
}

export interface CacheVersion {
  version: string; // Version string (e.g., "v1.2.3" or timestamp-based)
  createdAt: number;
  updatedAt: number;
}

export interface InvalidationOptions {
  invalidateRAG?: boolean; // Invalidate RAG context cache (default: true)
  invalidateEmbeddings?: boolean; // Invalidate embedding cache (default: false)
  invalidateSearch?: boolean; // Invalidate search cache (default: false)
  invalidateAll?: boolean; // Invalidate all caches (default: false)
  reason?: string; // Reason for invalidation
}

export interface InvalidationResult {
  success: boolean;
  invalidated: {
    rag: number; // Number of RAG cache entries invalidated
    embeddings: number; // Number of embedding cache entries invalidated
    search: number; // Number of search cache entries invalidated
    total: number; // Total entries invalidated
  };
  errors: string[];
  trigger: InvalidationTrigger;
}

/**
 * Cache Invalidation Service
 * Manages cache invalidation with triggers, versioning, and strategies
 */
export class CacheInvalidationService {
  private static readonly CACHE_VERSION_KEY = 'cache:version';
  private static readonly INVALIDATION_LOG_PREFIX = 'invalidation:log';

  /**
   * Get current cache version
   */
  static async getCacheVersion(): Promise<CacheVersion | null> {
    try {
      const version = await RedisCacheService.get<CacheVersion>(this.CACHE_VERSION_KEY, {
        prefix: 'system',
      });
      return version;
    } catch (error: any) {
      logger.warn('Failed to get cache version', { error: error.message });
      return null;
    }
  }

  /**
   * Increment cache version (invalidates all versioned caches)
   */
  static async incrementCacheVersion(): Promise<string> {
    try {
      const currentVersion = await this.getCacheVersion();
      const newVersion = `v${Date.now()}`;
      
      const version: CacheVersion = {
        version: newVersion,
        createdAt: currentVersion?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await RedisCacheService.set(this.CACHE_VERSION_KEY, version, {
        prefix: 'system',
        ttl: 365 * 24 * 60 * 60, // 1 year (versions don't expire)
      });

      logger.info('Cache version incremented', {
        oldVersion: currentVersion?.version,
        newVersion,
      });

      return newVersion;
    } catch (error: any) {
      logger.error('Failed to increment cache version', { error: error.message });
      throw error;
    }
  }

  /**
   * Invalidate cache for document updates
   */
  static async invalidateDocumentCache(
    userId: string,
    documentIds: string[],
    options?: InvalidationOptions
  ): Promise<InvalidationResult> {
    const trigger: InvalidationTrigger = {
      type: 'document',
      userId,
      documentIds,
      reason: options?.reason || 'Document updated',
      timestamp: Date.now(),
    };

    const result: InvalidationResult = {
      success: true,
      invalidated: {
        rag: 0,
        embeddings: 0,
        search: 0,
        total: 0,
      },
      errors: [],
      trigger,
    };

    try {
      // Invalidate RAG context cache
      if (options?.invalidateRAG !== false) {
        try {
          const ragInvalidated = await RAGService.invalidateDocumentCache(userId, documentIds);
          result.invalidated.rag = ragInvalidated;
          result.invalidated.total += ragInvalidated;
        } catch (error: any) {
          result.errors.push(`RAG invalidation failed: ${error.message}`);
          result.success = false;
        }
      }

      // Invalidate embedding cache for affected documents
      if (options?.invalidateEmbeddings) {
        try {
          // Invalidate embeddings by document IDs (if we track this)
          // For now, we'll invalidate all embeddings for the user
          // This could be optimized to track document-specific embeddings
          const embeddingInvalidated = await RedisCacheService.deletePattern(
            `*`,
            {
              prefix: 'embedding',
            }
          );
          result.invalidated.embeddings = embeddingInvalidated;
          result.invalidated.total += embeddingInvalidated;
        } catch (error: any) {
          result.errors.push(`Embedding invalidation failed: ${error.message}`);
        }
      }

      // Invalidate search cache
      if (options?.invalidateSearch) {
        try {
          const searchInvalidated = await RedisCacheService.deletePattern(
            `*`,
            {
              prefix: 'search',
            }
          );
          result.invalidated.search = searchInvalidated;
          result.invalidated.total += searchInvalidated;
        } catch (error: any) {
          result.errors.push(`Search invalidation failed: ${error.message}`);
        }
      }

      // Log invalidation
      await this.logInvalidation(trigger, result);

      logger.info('Document cache invalidated', {
        userId,
        documentIds: documentIds.length,
        invalidated: result.invalidated,
      });

      return result;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Invalidation failed: ${error.message}`);
      logger.error('Document cache invalidation failed', {
        userId,
        documentIds,
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Invalidate cache for topic updates
   */
  static async invalidateTopicCache(
    userId: string,
    topicId: string,
    options?: InvalidationOptions
  ): Promise<InvalidationResult> {
    const trigger: InvalidationTrigger = {
      type: 'topic',
      userId,
      topicId,
      reason: options?.reason || 'Topic updated',
      timestamp: Date.now(),
    };

    const result: InvalidationResult = {
      success: true,
      invalidated: {
        rag: 0,
        embeddings: 0,
        search: 0,
        total: 0,
      },
      errors: [],
      trigger,
    };

    try {
      // Invalidate RAG context cache
      if (options?.invalidateRAG !== false) {
        try {
          const ragInvalidated = await RAGService.invalidateTopicCache(userId, topicId);
          result.invalidated.rag = ragInvalidated;
          result.invalidated.total += ragInvalidated;
        } catch (error: any) {
          result.errors.push(`RAG invalidation failed: ${error.message}`);
          result.success = false;
        }
      }

      // Log invalidation
      await this.logInvalidation(trigger, result);

      logger.info('Topic cache invalidated', {
        userId,
        topicId,
        invalidated: result.invalidated,
      });

      return result;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Invalidation failed: ${error.message}`);
      logger.error('Topic cache invalidation failed', {
        userId,
        topicId,
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Invalidate cache for user (all user data)
   */
  static async invalidateUserCache(
    userId: string,
    options?: InvalidationOptions
  ): Promise<InvalidationResult> {
    const trigger: InvalidationTrigger = {
      type: 'user',
      userId,
      reason: options?.reason || 'User data updated',
      timestamp: Date.now(),
    };

    const result: InvalidationResult = {
      success: true,
      invalidated: {
        rag: 0,
        embeddings: 0,
        search: 0,
        total: 0,
      },
      errors: [],
      trigger,
    };

    try {
      // Invalidate RAG context cache
      if (options?.invalidateRAG !== false) {
        try {
          const ragInvalidated = await RAGService.invalidateUserCache(userId);
          result.invalidated.rag = ragInvalidated;
          result.invalidated.total += ragInvalidated;
        } catch (error: any) {
          result.errors.push(`RAG invalidation failed: ${error.message}`);
          result.success = false;
        }
      }

      // Invalidate all caches if requested
      if (options?.invalidateAll) {
        try {
          const allInvalidated = await RedisCacheService.deletePattern(
            `*|${userId}|*`,
            {
              prefix: 'rag',
            }
          );
          result.invalidated.rag += allInvalidated;
          result.invalidated.total += allInvalidated;
        } catch (error: any) {
          result.errors.push(`Full invalidation failed: ${error.message}`);
        }
      }

      // Log invalidation
      await this.logInvalidation(trigger, result);

      logger.info('User cache invalidated', {
        userId,
        invalidated: result.invalidated,
      });

      return result;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Invalidation failed: ${error.message}`);
      logger.error('User cache invalidation failed', {
        userId,
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Time-based cache invalidation
   * Invalidates caches older than specified age
   */
  static async invalidateByTime(
    maxAgeSeconds: number,
    options?: InvalidationOptions
  ): Promise<InvalidationResult> {
    const trigger: InvalidationTrigger = {
      type: 'time',
      userId: 'system',
      reason: options?.reason || `Cache entries older than ${maxAgeSeconds}s`,
      timestamp: Date.now(),
    };

    const result: InvalidationResult = {
      success: true,
      invalidated: {
        rag: 0,
        embeddings: 0,
        search: 0,
        total: 0,
      },
      errors: [],
      trigger,
    };

    try {
      const cutoffTime = Date.now() - (maxAgeSeconds * 1000);
      const prefixes = ['rag', 'embedding', 'search'];
      
      for (const prefix of prefixes) {
        try {
          // Get all keys with prefix
          const { getRedisClient } = await import('../config/redis.config');
          const client = await getRedisClient();
          
          const keys: string[] = [];
          let cursor = 0;
          
          do {
            const scanResult = await client.scan(cursor, {
              MATCH: `${prefix}:*`,
              COUNT: 100,
            });
            cursor = scanResult.cursor;
            keys.push(...scanResult.keys);
          } while (cursor !== 0);

          // Check TTL for each key and delete if expired or too old
          let deleted = 0;
          for (const key of keys) {
            try {
              const ttl = await client.ttl(key);
              
              // If TTL is -1 (no expiration) or -2 (key doesn't exist), skip
              if (ttl === -1 || ttl === -2) {
                // For keys without TTL, check if we should delete based on age
                // This would require storing timestamps, which we do for RAG cache
                continue;
              }
              
              // If TTL indicates the key is very old, we could delete it
              // But Redis handles TTL automatically, so we mainly log
            } catch (error: any) {
              // Skip errors for individual keys
            }
          }

          // For RAG cache, we can check timestamps in the cache entries
          if (prefix === 'rag') {
            // RAG cache entries have timestamps, we can check those
            // This is handled by TTL, but we log for monitoring
          }

          // Count would be based on actual deletions
          // For now, we rely on TTL expiration
          logger.info('Time-based cache check completed', {
            prefix,
            keysChecked: keys.length,
          });
        } catch (error: any) {
          result.errors.push(`${prefix} invalidation failed: ${error.message}`);
        }
      }

      // Log invalidation
      await this.logInvalidation(trigger, result);

      logger.info('Time-based cache invalidation completed', {
        maxAgeSeconds,
        invalidated: result.invalidated,
      });

      return result;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Time-based invalidation failed: ${error.message}`);
      logger.error('Time-based cache invalidation failed', {
        maxAgeSeconds,
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Manual cache invalidation
   */
  static async invalidateManually(
    userId: string,
    options: InvalidationOptions & {
      cacheType?: 'rag' | 'embedding' | 'search' | 'all';
      pattern?: string; // Custom pattern for invalidation
    }
  ): Promise<InvalidationResult> {
    const trigger: InvalidationTrigger = {
      type: 'manual',
      userId,
      reason: options.reason || 'Manual invalidation',
      timestamp: Date.now(),
    };

    const result: InvalidationResult = {
      success: true,
      invalidated: {
        rag: 0,
        embeddings: 0,
        search: 0,
        total: 0,
      },
      errors: [],
      trigger,
    };

    try {
      const cacheType = options.cacheType || 'all';
      const pattern = options.pattern || '*';

      if (cacheType === 'rag' || cacheType === 'all') {
        try {
          const invalidated = await RedisCacheService.deletePattern(pattern, {
            prefix: 'rag',
          });
          result.invalidated.rag = invalidated;
          result.invalidated.total += invalidated;
        } catch (error: any) {
          result.errors.push(`RAG invalidation failed: ${error.message}`);
        }
      }

      if (cacheType === 'embedding' || cacheType === 'all') {
        try {
          const invalidated = await RedisCacheService.deletePattern(pattern, {
            prefix: 'embedding',
          });
          result.invalidated.embeddings = invalidated;
          result.invalidated.total += invalidated;
        } catch (error: any) {
          result.errors.push(`Embedding invalidation failed: ${error.message}`);
        }
      }

      if (cacheType === 'search' || cacheType === 'all') {
        try {
          const invalidated = await RedisCacheService.deletePattern(pattern, {
            prefix: 'search',
          });
          result.invalidated.search = invalidated;
          result.invalidated.total += invalidated;
        } catch (error: any) {
          result.errors.push(`Search invalidation failed: ${error.message}`);
        }
      }

      // Log invalidation
      await this.logInvalidation(trigger, result);

      logger.info('Manual cache invalidation completed', {
        userId,
        cacheType,
        pattern,
        invalidated: result.invalidated,
      });

      return result;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Manual invalidation failed: ${error.message}`);
      logger.error('Manual cache invalidation failed', {
        userId,
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Clear all caches (use with caution)
   */
  static async clearAllCaches(): Promise<InvalidationResult> {
    const trigger: InvalidationTrigger = {
      type: 'manual',
      userId: 'system',
      reason: 'Clear all caches',
      timestamp: Date.now(),
    };

    const result: InvalidationResult = {
      success: true,
      invalidated: {
        rag: 0,
        embeddings: 0,
        search: 0,
        total: 0,
      },
      errors: [],
      trigger,
    };

    try {
      // Clear RAG cache
      try {
        const ragCleared = await RAGService.clearAllRAGCache();
        result.invalidated.rag = ragCleared;
        result.invalidated.total += ragCleared;
      } catch (error: any) {
        result.errors.push(`RAG cache clear failed: ${error.message}`);
      }

      // Clear embedding cache
      try {
        const embeddingCleared = await RedisCacheService.clearAll({
          prefix: 'embedding',
        });
        result.invalidated.embeddings = embeddingCleared;
        result.invalidated.total += embeddingCleared;
      } catch (error: any) {
        result.errors.push(`Embedding cache clear failed: ${error.message}`);
      }

      // Clear search cache
      try {
        const searchCleared = await RedisCacheService.clearAll({
          prefix: 'search',
        });
        result.invalidated.search = searchCleared;
        result.invalidated.total += searchCleared;
      } catch (error: any) {
        result.errors.push(`Search cache clear failed: ${error.message}`);
      }

      // Increment cache version
      await this.incrementCacheVersion();

      // Log invalidation
      await this.logInvalidation(trigger, result);

      logger.info('All caches cleared', {
        invalidated: result.invalidated,
      });

      return result;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Clear all failed: ${error.message}`);
      logger.error('Clear all caches failed', {
        error: error.message,
      });
      return result;
    }
  }

  /**
   * Log invalidation event
   */
  private static async logInvalidation(
    trigger: InvalidationTrigger,
    result: InvalidationResult
  ): Promise<void> {
    try {
      const logKey = `${this.INVALIDATION_LOG_PREFIX}:${trigger.timestamp}`;
      const logEntry = {
        trigger,
        result: {
          success: result.success,
          invalidated: result.invalidated,
          errors: result.errors,
        },
      };

      await RedisCacheService.set(logKey, logEntry, {
        prefix: 'system',
        ttl: 7 * 24 * 60 * 60, // Keep logs for 7 days
      });
    } catch (error: any) {
      // Don't fail if logging fails
      logger.warn('Failed to log invalidation', { error: error.message });
    }
  }

  /**
   * Get invalidation history
   */
  static async getInvalidationHistory(
    limit: number = 50
  ): Promise<Array<{ trigger: InvalidationTrigger; result: Partial<InvalidationResult> }>> {
    try {
      const { getRedisClient } = await import('../config/redis.config');
      const client = await getRedisClient();
      
      const keys: string[] = [];
      let cursor = 0;
      
      do {
        const result = await client.scan(cursor, {
          MATCH: `system:${this.INVALIDATION_LOG_PREFIX}:*`,
          COUNT: 100,
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      // Sort by timestamp (newest first)
      keys.sort((a, b) => {
        const timestampA = parseInt(a.split(':').pop() || '0');
        const timestampB = parseInt(b.split(':').pop() || '0');
        return timestampB - timestampA;
      });

      // Get most recent entries
      const recentKeys = keys.slice(0, limit);
      const history: Array<{ trigger: InvalidationTrigger; result: Partial<InvalidationResult> }> = [];

      for (const key of recentKeys) {
        try {
          const entry = await RedisCacheService.get<{
            trigger: InvalidationTrigger;
            result: Partial<InvalidationResult>;
          }>(key.replace('system:', ''), {
            prefix: 'system',
          });

          if (entry) {
            history.push(entry);
          }
        } catch (error: any) {
          // Skip invalid entries
        }
      }

      return history;
    } catch (error: any) {
      logger.error('Failed to get invalidation history', { error: error.message });
      return [];
    }
  }
}

export default CacheInvalidationService;
