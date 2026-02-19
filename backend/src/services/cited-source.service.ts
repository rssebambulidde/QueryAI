/**
 * Cited Source Service
 *
 * Cross-conversation citation tracking.
 * Upserts into cited_sources when a message with sources is saved,
 * and provides analytics queries (most-cited, source explorer, per-topic).
 */

import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

// ── Types ──────────────────────────────────────────────────────────────

export interface CitedSource {
  id: string;
  source_url: string | null;
  source_type: 'document' | 'web';
  document_id: string | null;
  source_title: string;
  source_domain: string | null;
  first_cited_at: string;
  last_cited_at: string;
  citation_count: number;
  conversation_count: number;
}

export interface SourceConversation {
  conversation_id: string;
  conversation_title: string | null;
  message_id: string;
  snippet: string | null;
  topic_id: string | null;
  topic_name: string | null;
  cited_at: string;
}

export interface TopicCitedSource {
  id: string;
  source_url: string | null;
  source_type: 'document' | 'web';
  document_id: string | null;
  source_title: string;
  source_domain: string | null;
  topic_citation_count: number;
  total_citation_count: number;
}

export interface UpsertCitedSourceInput {
  userId: string;
  sourceUrl: string | null;
  sourceType: 'document' | 'web';
  documentId: string | null;
  sourceTitle: string;
  conversationId: string;
  messageId: string;
  snippet: string | null;
  topicId: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Extract domain from a URL for grouping. */
function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ── Service ────────────────────────────────────────────────────────────

export class CitedSourceService {
  /**
   * Upsert a single cited source and link it to the conversation/message.
   * Called from MessageService after saving a message with sources.
   */
  static async upsertCitedSource(input: UpsertCitedSourceInput): Promise<string | null> {
    try {
      const domain = extractDomain(input.sourceUrl);
      const { data, error } = await supabaseAdmin.schema('private').rpc('upsert_cited_source', {
        p_user_id: input.userId,
        p_source_url: input.sourceUrl,
        p_source_type: input.sourceType,
        p_document_id: input.documentId,
        p_source_title: input.sourceTitle,
        p_source_domain: domain,
        p_conversation_id: input.conversationId,
        p_message_id: input.messageId,
        p_snippet: input.snippet,
        p_topic_id: input.topicId,
      });

      if (error) {
        logger.warn('Failed to upsert cited source', { error: error.message, input });
        return null;
      }

      return data as string;
    } catch (err) {
      logger.warn('Error upserting cited source', { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Batch-upsert all sources from a saved message.
   * Fire-and-forget safe — errors are logged but never thrown.
   */
  static async trackMessageSources(
    userId: string,
    conversationId: string,
    messageId: string,
    topicId: string | null,
    sources: Array<Record<string, any>>
  ): Promise<void> {
    if (!sources || sources.length === 0) return;

    const promises = sources.map((src) => {
      const snippet = src.snippet
        ? (src.snippet as string).slice(0, 300)
        : null;

      return this.upsertCitedSource({
        userId,
        sourceUrl: src.url || null,
        sourceType: (src.type as 'document' | 'web') || 'web',
        documentId: src.documentId || null,
        sourceTitle: src.title || '',
        conversationId,
        messageId,
        snippet,
        topicId,
      });
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get a user's most-cited sources, with optional topic + date filters.
   */
  static async getUserCitedSources(
    userId: string,
    options?: {
      topicId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<CitedSource[]> {
    const { topicId, startDate, endDate, limit = 50, offset = 0 } = options || {};

    const { data, error } = await supabaseAdmin.schema('private').rpc('get_user_cited_sources', {
      p_user_id: userId,
      p_topic_id: topicId || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: Math.min(limit, 100),
      p_offset: offset,
    });

    if (error) {
      logger.error('Error fetching cited sources', { error: error.message, userId });
      return [];
    }

    return (data || []) as CitedSource[];
  }

  /**
   * Get all conversations where a specific source was cited (source explorer).
   */
  static async getSourceConversations(
    userId: string,
    citedSourceId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<SourceConversation[]> {
    const { limit = 50, offset = 0 } = options || {};

    const { data, error } = await supabaseAdmin.schema('private').rpc('get_source_conversations', {
      p_user_id: userId,
      p_cited_source_id: citedSourceId,
      p_limit: Math.min(limit, 100),
      p_offset: offset,
    });

    if (error) {
      logger.error('Error fetching source conversations', { error: error.message, userId, citedSourceId });
      return [];
    }

    return (data || []) as SourceConversation[];
  }

  /**
   * Get the most-cited sources for a specific topic.
   */
  static async getTopicCitedSources(
    userId: string,
    topicId: string,
    limit: number = 20
  ): Promise<TopicCitedSource[]> {
    const { data, error } = await supabaseAdmin.schema('private').rpc('get_topic_cited_sources', {
      p_user_id: userId,
      p_topic_id: topicId,
      p_limit: Math.min(limit, 50),
    });

    if (error) {
      logger.error('Error fetching topic cited sources', { error: error.message, userId, topicId });
      return [];
    }

    return (data || []) as TopicCitedSource[];
  }
}
