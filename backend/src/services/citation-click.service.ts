/**
 * Citation Click-Through Analytics Service
 *
 * Records and queries citation click events.
 * Provides domain-level click boost scores consumed by the
 * source-prioritizer during RAG retrieval.
 */

import { supabaseAdmin } from '../config/database';
import { RedisCacheService } from './redis-cache.service';
import logger from '../config/logger';

// ── Types ──────────────────────────────────────────────────────────────

export interface RecordClickParams {
  userId: string;
  conversationId?: string;
  messageId?: string;
  sourceIndex: number;
  sourceUrl?: string;
  sourceType: 'document' | 'web';
}

export interface CitationClickStats {
  totalClicks: number;
  uniqueUsers: number;
  clicksByType: Record<string, number>;
  topDomains: { domain: string; clicks: number; unique_users: number }[];
  avgClicksPerMessage: number;
}

export interface DomainClickRate {
  domain: string;
  totalClicked: number;
  uniqueClickers: number;
}

export interface DomainBoostEntry {
  domain: string;
  clickCount: number;
  boostScore: number; // 0.0-1.0
}

// ── Helpers ────────────────────────────────────────────────────────────

function extractDomain(url?: string): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname || null;
  } catch {
    return null;
  }
}

// ── Service ────────────────────────────────────────────────────────────

const BOOST_CACHE_KEY = 'citation:domain_boosts';
const BOOST_CACHE_TTL = 3600; // 1 hour

export class CitationClickService {
  /**
   * Record a single citation click event.
   */
  static async recordClick(params: RecordClickParams): Promise<string | null> {
    const domain = extractDomain(params.sourceUrl);

    const { data, error } = await supabaseAdmin
      .rpc('record_citation_click', {
        p_user_id: params.userId,
        p_conversation_id: params.conversationId ?? null,
        p_message_id: params.messageId ?? null,
        p_source_index: params.sourceIndex,
        p_source_url: params.sourceUrl ?? null,
        p_source_domain: domain,
        p_source_type: params.sourceType,
      });

    if (error) {
      logger.error('Failed to record citation click', { error: error.message, params });
      return null;
    }

    // Invalidate cached boost scores so next retrieval picks up the new click
    try {
      await RedisCacheService.delete(BOOST_CACHE_KEY);
    } catch {
      // Redis may not be configured — non-critical
    }

    return data as string;
  }

  /**
   * Admin: get citation click stats for the last N days.
   */
  static async getClickStats(days: number = 30): Promise<CitationClickStats> {
    const { data, error } = await supabaseAdmin
      .rpc('get_citation_click_stats', { p_days: days });

    if (error) {
      logger.error('Failed to fetch citation click stats', { error: error.message });
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return {
      totalClicks: Number(row?.total_clicks ?? 0),
      uniqueUsers: Number(row?.unique_users ?? 0),
      clicksByType: (row?.clicks_by_type as Record<string, number>) ?? {},
      topDomains: (row?.top_domains as any[]) ?? [],
      avgClicksPerMessage: Number(row?.avg_clicks_per_msg ?? 0),
    };
  }

  /**
   * Admin: get click-through rates per domain.
   */
  static async getDomainClickRates(days: number = 30): Promise<DomainClickRate[]> {
    const { data, error } = await supabaseAdmin
      .rpc('get_domain_click_through_rates', { p_days: days });

    if (error) {
      logger.error('Failed to fetch domain click rates', { error: error.message });
      throw error;
    }

    return ((data as any[]) ?? []).map((r) => ({
      domain: r.domain,
      totalClicked: Number(r.total_clicked),
      uniqueClickers: Number(r.unique_clickers),
    }));
  }

  /**
   * Get domain-level boost scores for RAG source weighting.
   * Cached in Redis for 1 hour. Returns a Map<domain, boostScore (0-1)>.
   */
  static async getDomainBoostMap(days: number = 90): Promise<Map<string, number>> {
    // Try cache first
    try {
      const cached = await RedisCacheService.get<{ entries: [string, number][] }>(BOOST_CACHE_KEY);
      if (cached) {
        return new Map(cached.entries);
      }
    } catch {
      // Redis not available — compute fresh
    }

    const { data, error } = await supabaseAdmin
      .rpc('get_domain_click_boost_scores', { p_days: days });

    if (error) {
      logger.error('Failed to fetch domain boost scores', { error: error.message });
      return new Map();
    }

    const map = new Map<string, number>();
    for (const row of (data as any[]) ?? []) {
      map.set(row.domain, Number(row.boost_score));
    }

    // Cache
    try {
      await RedisCacheService.set(BOOST_CACHE_KEY, { entries: [...map.entries()] }, { ttl: BOOST_CACHE_TTL });
    } catch {
      // non-critical
    }

    return map;
  }
}
