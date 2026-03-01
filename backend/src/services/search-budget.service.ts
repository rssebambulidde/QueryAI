import logger from '../config/logger';

/**
 * Per-user daily web search budget tracker.
 *
 * Uses an in-memory store (same pattern as tierRateLimiter.middleware.ts).
 * Tracks how many web searches each user has performed today and enforces
 * tier-based daily limits.  When the budget is exhausted the search service
 * should gracefully degrade (skip web search) rather than hard-fail.
 */

interface BudgetEntry {
  count: number;
  /** Epoch ms when this entry expires (start of next UTC day). */
  resetTime: number;
}

const DAILY_SEARCH_LIMITS: Record<string, number> = {
  free: 50,
  pro: 500,
  enterprise: 2000,
};

const budgetStore = new Map<string, BudgetEntry>();

/** Clean up expired entries every 60 s. */
setInterval(() => {
  const now = Date.now();
  const expired: string[] = [];
  budgetStore.forEach((entry, key) => {
    if (entry.resetTime < now) expired.push(key);
  });
  expired.forEach((k) => budgetStore.delete(k));
}, 60_000);

/** Milliseconds until midnight UTC. */
function msUntilMidnightUTC(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.getTime() - now.getTime();
}

export class SearchBudgetService {
  /**
   * Check whether the user still has search budget remaining.
   * Returns `{ allowed: true, remaining }` or `{ allowed: false, remaining: 0 }`.
   */
  static canSearch(userId: string, tier: string = 'free'): { allowed: boolean; remaining: number } {
    const limit = DAILY_SEARCH_LIMITS[tier] ?? DAILY_SEARCH_LIMITS.free;
    const key = `${userId}:${tier}`;
    const now = Date.now();
    let entry = budgetStore.get(key);

    if (!entry || entry.resetTime < now) {
      // New day — reset
      entry = { count: 0, resetTime: now + msUntilMidnightUTC() };
      budgetStore.set(key, entry);
    }

    const remaining = Math.max(0, limit - entry.count);
    return { allowed: entry.count < limit, remaining };
  }

  /**
   * Record N searches consumed by the user.
   */
  static recordSearches(userId: string, tier: string = 'free', count: number = 1): void {
    const key = `${userId}:${tier}`;
    const now = Date.now();
    let entry = budgetStore.get(key);

    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + msUntilMidnightUTC() };
      budgetStore.set(key, entry);
    }

    entry.count += count;

    const limit = DAILY_SEARCH_LIMITS[tier] ?? DAILY_SEARCH_LIMITS.free;
    if (entry.count >= limit) {
      logger.warn('User search budget exhausted', { userId, tier, used: entry.count, limit });
    }
  }

  /** Get current usage stats for a user (informational). */
  static getUsage(userId: string, tier: string = 'free'): { used: number; limit: number; remaining: number } {
    const limit = DAILY_SEARCH_LIMITS[tier] ?? DAILY_SEARCH_LIMITS.free;
    const key = `${userId}:${tier}`;
    const entry = budgetStore.get(key);
    const used = entry && entry.resetTime >= Date.now() ? entry.count : 0;
    return { used, limit, remaining: Math.max(0, limit - used) };
  }
}
