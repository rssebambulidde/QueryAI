/**
 * Feedback Service
 *
 * Manages user feedback on AI-generated messages: thumbs-up / thumbs-down
 * ratings, optional free-text comments, and flagged citations.
 *
 * Negative feedback automatically triggers LLM-as-judge evaluation
 * (bypassing the sampling gate) to build a quality signal.
 */

import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface FlaggedCitation {
  sourceUrl: string;
  sourceTitle: string;
  reason?: string;
}

export interface SubmitFeedbackParams {
  userId: string;
  messageId: string;
  conversationId?: string;
  rating: -1 | 1;
  comment?: string;
  flaggedCitations?: FlaggedCitation[];
  model?: string;
  /** Context needed for routing negative feedback to the evaluator */
  question?: string;
  answer?: string;
  sources?: Array<{ type?: string; title?: string; url?: string; snippet?: string }>;
}

export interface MessageFeedback {
  id: string;
  user_id: string;
  message_id: string;
  conversation_id: string | null;
  rating: -1 | 1;
  comment: string | null;
  flagged_citations: FlaggedCitation[];
  model: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════

export class FeedbackService {

  // ─── submit / update feedback ───────────────────────────────────
  /**
   * Create or update feedback for a specific message.
   * Uses the private.upsert_message_feedback RPC for atomic upsert.
   *
   * When rating is negative (-1), fires off an LLM-as-judge evaluation
   * in the background (bypasses sampling gate).
   */
  static async submitFeedback(params: SubmitFeedbackParams): Promise<string> {
    const { data, error } = await supabaseAdmin
      .rpc('upsert_message_feedback', {
        p_user_id: params.userId,
        p_message_id: params.messageId,
        p_conversation_id: params.conversationId || null,
        p_rating: params.rating,
        p_comment: params.comment || null,
        p_flagged_citations: JSON.stringify(params.flaggedCitations || []),
        p_model: params.model || null,
      });

    if (error) {
      throw new Error(`Failed to submit feedback: ${error.message}`);
    }

    const feedbackId = data as unknown as string;

    // Route negative feedback to LLM-as-judge (fire-and-forget)
    if (params.rating === -1 && params.question && params.answer) {
      FeedbackService.routeToEvaluator(params).catch((err) => {
        logger.warn('Failed to route negative feedback to evaluator', {
          error: err.message,
          messageId: params.messageId,
        });
      });
    }

    logger.info('Feedback submitted', {
      feedbackId,
      userId: params.userId,
      messageId: params.messageId,
      rating: params.rating,
      hasFlaggedCitations: (params.flaggedCitations?.length || 0) > 0,
    });

    return feedbackId;
  }

  // ─── route negative feedback to evaluator ───────────────────────
  /**
   * Directly calls the answer evaluator, bypassing the sampling gate.
   * Only called for negative feedback so we always get quality data
   * on answers users disliked.
   */
  private static async routeToEvaluator(params: SubmitFeedbackParams): Promise<void> {
    const { AnswerEvaluatorService } = await import('./answer-evaluator.service');

    const result = await AnswerEvaluatorService.evaluateAnswer(
      params.question!,
      params.answer!,
      params.sources as any,
    );

    // Store using the evaluator's persistence (re-uses answer_evaluations table)
    const { error } = await supabaseAdmin.from('answer_evaluations').insert({
      user_id: params.userId,
      conversation_id: params.conversationId || null,
      question: (params.question || '').substring(0, 2000),
      answer: (params.answer || '').substring(0, 5000),
      sources_snapshot: (params.sources || []).map(s => ({
        type: s.type,
        title: s.title,
        url: s.url,
        snippet: s.snippet?.substring(0, 500),
      })),
      faithfulness: result.faithfulness,
      relevance: result.relevance,
      citation_accuracy: result.citation_accuracy,
      evaluator_model: 'gpt-4o-mini',
      evaluation_reason: result.reason,
      triggered_by: 'negative_feedback',
    });

    if (error) {
      throw new Error(`Failed to store evaluation from feedback: ${error.message}`);
    }

    logger.info('Negative feedback routed to evaluator', {
      userId: params.userId,
      messageId: params.messageId,
      faithfulness: result.faithfulness,
      relevance: result.relevance,
      citationAccuracy: result.citation_accuracy,
    });
  }

  // ─── get user's feedback for a message ──────────────────────────
  /**
   * Returns the current user's feedback for a specific message,
   * or null if none exists.
   */
  static async getUserFeedback(
    userId: string,
    messageId: string,
  ): Promise<MessageFeedback | null> {
    const { data, error } = await supabaseAdmin
      .from('message_feedback')
      .select('*')
      .eq('user_id', userId)
      .eq('message_id', messageId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch feedback: ${error.message}`);
    }

    return data as MessageFeedback | null;
  }

  // ─── delete feedback ────────────────────────────────────────────
  /**
   * Remove the user's feedback for a given message.
   */
  static async deleteFeedback(userId: string, messageId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('message_feedback')
      .delete()
      .eq('user_id', userId)
      .eq('message_id', messageId);

    if (error) {
      throw new Error(`Failed to delete feedback: ${error.message}`);
    }
  }

  // ─── admin: feedback analytics ──────────────────────────────────
  /**
   * Aggregate feedback grouped by time period.
   */
  static async getAnalytics(
    days: number = 30,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    const { data, error } = await supabaseAdmin
      .rpc('get_feedback_analytics', {
        p_days: days,
        p_group_by: groupBy,
      });

    if (error) {
      throw new Error(`Failed to fetch feedback analytics: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Feedback breakdown per AI model.
   */
  static async getByModel(days: number = 30) {
    const { data, error } = await supabaseAdmin
      .rpc('get_feedback_by_model', {
        p_days: days,
      });

    if (error) {
      throw new Error(`Failed to fetch feedback by model: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Recent feedback entries that have flagged citations.
   * Used by admins to review problematic citations.
   */
  static async getRecentFlagged(limit: number = 50, offset: number = 0) {
    const { data, error } = await supabaseAdmin
      .from('message_feedback')
      .select('*')
      .not('flagged_citations', 'eq', '[]')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch flagged feedback: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Recent feedback (all, for admin review).
   */
  static async getRecent(limit: number = 50, offset: number = 0) {
    const { data, error } = await supabaseAdmin
      .from('message_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch recent feedback: ${error.message}`);
    }

    return data || [];
  }
}
