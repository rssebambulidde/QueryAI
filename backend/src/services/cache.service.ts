/**
 * Cache Service (Week 11: Cost Optimization)
 * Advanced caching strategies, cache warming, and optimized cache keys.
 * Wraps RedisCacheService with consistent key building, get-or-set, and warming.
 */

import crypto from 'crypto';
import { RedisCacheService, type CacheOptions } from './redis-cache.service';
import logger from '../config/logger';
import { CacheTtlConfig } from '../config/thresholds.config';

/** Default TTL by prefix (seconds). */
const TIERED_TTL: Record<string, number> = {
  rag: CacheTtlConfig.ragMixed,
  embedding: CacheTtlConfig.embeddingTiered,
  search: CacheTtlConfig.searchTiered,
  llm: CacheTtlConfig.llmResponse,
  cache: CacheTtlConfig.defaultFallback,
  system: CacheTtlConfig.system,
};

/** Max key segment length before hashing. */
const MAX_KEY_SEGMENT = 200;

/**
 * Optimized cache key builder.
 * - Normalizes segments (trim, collapse whitespace, lowercase where appropriate).
 * - Hashes long segments to keep keys bounded.
 * - Consistent structure: prefix:part1:part2:... or prefix:hash
 */
export const CacheKeyBuilder = {
  /**
   * Simple non-crypto hash for key shortening (djb2).
   */
  hash(str: string): string {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h) + str.charCodeAt(i);
      h = h & 0x7fffffff;
    }
    return Math.abs(h).toString(36);
  },

  /**
   * SHA-256 truncated hex for cache keys (when consistency matters).
   */
  sha256(str: string, len = 16): string {
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, len);
  },

  /**
   * Normalize a string segment for key building.
   */
  normalize(segment: string): string {
    return String(segment)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  },

  /**
   * Build a cache key suffix from segments. Use with options.prefix when calling get/set.
   * Long segments (> MAX_KEY_SEGMENT) are hashed to keep keys bounded.
   */
  build(...segments: (string | number | undefined | null)[]): string {
    const parts: string[] = [];
    for (const s of segments) {
      if (s === undefined || s === null) continue;
      const str = String(s).trim();
      if (!str) continue;
      if (str.length > MAX_KEY_SEGMENT) {
        parts.push(this.hash(str));
      } else {
        parts.push(str);
      }
    }
    return parts.join(':') || 'default';
  },
};

/**
 * Get tiered TTL for a prefix (seconds).
 */
export function getTieredTtl(prefix: string, override?: number): number {
  if (override != null && override > 0) return override;
  return TIERED_TTL[prefix] ?? CacheTtlConfig.defaultFallback;
}

export interface GetOrSetOptions extends CacheOptions {
  ttl?: number;
}

/**
 * Cache-aside: get from cache, or run fetcher, set, and return.
 */
export async function getOrSet<T>(
  key: string,
  options: GetOrSetOptions,
  fetcher: () => Promise<T>
): Promise<T> {
  const prefix = options.prefix ?? 'cache';
  const ttl = options.ttl ?? getTieredTtl(prefix, options.ttl);
  const opts: CacheOptions = { ...options, prefix, ttl };

  const cached = await RedisCacheService.get<T>(key, opts);
  if (cached != null) return cached;

  const value = await fetcher();
  await RedisCacheService.set(key, value, opts);
  return value;
}

export interface WarmEntry {
  key: string;
  prefix: string;
  fetcher: () => Promise<unknown>;
  ttl?: number;
}

/**
 * Cache warming: run fetchers and populate cache.
 */
export async function warm(entries: WarmEntry[]): Promise<{ warmed: number; failed: number }> {
  let warmed = 0;
  let failed = 0;
  for (const e of entries) {
    try {
      const v = await e.fetcher();
      const ttl = e.ttl ?? getTieredTtl(e.prefix);
      const ok = await RedisCacheService.set(e.key, v, { prefix: e.prefix, ttl });
      if (ok) warmed++; else failed++;
    } catch (err: unknown) {
      failed++;
      logger.warn('Cache warming failed for key', {
        key: e.key,
        prefix: e.prefix,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  logger.info('Cache warming completed', { warmed, failed, total: entries.length });
  return { warmed, failed };
}

/**
 * Touch keys (GET) to promote in Redis LRU / warm local caches.
 * Use when you have a list of known keys to preload.
 */
export async function touchKeys(
  keys: Array<{ key: string; prefix: string }>
): Promise<{ touched: number }> {
  let touched = 0;
  for (const { key, prefix } of keys) {
    try {
      const v = await RedisCacheService.get(key, { prefix });
      if (v != null) touched++;
    } catch {
      // ignore
    }
  }
  return { touched };
}

/**
 * Stale-while-revalidate placeholder.
 * Returns cached value immediately if present; kicks off refresh in background.
 * Caller must run the fetcher when doing the “revalidate” step.
 */
export async function getStaleOrNull<T>(
  key: string,
  options: CacheOptions
): Promise<T | null> {
  return RedisCacheService.get<T>(key, options);
}

/**
 * Run revalidate (fetcher + set) without awaiting higher-level logic.
 * Fire-and-forget; errors are logged.
 */
export function revalidateBackground(
  key: string,
  options: GetOrSetOptions,
  fetcher: () => Promise<unknown>
): void {
  const prefix = options.prefix ?? 'cache';
  const ttl = options.ttl ?? getTieredTtl(prefix);
  fetcher()
    .then((value) => RedisCacheService.set(key, value, { ...options, prefix, ttl }))
    .then((ok) => {
      if (ok) logger.debug('Cache revalidated', { key });
    })
    .catch((err) => {
      logger.warn('Cache revalidate failed', { key, error: err instanceof Error ? err.message : String(err) });
    });
}

export default {
  CacheKeyBuilder,
  getTieredTtl,
  getOrSet,
  warm,
  touchKeys,
  getStaleOrNull,
  revalidateBackground,
};
