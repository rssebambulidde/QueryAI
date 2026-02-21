/**
 * Answer Evaluator Service
 *
 * LLM-as-judge quality validation.  Calls GPT-4o-mini to rate answers on
 * three dimensions (faithfulness, relevance, citation accuracy) using a
 * structured JSON response.  Results are persisted to `answer_evaluations`.
 *
 * Designed to be called fire-and-forget on a sampled subset (5-10 %) of
 * queries so it has zero impact on user-facing latency.
 */

import { ProviderRegistry } from '../providers/provider-registry';
import logger from '../config/logger';
import { supabaseAdmin } from '../config/database';
import config from '../config/env';
import type { Source } from './ai.service';

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

/** Model used for evaluation — cheap & fast is fine for the judge. */
const EVALUATOR_MODEL = 'gpt-4o-mini';

/** Fraction of queries that get evaluated (0.0 – 1.0). */
const DEFAULT_SAMPLE_RATE = 0.05; // 5 %

/** Max tokens for the evaluation response (structured JSON is small). */
const EVAL_MAX_TOKENS = 512;

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface EvaluationScores {
  faithfulness: number;      // 1-5
  relevance: number;         // 1-5
  citation_accuracy: number; // 1-5
}

export interface EvaluationResult extends EvaluationScores {
  reason: {
    faithfulness: string;
    relevance: string;
    citation_accuracy: string;
  };
}

interface EvaluateAnswerParams {
  question: string;
  answer: string;
  sources?: Source[];
  userId: string;
  conversationId?: string;
  topicId?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════

export class AnswerEvaluatorService {

  // ─── sampling gate ──────────────────────────────────────────────
  /**
   * Returns `true` when this query should be evaluated.
   * Rate is controlled by `ANSWER_EVAL_SAMPLE_RATE` env var (default 5 %).
   */
  static shouldEvaluate(): boolean {
    const rateStr = (config as any).ANSWER_EVAL_SAMPLE_RATE;
    const rate = rateStr ? parseFloat(rateStr) : DEFAULT_SAMPLE_RATE;
    if (rate <= 0) return false;
    if (rate >= 1) return true;
    return Math.random() < rate;
  }

  // ─── public entry point (fire-and-forget) ───────────────────────
  /**
   * Evaluate an answer if the sampling gate passes.
   *
   * Safe to call for every query — returns immediately for unsampled
   * queries.  Catches all errors internally so it never disrupts the
   * caller.
   */
  static async maybeEvaluate(params: EvaluateAnswerParams): Promise<void> {
    try {
      if (!params.userId) return;
      if (!AnswerEvaluatorService.shouldEvaluate()) return;

      const result = await AnswerEvaluatorService.evaluateAnswer(
        params.question,
        params.answer,
        params.sources,
      );

      await AnswerEvaluatorService.storeEvaluation(params, result);

      logger.info('Answer evaluation stored', {
        userId: params.userId,
        faithfulness: result.faithfulness,
        relevance: result.relevance,
        citationAccuracy: result.citation_accuracy,
      });
    } catch (error: any) {
      logger.warn('Answer evaluation failed (non-critical)', {
        error: error.message,
        userId: params.userId,
      });
    }
  }

  // ─── core evaluation ────────────────────────────────────────────
  /**
   * Calls GPT-4o-mini to judge the answer on three dimensions.
   */
  static async evaluateAnswer(
    question: string,
    answer: string,
    sources?: Source[],
  ): Promise<EvaluationResult> {
    const sourceSummary = (sources || [])
      .map((s, i) => {
        const parts = [`[${i + 1}] ${s.title || 'Untitled'}`];
        if (s.url) parts.push(`  URL: ${s.url}`);
        if (s.snippet) parts.push(`  Snippet: ${s.snippet.substring(0, 300)}`);
        return parts.join('\n');
      })
      .join('\n\n');

    const systemPrompt = `You are an expert answer quality evaluator. Given a user question, the system's answer, and the retrieved sources, rate the answer on three dimensions using a 1-5 scale:

1. **Faithfulness** — Does the answer accurately reflect the information in the provided sources? (1 = fabricated / hallucinated, 5 = perfectly grounded)
2. **Relevance** — Does the answer directly address the user's question? (1 = completely off-topic, 5 = precisely answers the question)
3. **Citation Accuracy** — Do inline citations/references in the answer correctly map to the provided sources? If no citations exist, score based on whether sources support the claims. (1 = wrong/missing citations, 5 = every claim properly cited)

Respond ONLY with JSON, no markdown. Schema:
{
  "faithfulness": <1-5>,
  "relevance": <1-5>,
  "citation_accuracy": <1-5>,
  "reason": {
    "faithfulness": "<one sentence>",
    "relevance": "<one sentence>",
    "citation_accuracy": "<one sentence>"
  }
}`;

    const userPrompt = `**Question:**
${question}

**Answer:**
${answer.substring(0, 3000)}

**Sources (${(sources || []).length}):**
${sourceSummary || '(no sources provided)'}`;

    const { provider, model: providerModel } = ProviderRegistry.getForMode('chat');
    const completion = await provider.chatCompletion({
      model: providerModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0,
      maxTokens: EVAL_MAX_TOKENS,
      responseFormat: 'json',
    });

    const raw = completion.content;
    if (!raw) {
      throw new Error('Empty response from evaluation model');
    }

    const parsed = JSON.parse(raw) as EvaluationResult;

    // Clamp scores to 1-5 range
    const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(v)));
    return {
      faithfulness: clamp(parsed.faithfulness),
      relevance: clamp(parsed.relevance),
      citation_accuracy: clamp(parsed.citation_accuracy),
      reason: {
        faithfulness: String(parsed.reason?.faithfulness || ''),
        relevance: String(parsed.reason?.relevance || ''),
        citation_accuracy: String(parsed.reason?.citation_accuracy || ''),
      },
    };
  }

  // ─── persistence ────────────────────────────────────────────────
  private static async storeEvaluation(
    params: EvaluateAnswerParams,
    result: EvaluationResult,
  ): Promise<void> {
    const sourcesSnapshot = (params.sources || []).map(s => ({
      type: s.type,
      title: s.title,
      url: s.url,
      snippet: s.snippet?.substring(0, 500),
    }));

    const { error } = await supabaseAdmin.from('answer_evaluations').insert({
      user_id: params.userId,
      conversation_id: params.conversationId || null,
      topic_id: params.topicId || null,
      question: params.question.substring(0, 2000),
      answer: params.answer.substring(0, 5000),
      sources_snapshot: sourcesSnapshot,
      faithfulness: result.faithfulness,
      relevance: result.relevance,
      citation_accuracy: result.citation_accuracy,
      evaluator_model: EVALUATOR_MODEL,
      evaluation_reason: result.reason,
    });

    if (error) {
      throw new Error(`Failed to store evaluation: ${error.message}`);
    }
  }

  // ─── admin query helpers ────────────────────────────────────────
  /**
   * Fetch aggregate evaluation scores grouped by period.
   * Used by the admin endpoint.
   */
  static async getAggregates(
    days: number = 30,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ) {
    const { data, error } = await supabaseAdmin
      .rpc('get_evaluation_aggregates', {
        p_days: days,
        p_group_by: groupBy,
      });

    if (error) {
      throw new Error(`Failed to fetch evaluation aggregates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Fetch recent individual evaluations (for drill-down).
   */
  static async getRecentEvaluations(limit: number = 50, offset: number = 0) {
    const { data, error } = await supabaseAdmin
      .from('answer_evaluations')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch evaluations: ${error.message}`);
    }

    return data || [];
  }
}
