/**
 * Redis Cache Service
 * Provides distributed caching using Redis with connection pooling
 */

import { getRedisClient, isRedisConfigured, checkRedisHealth } from '../config/redis.config';
import logger from '../config/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 3600 = 1 hour)
  prefix?: string; // Key prefix for namespacing (default: 'cache')
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

export interface EmbeddingCacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
  hitRate: number; // Calculated hit rate percentage
}

export interface RAGCacheStats {
  hits: number;
  misses: number;
  sets: number;
  similarityHits: number; // Cache hits from similarity lookup
  errors: number;
  hitRate: number; // Calculated hit rate percentage
}

export interface SimilarityCacheEntry<T> {
  key: string;
  value: T;
  embedding: number[]; // Query embedding for similarity matching
  timestamp: number;
}

/**
 * Redis Cache Service
 * Provides distributed caching with automatic serialization/deserialization
 */
export class RedisCacheService {
  private static stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  // Embedding-specific cache statistics
  private static embeddingStats: EmbeddingCacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    errors: 0,
    hitRate: 0,
  };

  // RAG context cache statistics
  private static ragStats: RAGCacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    similarityHits: 0,
    errors: 0,
    hitRate: 0,
  };

  /**
   * Generate cache key with prefix
   */
  private static generateKey(key: string, prefix?: string): string {
    const cachePrefix = prefix || 'cache';
    return `${cachePrefix}:${key}`;
  }

  /**
   * Get value from cache
   */
  static async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!isRedisConfigured()) {
      logger.debug('Redis not configured, cache get skipped', { key });
      this.stats.misses++;
      return null;
    }

    try {
      const client = await getRedisClient();
      const cacheKey = this.generateKey(key, options?.prefix);
      
      const value = await client.get(cacheKey);
      
      if (value === null) {
        this.stats.misses++;
        logger.debug('Cache miss', { key: cacheKey });
        return null;
      }

      this.stats.hits++;
      logger.debug('Cache hit', { key: cacheKey });
      
      // Parse JSON value
      try {
        const parsed = JSON.parse(value);
        
        // Handle similarity cache entries (with embedding) - extract just the value
        if (parsed && typeof parsed === 'object' && 'value' in parsed && 'embedding' in parsed) {
          return parsed.value as T;
        }
        
        // Regular cache entry
        return parsed as T;
      } catch (parseError: any) {
        logger.warn('Failed to parse cached value', {
          key: cacheKey,
          error: parseError.message,
        });
        this.stats.errors++;
        return null;
      }
    } catch (error: any) {
      this.stats.errors++;
      logger.error('Redis cache get error', {
        key,
        error: error.message,
      });
      // Don't throw - return null to allow fallback to source
      return null;
    }
  }

  /**
   * Set value in cache
   */
  static async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    if (!isRedisConfigured()) {
      logger.debug('Redis not configured, cache set skipped', { key });
      return false;
    }

    try {
      const client = await getRedisClient();
      const cacheKey = this.generateKey(key, options?.prefix);
      const ttl = options?.ttl || 3600; // Default 1 hour
      
      // Serialize value to JSON
      const serialized = JSON.stringify(value);
      
      // Set with TTL
      await client.setEx(cacheKey, ttl, serialized);
      
      this.stats.sets++;
      logger.debug('Cache set', { key: cacheKey, ttl });
      return true;
    } catch (error: any) {
      this.stats.errors++;
      logger.error('Redis cache set error', {
        key,
        error: error.message,
      });
      // Don't throw - return false to allow graceful degradation
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  static async delete(key: string, options?: CacheOptions): Promise<boolean> {
    if (!isRedisConfigured()) {
      logger.debug('Redis not configured, cache delete skipped', { key });
      return false;
    }

    try {
      const client = await getRedisClient();
      const cacheKey = this.generateKey(key, options?.prefix);
      
      const result = await client.del(cacheKey);
      
      if (result > 0) {
        this.stats.deletes++;
        logger.debug('Cache delete', { key: cacheKey });
        return true;
      }
      
      return false;
    } catch (error: any) {
      this.stats.errors++;
      logger.error('Redis cache delete error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  static async deletePattern(pattern: string, options?: CacheOptions): Promise<number> {
    if (!isRedisConfigured()) {
      logger.debug('Redis not configured, cache delete pattern skipped', { pattern });
      return 0;
    }

    try {
      const client = await getRedisClient();
      const prefix = options?.prefix || 'cache';
      const fullPattern = `${prefix}:${pattern}`;
      
      // Use SCAN to find matching keys (more efficient than KEYS for large datasets)
      const keys: string[] = [];
      let cursor = 0;
      
      do {
        const result = await client.scan(cursor, {
          MATCH: fullPattern,
          COUNT: 100,
        });
        cursor = result.cursor;
        keys.push(...result.keys);
      } while (cursor !== 0);

      if (keys.length === 0) {
        return 0;
      }

      // Delete all matching keys
      const deleted = await client.del(keys);
      this.stats.deletes += deleted;
      
      logger.debug('Cache delete pattern', {
        pattern: fullPattern,
        deleted,
      });
      
      return deleted;
    } catch (error: any) {
      this.stats.errors++;
      logger.error('Redis cache delete pattern error', {
        pattern,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  static async exists(key: string, options?: CacheOptions): Promise<boolean> {
    if (!isRedisConfigured()) {
      return false;
    }

    try {
      const client = await getRedisClient();
      const cacheKey = this.generateKey(key, options?.prefix);
      
      const result = await client.exists(cacheKey);
      return result > 0;
    } catch (error: any) {
      this.stats.errors++;
      logger.error('Redis cache exists error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get TTL (time to live) for a key in seconds
   */
  static async getTTL(key: string, options?: CacheOptions): Promise<number> {
    if (!isRedisConfigured()) {
      return -1;
    }

    try {
      const client = await getRedisClient();
      const cacheKey = this.generateKey(key, options?.prefix);
      
      const ttl = await client.ttl(cacheKey);
      return ttl;
    } catch (error: any) {
      this.stats.errors++;
      logger.error('Redis cache TTL error', {
        key,
        error: error.message,
      });
      return -1;
    }
  }

  /**
   * Extend TTL for a key
   */
  static async extendTTL(
    key: string,
    ttl: number,
    options?: CacheOptions
  ): Promise<boolean> {
    if (!isRedisConfigured()) {
      return false;
    }

    try {
      const client = await getRedisClient();
      const cacheKey = this.generateKey(key, options?.prefix);
      
      const result = await client.expire(cacheKey, ttl);
      return result;
    } catch (error: any) {
      this.stats.errors++;
      logger.error('Redis cache extend TTL error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  static async clearAll(options?: CacheOptions): Promise<number> {
    if (!isRedisConfigured()) {
      return 0;
    }

    try {
      const prefix = options?.prefix || 'cache';
      return await this.deletePattern('*', { ...options, prefix });
    } catch (error: any) {
      this.stats.errors++;
      logger.error('Redis cache clear all error', {
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  static resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Get embedding cache statistics
   */
  static getEmbeddingStats(): EmbeddingCacheStats {
    const total = this.embeddingStats.hits + this.embeddingStats.misses;
    const hitRate = total > 0 
      ? (this.embeddingStats.hits / total) * 100 
      : 0;
    
    return {
      ...this.embeddingStats,
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
    };
  }

  /**
   * Reset embedding cache statistics
   */
  static resetEmbeddingStats(): void {
    this.embeddingStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Record embedding cache hit (internal use)
   */
  static recordEmbeddingHit(): void {
    this.embeddingStats.hits++;
  }

  /**
   * Record embedding cache miss (internal use)
   */
  static recordEmbeddingMiss(): void {
    this.embeddingStats.misses++;
  }

  /**
   * Record embedding cache set (internal use)
   */
  static recordEmbeddingSet(): void {
    this.embeddingStats.sets++;
  }

  /**
   * Record embedding cache error (internal use)
   */
  static recordEmbeddingError(): void {
    this.embeddingStats.errors++;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find similar cache entries using embedding similarity
   * Returns entries with similarity >= threshold
   */
  static async findSimilarEntries<T>(
    queryEmbedding: number[],
    options?: CacheOptions & {
      similarityThreshold?: number; // Minimum similarity (0-1, default: 0.85)
      maxResults?: number; // Maximum number of similar entries (default: 5)
    }
  ): Promise<Array<{ key: string; value: T; similarity: number }>> {
    if (!isRedisConfigured()) {
      return [];
    }

    const threshold = options?.similarityThreshold ?? 0.85;
    const maxResults = options?.maxResults ?? 5;
    const prefix = options?.prefix || 'rag';

    try {
      const client = await getRedisClient();
      
      // Get cache keys with the prefix (limit to reasonable number for performance)
      const keys: string[] = [];
      let cursor = 0;
      const maxKeys = 1000; // Limit to 1000 keys for performance
      
      do {
        const result = await client.scan(cursor, {
          MATCH: `${prefix}:*`,
          COUNT: 100,
        });
        cursor = result.cursor;
        keys.push(...result.keys);
        
        // Stop if we have enough keys or reached max
        if (keys.length >= maxKeys) {
          break;
        }
      } while (cursor !== 0);

      if (keys.length === 0) {
        return [];
      }

      // Get entries and calculate similarities (limit to most recent for performance)
      const entries: Array<{ key: string; value: T; similarity: number }> = [];
      
      // Process keys in batches for efficiency
      const batchSize = 50;
      for (let i = 0; i < Math.min(keys.length, maxKeys); i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        // Get values for this batch
        const values = await Promise.all(
          batch.map(key => client.get(key).catch(() => null))
        );
        
        for (let j = 0; j < batch.length; j++) {
          const value = values[j];
          if (!value) continue;
          
          try {
            const entry: SimilarityCacheEntry<T> = JSON.parse(value);
            
            // Only process entries with embeddings (RAG context entries)
            if (entry.embedding && Array.isArray(entry.embedding) && entry.embedding.length > 0) {
              const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
              
              if (similarity >= threshold) {
                entries.push({
                  key: entry.key,
                  value: entry.value,
                  similarity,
                });
                
                // Early exit if we found a very similar match
                if (similarity >= 0.95) {
                  logger.debug('Found very similar cache entry, stopping search', {
                    similarity,
                    key: entry.key,
                  });
                  return entries.slice(0, maxResults);
                }
              }
            }
          } catch (error: any) {
            // Skip invalid entries (regular cache entries without embeddings)
            // No need to log - these are expected
          }
        }
        
        // Early exit if we have enough results
        if (entries.length >= maxResults) {
          break;
        }
      }

      // Sort by similarity (highest first) and return top results
      entries.sort((a, b) => b.similarity - a.similarity);
      
      return entries.slice(0, maxResults);
    } catch (error: any) {
      this.ragStats.errors++;
      logger.error('Error finding similar cache entries', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Set value in cache with embedding for similarity lookup
   */
  static async setWithEmbedding<T>(
    key: string,
    value: T,
    embedding: number[],
    options?: CacheOptions
  ): Promise<boolean> {
    if (!isRedisConfigured()) {
      logger.debug('Redis not configured, cache set skipped', { key });
      return false;
    }

    try {
      const client = await getRedisClient();
      const cacheKey = this.generateKey(key, options?.prefix);
      const ttl = options?.ttl || 3600;
      
      // Create entry with embedding
      const entry: SimilarityCacheEntry<T> = {
        key,
        value,
        embedding,
        timestamp: Date.now(),
      };
      
      // Serialize entry to JSON
      const serialized = JSON.stringify(entry);
      
      // Set with TTL
      await client.setEx(cacheKey, ttl, serialized);
      
      this.ragStats.sets++;
      logger.debug('RAG cache set with embedding', { key: cacheKey, ttl });
      return true;
    } catch (error: any) {
      this.ragStats.errors++;
      logger.error('Redis cache set with embedding error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get RAG cache statistics
   */
  static getRAGStats(): RAGCacheStats {
    const total = this.ragStats.hits + this.ragStats.misses;
    const hitRate = total > 0 
      ? (this.ragStats.hits / total) * 100 
      : 0;
    
    return {
      ...this.ragStats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Reset RAG cache statistics
   */
  static resetRAGStats(): void {
    this.ragStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      similarityHits: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Record RAG cache hit (internal use)
   */
  static recordRAGHit(): void {
    this.ragStats.hits++;
  }

  /**
   * Record RAG cache miss (internal use)
   */
  static recordRAGMiss(): void {
    this.ragStats.misses++;
  }

  /**
   * Record RAG similarity hit (internal use)
   */
  static recordRAGSimilarityHit(): void {
    this.ragStats.similarityHits++;
    this.ragStats.hits++; // Also count as regular hit
  }

  /**
   * Record RAG cache set (internal use)
   */
  static recordRAGSet(): void {
    this.ragStats.sets++;
  }

  /**
   * Record RAG cache error (internal use)
   */
  static recordRAGError(): void {
    this.ragStats.errors++;
  }

  /**
   * Health check for cache service
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    configured: boolean;
    stats: CacheStats;
    embeddingStats: EmbeddingCacheStats;
    ragStats: RAGCacheStats;
  }> {
    const configured = isRedisConfigured();
    const healthy = configured ? await checkRedisHealth() : false;
    
    return {
      healthy,
      configured,
      stats: this.getStats(),
      embeddingStats: this.getEmbeddingStats(),
      ragStats: this.getRAGStats(),
    };
  }
}

export default RedisCacheService;
