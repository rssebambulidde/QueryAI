/**
 * Query Service (Week 11: Cost Optimization)
 * Query deduplication, batching, and API-call optimization.
 */

import logger from '../config/logger';
import { getOrSet, CacheKeyBuilder, type GetOrSetOptions } from './cache.service';

/** In-flight promise map for deduplication. */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Deduplicate in-flight requests by key.
 * Identical concurrent requests share a single execution; others await the same result.
 */
export async function dedupe<T>(requestKey: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(requestKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fn()
    .finally(() => {
      inflight.delete(requestKey);
    });

  inflight.set(requestKey, promise);
  return promise as Promise<T>;
}

/**
 * Run multiple functions in parallel, optionally deduplicating by key.
 * Use when you have independent async work that may share keys (e.g. same query).
 */
export async function runBatch<T>(
  items: Array<{ key: string; fn: () => Promise<T> }>,
  options?: { dedupe?: boolean }
): Promise<T[]> {
  const useDedupe = options?.dedupe !== false;
  const fns = useDedupe
    ? items.map(({ key, fn }) => () => dedupe(key, fn))
    : items.map(({ fn }) => fn);
  return Promise.all(fns.map((f) => f()));
}

/**
 * Run a cached query: check cache first, then run fetcher and store.
 * Reduces duplicate API calls for repeated queries.
 */
export async function runCached<T>(
  cacheKey: string,
  options: GetOrSetOptions,
  fetcher: () => Promise<T>
): Promise<T> {
  return getOrSet(cacheKey, options, fetcher);
}

/**
 * Build a stable cache key for a query-like request.
 * Use for RAG, search, or LLM cache keys. Prefix goes in options when calling get/set.
 */
export function buildQueryCacheKey(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const parts: (string | number)[] = [];
  const keys = Object.keys(params).sort();
  for (const k of keys) {
    const v = params[k];
    if (v === undefined || v === null) continue;
    parts.push(k, String(v));
  }
  return CacheKeyBuilder.build(...parts);
}

/**
 * Batch window collector for coalescing multiple requests into one.
 * Collects items over a short window, then runs a batch processor.
 */
export interface BatchWindowOptions<T, R> {
  windowMs: number;
  maxBatch: number;
  process: (batch: T[]) => Promise<R[]>;
}

export function createBatchWindow<T, R>(options: BatchWindowOptions<T, R>): {
  add: (item: T) => Promise<R>;
  flush: () => Promise<void>;
} {
  const { windowMs, maxBatch, process: processBatch } = options;
  let queue: Array<{ item: T; resolve: (r: R) => void; reject: (e: unknown) => void }> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing = false;

  function drain(): Promise<void> {
    if (queue.length === 0) return Promise.resolve();
    const batch = queue.splice(0, maxBatch);
    const items = batch.map((b) => b.item);
    stats.batchBatches++;
    stats.batchItems += batch.length;

    const run = processBatch(items)
      .then((results) => {
        if (results.length !== batch.length) {
          const err = new Error('Batch result length mismatch');
          batch.forEach((b) => b.reject(err));
          return;
        }
        batch.forEach((b, i) => b.resolve(results[i]!));
      })
      .catch((err) => {
        batch.forEach((b) => b.reject(err));
      });

    if (!flushing && queue.length > 0) {
      timer = setTimeout(() => {
        timer = null;
        drain();
      }, 0);
    } else if (queue.length === 0) {
      timer = null;
    }
    return run;
  }

  function schedule(): void {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      drain();
    }, windowMs);
  }

  return {
    add(item: T): Promise<R> {
      return new Promise((resolve, reject) => {
        queue.push({ item, resolve, reject });
        if (queue.length >= maxBatch) {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          drain();
        } else {
          schedule();
        }
      });
    },

    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flushing = true;
      try {
        while (queue.length > 0) {
          await drain();
        }
      } finally {
        flushing = false;
      }
    },
  };
}

/**
 * Query service stats for monitoring.
 */
const stats = {
  dedupeHits: 0,
  dedupeMisses: 0,
  cacheHits: 0,
  cacheMisses: 0,
  batchBatches: 0,
  batchItems: 0,
};

export function getQueryServiceStats(): Record<keyof typeof stats, number> {
  return { ...stats };
}

export function resetQueryServiceStats(): void {
  stats.dedupeHits = 0;
  stats.dedupeMisses = 0;
  stats.cacheHits = 0;
  stats.cacheMisses = 0;
  stats.batchBatches = 0;
  stats.batchItems = 0;
}

/**
 * Dedupe wrapper that records stats.
 */
export async function dedupeWithStats<T>(requestKey: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(requestKey);
  if (existing) {
    stats.dedupeHits++;
    return existing as Promise<T>;
  }
  stats.dedupeMisses++;
  return dedupe(requestKey, fn);
}

export default {
  dedupe,
  dedupeWithStats,
  runBatch,
  runCached,
  buildQueryCacheKey,
  createBatchWindow,
  getQueryServiceStats,
  resetQueryServiceStats,
};
