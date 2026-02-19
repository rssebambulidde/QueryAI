/**
 * Query Decomposer Service
 *
 * Detects complex multi-part questions and decomposes them into 2–3
 * focused sub-questions using a lightweight LLM call.  Used by
 * RetrievalOrchestratorService to implement multi-hop retrieval:
 * each sub-question is retrieved independently, and results are
 * merged/deduped before being passed to the main LLM.
 *
 * Design decisions:
 *  - Uses gpt-4o-mini (cheap, fast) with structured JSON output
 *  - Caps at 3 sub-questions to control latency & cost
 *  - Falls back to single-hop when decomposition fails or produces
 *    empty sub-questions
 *  - Reuses existing isComplexQuery / analyzeQueryComplexity signals
 *    from ContextSelectorService for the "should decompose?" gate
 */

import { openai } from '../config/openai';
import { ContextSelectorService } from './context-selector.service';
import logger from '../config/logger';

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

/** Model for decomposition — cheap & fast. */
const DECOMPOSER_MODEL = 'gpt-4o-mini';

/** Maximum sub-questions to generate. */
const MAX_SUB_QUESTIONS = 3;

/** Max tokens for the decomposition response. */
const DECOMPOSER_MAX_TOKENS = 256;

/**
 * Additional regex patterns that strongly signal multi-part / comparative
 * questions beyond what ContextSelectorService.isComplexQuery checks.
 */
const MULTI_PART_PATTERNS = [
  // Explicit comparisons
  /\b(?:compare|contrast|difference|versus|vs\.?)\b/i,
  // Multiple entities joined by "and" / "or"
  /\b(?:and|or)\b.*\b(?:and|or)\b/i,
  // Numbered sub-parts
  /\b(?:first|second|third|1\)|2\)|3\))/i,
  // Temporal comparisons
  /\b(?:before|after|since|between)\b.*\b(?:and|to)\b/i,
  // Multi-aspect questions
  /\b(?:both|each|respectively|as well as)\b/i,
  // Explicit multi-question markers
  /\?.*\?/,
];

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface DecompositionResult {
  /** Whether the original query was decomposed. */
  decomposed: boolean;
  /** The sub-questions (length 2–3 when decomposed, length 1 otherwise). */
  subQuestions: string[];
  /** Reason the query was / was not decomposed. */
  reason: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════

export class QueryDecomposerService {

  // ─── Detection gate ─────────────────────────────────────────────
  /**
   * Returns true when the query is a good candidate for decomposition.
   *
   * Uses two signals:
   *  1. ContextSelectorService.isComplexQuery (complexity > 0.6)
   *  2. Multi-part / comparative regex patterns
   *
   * Both must be true to avoid decomposing queries that are complex
   * but single-faceted (e.g. "Explain quantum entanglement in detail").
   */
  static shouldDecompose(query: string): boolean {
    // Must pass the complexity gate
    if (!ContextSelectorService.isComplexQuery(query)) {
      return false;
    }

    // Must also match at least one multi-part pattern
    return MULTI_PART_PATTERNS.some(pattern => pattern.test(query));
  }

  // ─── LLM decomposition ─────────────────────────────────────────
  /**
   * Decompose a complex query into 2–3 focused sub-questions.
   *
   * Returns a DecompositionResult.  On any error or poor result the
   * `decomposed` flag is false and `subQuestions` contains only the
   * original query (safe single-hop fallback).
   */
  static async decompose(query: string): Promise<DecompositionResult> {
    try {
      const completion = await openai.chat.completions.create({
        model: DECOMPOSER_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a search query decomposer. Given a complex multi-part question, break it into 2-3 focused, self-contained sub-questions that together cover everything the user is asking.

Rules:
- Each sub-question must be a complete, standalone question that a search engine can answer independently.
- Output exactly 2 or 3 sub-questions (never 1, never more than 3).
- Preserve specific names, dates, and entities from the original question.
- If the question is actually simple and cannot be meaningfully decomposed, set "decomposable" to false.

Respond ONLY with JSON (no markdown). Schema:
{
  "decomposable": true/false,
  "sub_questions": ["...", "..."]
}`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0,
        max_tokens: DECOMPOSER_MAX_TOKENS,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content;
      if (!raw) {
        return this.fallback(query, 'empty LLM response');
      }

      const parsed = JSON.parse(raw) as {
        decomposable: boolean;
        sub_questions: string[];
      };

      if (!parsed.decomposable || !Array.isArray(parsed.sub_questions) || parsed.sub_questions.length < 2) {
        return this.fallback(query, 'LLM deemed not decomposable');
      }

      // Enforce cap and filter empties
      const subQuestions = parsed.sub_questions
        .map(q => q.trim())
        .filter(q => q.length > 0)
        .slice(0, MAX_SUB_QUESTIONS);

      if (subQuestions.length < 2) {
        return this.fallback(query, 'fewer than 2 valid sub-questions after filtering');
      }

      logger.info('Query decomposed into sub-questions', {
        originalQuery: query.substring(0, 150),
        subQuestionCount: subQuestions.length,
        subQuestions: subQuestions.map(q => q.substring(0, 100)),
      });

      return {
        decomposed: true,
        subQuestions,
        reason: `decomposed into ${subQuestions.length} sub-questions`,
      };
    } catch (error: any) {
      logger.warn('Query decomposition failed, falling back to single-hop', {
        query: query.substring(0, 150),
        error: error.message,
      });
      return this.fallback(query, `error: ${error.message}`);
    }
  }

  // ─── Fallback helper ────────────────────────────────────────────
  private static fallback(query: string, reason: string): DecompositionResult {
    return {
      decomposed: false,
      subQuestions: [query],
      reason,
    };
  }
}
