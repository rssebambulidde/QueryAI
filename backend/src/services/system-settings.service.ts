/**
 * System Settings Service
 *
 * Provides typed get / set / getAll for the `system_settings` table
 * with an in-memory TTL cache (60 s) to avoid hitting Supabase on
 * every request.
 *
 * All access goes through `supabaseAdmin` (service-role) — the table
 * has RLS enabled with no permissive policies for anon/authenticated.
 */

import logger from '../config/logger';

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  value: unknown;
  expiresAt: number; // epoch ms
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const cache = new Map<string, CacheEntry>();

// ── Service ──────────────────────────────────────────────────────────────────

export class SystemSettingsService {
  /**
   * Get a single setting by key.
   * Returns the parsed JSONB value, or `null` when the key doesn't exist.
   */
  static async get<T = unknown>(key: string): Promise<T | null> {
    // 1. Check cache
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    // 2. Fetch from DB
    const { supabaseAdmin } = await import('../config/database');
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      // PGRST116: row not found  →  return null
      if (error.code === 'PGRST116') return null;
      logger.error('SystemSettingsService.get failed', { key, error: error.message });
      throw error;
    }

    const value = (data?.value ?? null) as T;
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  /**
   * Upsert a setting.  Stores `value` as JSONB and records an audit trail
   * (`updated_by`, `updated_at`).
   */
  static async set(key: string, value: unknown, updatedBy: string): Promise<void> {
    const { supabaseAdmin } = await import('../config/database');
    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert(
        {
          key,
          value,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );

    if (error) {
      logger.error('SystemSettingsService.set failed', { key, error: error.message });
      throw error;
    }

    // Update cache immediately
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    logger.info('System setting updated', { key, updatedBy });
  }

  /**
   * Return every setting as a `{ key: value }` map.
   */
  static async getAll(): Promise<Record<string, unknown>> {
    const { supabaseAdmin } = await import('../config/database');
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('key, value');

    if (error) {
      logger.error('SystemSettingsService.getAll failed', { error: error.message });
      throw error;
    }

    const result: Record<string, unknown> = {};
    for (const row of data ?? []) {
      result[row.key] = row.value;
      cache.set(row.key, { value: row.value, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return result;
  }

  /**
   * Invalidate one or all cache entries.
   */
  static invalidateCache(key?: string): void {
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  }
}
