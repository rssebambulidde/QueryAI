/**
 * AI Answer Pipeline Service
 *
 * Contains the core answer-generation logic for both streaming and
 * non-streaming paths:
 *   - answerQuestionInternal   (non-streaming: RAG → LLM → citations → quality → save)
 *   - answerQuestionStreamInternal (streaming: RAG → LLM stream → yield chunks)
 *   - postProcessStream        (post-stream: follow-ups, quality, save, usage log)
 *
 * Also houses the helper methods these pipelines depend on:
 *   - Model selection (tier-based)
 *   - Query complexity detection
 *   - Off-topic pre-check internal
 *   - LLM response caching
 *
 * Extracted from ai.service.ts so the coordinator stays under 500 lines
 * while preserving the exact same behaviour.
 */

import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import OpenAI from 'openai'; // Kept for OpenAI.APIError instanceof checks
import { ProviderRegistry } from '../providers/provider-registry';
import type { LLMProvider, ChatMessage, ChatCompletionResult } from '../providers/llm-provider.interface';
import { SearchService, SearchRequest } from './search.service';
import { RAGService, RAGOptions } from './rag.service';
import { FewShotSelectorService, FewShotSelectionOptions } from './few-shot-selector.service';
import { RetryService } from './retry.service';
import { DegradationService, ServiceType, DegradationLevel } from './degradation.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import { ErrorTrackerService, ServiceType as ErrorServiceType } from './error-tracker.service';
import { QualityMetricsService } from './quality-metrics.service';
import { RedisCacheService } from './redis-cache.service';
import { CostTrackingService } from './cost-tracking.service';
import { SubscriptionService } from './subscription.service';
import { PromptBuilderService } from './prompt-builder.service';
import { ResponseProcessorService } from './response-processor.service';
import { AIResponseSchema, type AIStructuredResponse } from '../schemas/ai-response.schema';
import { JsonAnswerStreamParser } from '../utils/json-stream-parser';
import crypto from 'crypto';

import type { QuestionRequest, QuestionResponse, Source } from './ai.service';

// ═══════════════════════════════════════════════════════════════════════
// Off-Topic Pre-Check Cache
// ═══════════════════════════════════════════════════════════════════════

const OFF_TOPIC_CACHE_TTL = 300; // 5 minutes
const OFF_TOPIC_CACHE_PREFIX = 'off-topic-check';

interface OffTopicCacheStats {
  hits: number;
  misses: number;
}

let offTopicCacheStats: OffTopicCacheStats = {
  hits: 0,
  misses: 0,
};

function generateOffTopicCacheKey(
  question: string,
  topicId: string
): string {
  return crypto.createHash('sha256')
    .update(question.toLowerCase().trim() + '|' + topicId)
    .digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════
// LLM Response Cache
// ═══════════════════════════════════════════════════════════════════════

const LLM_CACHE_TTL = 3600;
const LLM_CACHE_PREFIX = 'llm';

export interface LLMCacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
}

export interface PreparedContext {
  ragContext: string | undefined;
  sources: Source[] | undefined;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
  selectedModel: string;
  modelSelectionReason: string;
  /** The resolved LLM provider instance that matches selectedModel. */
  provider: LLMProvider;
  messages: ChatMessage[];
  topicName: string | undefined;
  topicDescription: string | undefined;
  topicScopeConfig: Record<string, any> | null | undefined;
  timeFilter: { timeRange?: string; startDate?: string; endDate?: string; topic?: string; country?: string } | undefined;
  temperature: number;
  maxTokens: number;
  contextDegraded: boolean;
  contextDegradationLevel: DegradationLevel | undefined;
  contextDegradationMessage: string | undefined;
  contextPartial: boolean;
  /** Extracted text from user-attached documents (used for prompt hierarchy in deep search). */
  attachmentDocumentContext?: string;
  /** Per-file extraction status for SSE feedback to the frontend. */
  extractionStatuses?: Array<{ name: string; status: 'success' | 'truncated' | 'failed'; chars: number; reason?: string }>;
}

export interface PostProcessStreamParams {
  fullAnswer: string;
  question: string;
  userId: string;
  sources?: Source[];
  topicName?: string;
  topicId?: string;
  conversationId?: string;
  model?: string;
  isResend?: boolean;
  structuredFollowUps?: string[];
  /** Structured cited-source objects emitted by the LLM (used for citation badge). */
  structuredCitedSources?: any[];
  /** Original RAG settings so regeneration can replay the same retrieval config */
  ragSettings?: Record<string, any>;
}

export interface PostProcessStreamResult {
  followUpQuestions?: string[];
  qualityScore?: number;
  /** Final answer text (may be trimmed of follow-up markdown by ResponseProcessor) */
  cleanedAnswer: string;
  conversationId?: string;
}

let llmCacheStats: LLMCacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  errors: 0,
};

function generateLLMCacheKey(
  question: string,
  model: string,
  temperature: number,
  ragContext?: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  topicId?: string
): string {
  const questionHash = crypto.createHash('sha256')
    .update(question.trim().toLowerCase())
    .digest('hex')
    .substring(0, 16);

  const contextHash = ragContext
    ? crypto.createHash('sha256')
        .update(ragContext)
        .digest('hex')
        .substring(0, 8)
    : 'no-context';

  const historyHash = conversationHistory && conversationHistory.length > 0
    ? crypto.createHash('sha256')
        .update(JSON.stringify(conversationHistory.slice(-5)))
        .digest('hex')
        .substring(0, 8)
    : 'no-history';

  const topic = topicId ?? 'no-topic';

  return `${questionHash}|${model}|${temperature}|${contextHash}|${historyHash}|${topic}`;
}

// ═══════════════════════════════════════════════════════════════════════
// AIAnswerPipelineService
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// Complexity-Based Model Selection — Thresholds & Types
//
// Strategy: deterministic, three-tier complexity scoring.
//   LOW       → gpt-3.5-turbo          (fast, cheap — simple Q&A)
//   MEDIUM    → gpt-4o-mini             (balanced — multi-part or moderate-context queries)
//   HIGH      → gpt-4o-mini             (same model, higher token budget — synthesis / long sessions)
//
// Scoring signals (each contributes points; thresholds below):
//   • Regex pattern indicators (comparison, analysis, multi-step, math/logic)
//   • Question word count (multi-part heuristic)
//   • Question character length
//   • RAG context length (dense info requiring synthesis)
//   • Conversation history length (session coherence)
//
// The exact thresholds are defined as named constants so they can be
// tuned in one place without touching scoring or selection logic.
// ═══════════════════════════════════════════════════════════════════════

/** Complexity tier returned by `assessComplexity()`. */
export type ComplexityTier = 'low' | 'medium' | 'high';

export interface ComplexityAssessment {
  tier: ComplexityTier;
  score: number;
  signals: string[];  // human-readable list of signals that fired
}

// ── Scoring weights ────────────────────────────────────────────────────

/** Points awarded when ≥ 1 regex complexity-indicator matches the question. */
const COMPLEXITY_WEIGHT_PATTERN_MATCH = 2;

/** Points awarded when the question contains math / formal-logic language. */
const COMPLEXITY_WEIGHT_MATH_LOGIC = 2;

/** Points awarded when question word count exceeds QUESTION_WORD_COUNT_THRESHOLD. */
const COMPLEXITY_WEIGHT_LONG_QUESTION_WORDS = 1;

/** Points awarded when question character length exceeds QUESTION_CHAR_LENGTH_THRESHOLD. */
const COMPLEXITY_WEIGHT_LONG_QUESTION_CHARS = 1;

/** Points awarded when RAG context length exceeds RAG_CONTEXT_LENGTH_THRESHOLD. */
const COMPLEXITY_WEIGHT_DENSE_CONTEXT = 1;

/** Points awarded when conversation history length exceeds HISTORY_LENGTH_THRESHOLD. */
const COMPLEXITY_WEIGHT_LONG_HISTORY = 1;

/** Points awarded when the question contains comparison / conditional language. */
const COMPLEXITY_WEIGHT_COMPARISON = 1;

// ── Signal thresholds ──────────────────────────────────────────────────

/** Word count above which a question is considered "multi-part". */
const QUESTION_WORD_COUNT_THRESHOLD = 30;

/** Character length above which a question earns the "long question" signal. */
const QUESTION_CHAR_LENGTH_THRESHOLD = 200;

/** RAG context character length above which the query is "dense context". */
const RAG_CONTEXT_LENGTH_THRESHOLD = 4000;

/** Conversation-history turn count above which the session is "long". */
const HISTORY_LENGTH_THRESHOLD = 10;

// ── Tier boundaries (inclusive lower bound) ────────────────────────────

/** Minimum score for MEDIUM complexity (below → LOW). */
const MEDIUM_COMPLEXITY_THRESHOLD = 2;

/** Minimum score for HIGH complexity (below → MEDIUM). */
const HIGH_COMPLEXITY_THRESHOLD = 5;

export class AIAnswerPipelineService {
  // Model configuration
  private static readonly DEFAULT_MODEL = 'gpt-3.5-turbo';
  private static readonly DEFAULT_TEMPERATURE = 0.7;
  private static readonly DEFAULT_MAX_TOKENS = 1800;
  /** Best-quality model for complex / medium queries (pro tier). */
  private static readonly GPT4_MODEL = 'gpt-4o-mini';
  /** Default cost-effective model. */
  private static readonly GPT35_MODEL = 'gpt-3.5-turbo';

  // ═════════════════════════════════════════════════════════════════════
  // LLM Cache Stats
  // ═════════════════════════════════════════════════════════════════════

  static getLLMCacheStats(): LLMCacheStats & { hitRate: number } {
    const total = llmCacheStats.hits + llmCacheStats.misses;
    const hitRate = total > 0
      ? (llmCacheStats.hits / total) * 100
      : 0;

    return {
      ...llmCacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  static resetLLMCacheStats(): void {
    llmCacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Off-Topic Cache Stats
  // ═════════════════════════════════════════════════════════════════════

  static getOffTopicCacheStats(): OffTopicCacheStats & { hitRate: number } {
    const total = offTopicCacheStats.hits + offTopicCacheStats.misses;
    const hitRate = total > 0
      ? (offTopicCacheStats.hits / total) * 100
      : 0;

    return {
      ...offTopicCacheStats,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  static resetOffTopicCacheStats(): void {
    offTopicCacheStats = {
      hits: 0,
      misses: 0,
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Helper methods
  // ═════════════════════════════════════════════════════════════════════

  static async runOffTopicPreCheckInternal(
    question: string,
    topicName: string,
    topicDescription?: string,
    topicScopeConfig?: Record<string, any> | null,
    topicId?: string
  ): Promise<boolean> {
    // ── Cache lookup ──────────────────────────────────────────────────
    const cacheKey = topicId
      ? generateOffTopicCacheKey(question, topicId)
      : null;

    if (cacheKey) {
      const cached = await RedisCacheService.get<boolean>(cacheKey, {
        prefix: OFF_TOPIC_CACHE_PREFIX,
        ttl: OFF_TOPIC_CACHE_TTL,
      });

      if (cached !== null) {
        offTopicCacheStats.hits++;
        logger.debug('Off-topic pre-check cache hit', {
          question: question.substring(0, 80),
          topicId,
          result: cached,
        });
        return cached;
      }
      offTopicCacheStats.misses++;
    }

    // ── LLM call (cache miss) ────────────────────────────────────────
    const scopeLine = PromptBuilderService.deriveScopeFromConfig(topicScopeConfig);
    const desc = topicDescription || 'general';
    const prompt = `Topic: ${topicName}. Description: ${desc}.${scopeLine}

Question: ${question}

Is this question clearly within the topic? Answer only YES or NO.`;
    try {
      const retryResult = await RetryService.execute(
        async () => {
          const { provider, model } = ProviderRegistry.getForMode('chat');
          return await provider.chatCompletion({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            maxTokens: 10,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 500,
          multiplier: 2,
          maxDelay: 5000,
        }
      );

      const completion = retryResult.result;
      const text = (completion.content || '').trim().toUpperCase();
      const onTopic = !/^NO\b/.test(text);

      // Store result in cache
      if (cacheKey) {
        await RedisCacheService.set(cacheKey, onTopic, {
          prefix: OFF_TOPIC_CACHE_PREFIX,
          ttl: OFF_TOPIC_CACHE_TTL,
        });
      }

      return onTopic;
    } catch (err: any) {
      logger.warn('Off-topic pre-check failed, proceeding with full flow', { error: err?.message });
      return true;
    }
  }

  /**
   * Assess query complexity and return a deterministic tier.
   *
   * Scoring signals (cumulative):
   *   +2  regex pattern indicators (analysis, comparison, multi-step, etc.)
   *   +2  math / formal-logic language
   *   +1  question word count > QUESTION_WORD_COUNT_THRESHOLD (30)
   *   +1  question char length > QUESTION_CHAR_LENGTH_THRESHOLD (200)
   *   +1  RAG context length > RAG_CONTEXT_LENGTH_THRESHOLD (4 000 chars)
   *   +1  conversation history > HISTORY_LENGTH_THRESHOLD (10 turns)
   *   +1  comparison / conditional language
   *
   * Tier boundaries:
   *   score < MEDIUM_COMPLEXITY_THRESHOLD (2) → LOW
   *   score < HIGH_COMPLEXITY_THRESHOLD   (5) → MEDIUM
   *   score ≥ HIGH_COMPLEXITY_THRESHOLD   (5) → HIGH
   */
  static assessComplexity(
    question: string,
    ragContext?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): ComplexityAssessment {
    let score = 0;
    const signals: string[] = [];

    // ── 1. Regex complexity-indicator patterns ─────────────────────────
    const complexIndicators = [
      /\?.*\?/,
      /(?:and|or|also|additionally|furthermore|moreover).*\?/i,
      /(?:analyze|analysis|evaluate|examine|assess|critique)/i,
      /(?:pros?|cons?|advantages?|disadvantages?|benefits?|drawbacks?)/i,
      /(?:algorithm|implementation|architecture|design|methodology|framework)/i,
      /(?:optimize|optimization|performance|efficiency|scalability)/i,
      /(?:debug|troubleshoot|diagnose|fix|resolve|error|issue|problem)/i,
      /(?:step|steps|process|procedure|workflow|pipeline)/i,
      /(?:how to|how do|how does|how can|how would|how should)/i,
      /(?:explain.*step|walk.*through|guide|tutorial)/i,
      /(?:summarize|summary|overview|review|synthesis|synthesize)/i,
      /(?:all|every|entire|complete|full|comprehensive)/i,
    ];
    if (complexIndicators.some(p => p.test(question))) {
      score += COMPLEXITY_WEIGHT_PATTERN_MATCH;
      signals.push('pattern-match');
    }

    // ── 2. Math / formal-logic language ────────────────────────────────
    if (/(?:calculate|solve|equation|formula|theorem|proof|logic|reasoning)/i.test(question)) {
      score += COMPLEXITY_WEIGHT_MATH_LOGIC;
      signals.push('math-logic');
    }

    // ── 3. Comparison / conditional language ───────────────────────────
    if (/(?:compare|contrast|difference|similarity|versus|vs\.?|if.*then|when.*would|relationship|correlation|impact|effect)/i.test(question)) {
      score += COMPLEXITY_WEIGHT_COMPARISON;
      signals.push('comparison-conditional');
    }

    // ── 4. Question word count > 30 (likely multi-part) ────────────────
    const wordCount = question.trim().split(/\s+/).length;
    if (wordCount > QUESTION_WORD_COUNT_THRESHOLD) {
      score += COMPLEXITY_WEIGHT_LONG_QUESTION_WORDS;
      signals.push(`word-count(${wordCount})`);
    }

    // ── 5. Question character length > 200 ─────────────────────────────
    if (question.length > QUESTION_CHAR_LENGTH_THRESHOLD) {
      score += COMPLEXITY_WEIGHT_LONG_QUESTION_CHARS;
      signals.push(`char-length(${question.length})`);
    }

    // ── 6. RAG context > 4 000 chars (dense information) ───────────────
    if (ragContext && ragContext.length > RAG_CONTEXT_LENGTH_THRESHOLD) {
      score += COMPLEXITY_WEIGHT_DENSE_CONTEXT;
      signals.push(`dense-context(${ragContext.length})`);
    }

    // ── 7. Conversation history > 10 turns ─────────────────────────────
    if (conversationHistory && conversationHistory.length > HISTORY_LENGTH_THRESHOLD) {
      score += COMPLEXITY_WEIGHT_LONG_HISTORY;
      signals.push(`long-history(${conversationHistory.length})`);
    }

    // ── Determine tier ─────────────────────────────────────────────────
    let tier: ComplexityTier;
    if (score >= HIGH_COMPLEXITY_THRESHOLD) {
      tier = 'high';
    } else if (score >= MEDIUM_COMPLEXITY_THRESHOLD) {
      tier = 'medium';
    } else {
      tier = 'low';
    }

    return { tier, score, signals };
  }

  /**
   * Legacy convenience wrapper — returns true when complexity is HIGH.
   * Kept for backward-compat with callers that only need a boolean.
   */
  static isComplexQuery(
    question: string,
    ragContext?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): boolean {
    return this.assessComplexity(question, ragContext, conversationHistory).tier === 'high';
  }

  static async selectModel(
    userId: string | undefined,
    question: string,
    ragContext?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    requestedModel?: string,
    mode: 'chat' | 'research' = 'chat'
  ): Promise<{ model: string; provider: LLMProvider; reason: string }> {
    if (requestedModel) {
      // If a specific model was requested, find the provider that owns it
      const providers = ProviderRegistry.listProviders();
      for (const p of providers) {
        if (!p.configured) continue;
        const hasModel = p.models.some((m) => m.id === requestedModel);
        if (hasModel) {
          const provider = ProviderRegistry.getProvider(p.id)!;
          return { model: requestedModel, provider, reason: 'user-requested' };
        }
      }
      // Requested model not found in any provider — fall through to default
      logger.warn('Requested model not found in any provider, using default', { requestedModel });
    }

    // Use the admin-configured provider+model for the given mode
    const { provider, model } = ProviderRegistry.getForMode(mode);
    return { model, provider, reason: `registry-${mode}` };
  }

  static buildMessages(
    question: string,
    ragContext?: string,
    additionalContext?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    enableDocumentSearch?: boolean,
    enableWebSearch?: boolean,
    timeFilter?: { timeRange?: string; startDate?: string; endDate?: string; topic?: string; country?: string },
    topicName?: string,
    topicDescription?: string,
    topicScopeConfig?: Record<string, any> | null,
    fewShotExamples?: string,
    conversationState?: string,
    imageAttachments?: Array<{ name: string; mimeType: string; data: string }>,
    attachmentDocumentContext?: string,
  ): ChatMessage[] {
    return PromptBuilderService.buildMessages(
      question,
      ragContext,
      additionalContext,
      conversationHistory,
      enableDocumentSearch,
      enableWebSearch,
      timeFilter,
      topicName,
      topicDescription,
      topicScopeConfig,
      fewShotExamples,
      conversationState,
      imageAttachments,
      attachmentDocumentContext,
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // Shared: fetch topic details
  // ═════════════════════════════════════════════════════════════════════

  static async fetchTopicDetails(
    topicId: string,
    userId: string
  ): Promise<{ topicName: string; topicDescription?: string; topicScopeConfig?: Record<string, any> | null } | null> {
    try {
      const { TopicService } = await import('./topic.service');
      const topic = await TopicService.getTopic(topicId, userId);
      if (topic) {
        return {
          topicName: topic.name,
          topicDescription: topic.description ?? undefined,
          topicScopeConfig: topic.scope_config ?? null,
        };
      }
    } catch (topicError: any) {
      logger.warn('Failed to fetch topic details', {
        topicId,
        error: topicError.message,
      });
    }
    return null;
  }

  // ═════════════════════════════════════════════════════════════════════
  // Shared: prepare request context (RAG, history, model, messages)
  // ═════════════════════════════════════════════════════════════════════

  static async prepareRequestContext(
    request: QuestionRequest,
    userId?: string,
    preloadedTopic?: {
      topicName?: string;
      topicDescription?: string;
      topicScopeConfig?: Record<string, any> | null;
    }
  ): Promise<PreparedContext> {
    const temperature = request.temperature ?? this.DEFAULT_TEMPERATURE;
    const maxTokens = request.maxTokens ?? this.DEFAULT_MAX_TOKENS;

    // ── Chat mode: skip RAG, use simple conversational prompt ───────
    if (request.mode === 'chat') {
      // Model selection still applies
      const modelSelection = await this.selectModel(userId, request.question, undefined, request.conversationHistory, request.model, 'chat');
      const selectedModel = modelSelection.model;
      const selectedProvider = modelSelection.provider;
      const modelSelectionReason = modelSelection.reason;

      // Load conversation history
      let conversationHistory = request.conversationHistory;
      if (request.conversationId && userId && (!conversationHistory || conversationHistory.length === 0)) {
        try {
          const { MessageService } = await import('./message.service');
          const dbMessages = await MessageService.getAllMessages(request.conversationId, userId, { unlimited: true });
          if (dbMessages.length > 0) {
            conversationHistory = dbMessages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
          }
        } catch (historyError: any) {
          logger.warn('Failed to load conversation history for chat mode', { error: historyError.message });
        }
      }
      // Apply sliding window (keep last 10)
      if (conversationHistory && conversationHistory.length > 10) {
        conversationHistory = conversationHistory.slice(-10);
      }

      // Conversation state tracking
      let conversationStateText: string | undefined;
      if (request.enableStateTracking !== false && request.conversationId && userId) {
        try {
          const { ConversationStateService } = await import('./conversation-state.service');
          const state = await ConversationStateService.getState(request.conversationId, userId);
          if (state) conversationStateText = ConversationStateService.formatStateForContextCompact(state);
        } catch { /* ignore */ }
      }

      // When the user sends attachments, the conversation state may contain
      // topics/entities from a DIFFERENT (now-removed) document. Clear it so
      // stale topics don't bias the LLM toward the old document.
      const hasNewAttachments = !!((request as any).attachmentIds?.length)
        || !!(request.attachments?.length);
      if (hasNewAttachments && conversationStateText) {
        conversationStateText = undefined;
      }

      // ── Inline attachment processing ──────────────────────────────────
      let attachmentContext = '';
      let imageAttachments: Array<{ name: string; mimeType: string; data: string }> | undefined;

      // ── Resolve pre-uploaded attachment IDs (follow-up messages) ────────
      // When the frontend sends attachmentIds, load extracted text from the
      // chat_attachments table — no base64 re-sent, no re-extraction.
      if ((request as any).attachmentIds && (request as any).attachmentIds.length > 0 && userId) {
        try {
          const { ChatAttachmentService } = await import('./chat-attachment.service');
          const resolved = await ChatAttachmentService.resolveByIds((request as any).attachmentIds, userId);
          if (resolved.length > 0) {
            const { AttachmentExtractorService } = await import('./attachment-extractor.service');
            const docsWithText = resolved
              .filter((r) => r.extractedText)
              .map((r) => ({ name: r.fileName, text: r.extractedText!, mimeType: r.mimeType }));
            if (docsWithText.length > 0) {
              attachmentContext = AttachmentExtractorService.formatAsContext(docsWithText, request.question);
            }

            // Emit extraction statuses so frontend can show badges on message bubbles
            const resolvedStatuses = resolved.map((r) => ({
              name: r.fileName,
              status: r.extractedText ? 'success' as const : 'failed' as const,
              chars: r.extractedText?.length ?? 0,
            }));
            if (resolvedStatuses.length > 0) {
              (request as any)._extractionStatuses = [
                ...((request as any)._extractionStatuses || []),
                ...resolvedStatuses,
              ];
            }

            // Persist fileId doc references into conversation metadata so
            // attachments survive cross-session reloads.
            if (request.conversationId) {
              // Link attachments to this conversation (they were uploaded with
              // conversation_id=NULL since the conversation may not have existed yet)
              try {
                await ChatAttachmentService.linkToConversation(
                  (request as any).attachmentIds,
                  request.conversationId,
                  userId,
                );
              } catch (linkErr: any) {
                logger.warn('Failed to link attachmentIds to conversation', { error: linkErr.message });
              }

              try {
                const { ConversationService } = await import('./conversation.service');
                const savedAttachments = resolved.map((r) => ({
                  name: r.fileName,
                  mimeType: r.mimeType,
                  extractedText: r.extractedText
                    ? r.extractedText.length > 12000
                      ? AttachmentExtractorService.smartTruncate(r.extractedText, request.question, 12000)
                      : r.extractedText
                    : '',
                  extractionStatus: r.extractedText ? 'success' : 'failed',
                  fileId: r.id,
                }));
                await ConversationService.updateConversation(
                  request.conversationId,
                  userId,
                  { metadata: { savedAttachments } },
                );
              } catch (saveErr: any) {
                logger.warn('Failed to persist attachmentIds to metadata', { error: saveErr.message });
              }
            }

            logger.info('Resolved attachmentIds for follow-up', {
              ids: (request as any).attachmentIds,
              resolved: resolved.length,
              withText: docsWithText.length,
            });
          }
        } catch (resolveErr: any) {
          logger.warn('Failed to resolve attachmentIds', { error: resolveErr.message });
        }
      }

      if (request.attachments && request.attachments.length > 0) {
        const { AttachmentExtractorService } = await import('./attachment-extractor.service');

        // Separate attachments: those with fileId (pre-uploaded) vs legacy base64
        const withFileId = request.attachments.filter((a: any) => a.fileId);
        const withBase64 = request.attachments.filter((a: any) => !a.fileId && a.type === 'document');
        const images = request.attachments.filter((a) => a.type === 'image');

        // ── Resolve fileId attachments from chat_attachments table ─────
        let fileIdResolvedDocs: Array<{ name: string; text: string; mimeType: string; fileId: string; extractionStatus: string }> = [];
        if (withFileId.length > 0 && userId) {
          try {
            const { ChatAttachmentService } = await import('./chat-attachment.service');
            const fileIds = withFileId.map((a: any) => a.fileId);
            const resolved = await ChatAttachmentService.resolveByIds(fileIds, userId);
            const docsWithText = resolved
              .filter((r) => r.extractedText)
              .map((r) => ({ name: r.fileName, text: r.extractedText!, mimeType: r.mimeType }));
            if (docsWithText.length > 0) {
              attachmentContext = AttachmentExtractorService.formatAsContext(docsWithText, request.question);
            }
            // Collect for metadata persistence
            fileIdResolvedDocs = resolved.map((r) => ({
              name: r.fileName,
              text: r.extractedText || '',
              mimeType: r.mimeType,
              fileId: r.id,
              extractionStatus: r.extractedText ? 'success' : 'failed',
            }));
            // Build extraction statuses from resolved data
            const resolvedStatuses = resolved.map((r) => ({
              name: r.fileName,
              status: r.extractedText ? 'success' as const : 'failed' as const,
              chars: r.extractedText?.length ?? 0,
            }));
            if (resolvedStatuses.length > 0) {
              (request as any)._extractionStatuses = [
                ...((request as any)._extractionStatuses || []),
                ...resolvedStatuses,
              ];
            }
            logger.info('Resolved fileId attachments', { count: resolved.length });

            // Link these fileId attachments to the conversation
            if (request.conversationId) {
              try {
                await ChatAttachmentService.linkToConversation(
                  fileIds,
                  request.conversationId,
                  userId,
                );
              } catch (linkErr: any) {
                logger.warn('Failed to link fileId attachments to conversation', { error: linkErr.message });
              }
            }
          } catch (resolveErr: any) {
            logger.warn('Failed to resolve fileId attachments', { error: resolveErr.message });
          }
        }

        // ── Extract text from legacy base64 document attachments ─────
        let base64ExtractedDocs: Array<{ name: string; text: string; mimeType: string }> = [];
        if (withBase64.length > 0) {
          const { extracted, statuses: extractionStatuses } = await AttachmentExtractorService.extractAllWithStatus(withBase64);
          base64ExtractedDocs = extracted;
          if (extracted.length > 0) {
            const base64Context = AttachmentExtractorService.formatAsContext(extracted, request.question);
            attachmentContext = attachmentContext
              ? attachmentContext + '\n\n' + base64Context
              : base64Context;
          }
          if (extractionStatuses.length > 0) {
            (request as any)._extractionStatuses = [
              ...((request as any)._extractionStatuses || []),
              ...extractionStatuses,
            ];
          }
        }

        // Collect image attachments for multi-part vision message
        if (images.length > 0) {
          imageAttachments = images.map((img) => ({
            name: img.name,
            mimeType: img.mimeType,
            data: img.data,
          }));
        }
        logger.info('Processed inline attachments for chat mode', {
          totalAttachments: request.attachments.length,
          fileIdDocs: withFileId.length,
          base64Docs: withBase64.length,
          images: images.length,
        });

        // ── Persist extracted document text to conversation metadata ─────
        // Save both fileId (pre-uploaded) and base64 doc references so that
        // loadConversationData can restore attachment indicators on reload.
        const allDocsToSave = [
          ...fileIdResolvedDocs.map((doc) => ({
            name: doc.name,
            mimeType: doc.mimeType,
            extractedText: doc.text.length > 12000
              ? AttachmentExtractorService.smartTruncate(doc.text, request.question, 12000)
              : doc.text,
            extractionStatus: doc.extractionStatus,
            fileId: doc.fileId,
          })),
          ...base64ExtractedDocs.map((doc) => ({
            name: doc.name,
            mimeType: doc.mimeType,
            extractedText: doc.text.length > 12000
              ? AttachmentExtractorService.smartTruncate(doc.text, request.question, 12000)
              : doc.text,
            extractionStatus: 'success',
          })),
        ];
        if (allDocsToSave.length > 0 && request.conversationId && userId) {
          try {
            const { ConversationService } = await import('./conversation.service');
            await ConversationService.updateConversation(
              request.conversationId,
              userId,
              { metadata: { savedAttachments: allDocsToSave } },
            );
            logger.info('Saved attachment context to conversation metadata', {
              conversationId: request.conversationId,
              documentCount: allDocsToSave.length,
              fileIdDocs: fileIdResolvedDocs.length,
              base64Docs: base64ExtractedDocs.length,
            });
          } catch (saveErr: any) {
            logger.warn('Failed to save attachment context to conversation', { error: saveErr.message });
          }
        }
      } else if (!attachmentContext && request.conversationId && userId) {
        // ── No new attachments and no attachmentIds — check conversation for saved context ─
        try {
          const { ConversationService } = await import('./conversation.service');
          const conversation = await ConversationService.getConversation(request.conversationId, userId);
          const saved = (conversation as any)?.metadata?.savedAttachments;
          if (saved && Array.isArray(saved) && saved.length > 0) {
            const { AttachmentExtractorService } = await import('./attachment-extractor.service');
            attachmentContext = AttachmentExtractorService.formatAsContext(
              saved.map((s: any) => ({ name: s.name, text: s.extractedText, mimeType: s.mimeType })),
              request.question,
            );
            logger.info('Loaded saved attachment context from conversation metadata', {
              conversationId: request.conversationId,
              documentCount: saved.length,
            });
          }
        } catch (loadErr: any) {
          logger.warn('Failed to load saved attachment context', { error: loadErr.message });
        }
      }

      // Pass the raw question to the LLM — document context is now in the system prompt
      const messages = PromptBuilderService.buildChatMessages(
        request.question,
        conversationHistory,
        conversationStateText,
        imageAttachments,
        attachmentContext || undefined,
      );

      return {
        ragContext: undefined,
        sources: undefined,
        conversationHistory,
        selectedModel,
        modelSelectionReason,
        provider: selectedProvider,
        messages,
        topicName: undefined,
        topicDescription: undefined,
        topicScopeConfig: undefined,
        timeFilter: undefined,
        temperature,
        maxTokens,
        contextDegraded: false,
        contextDegradationLevel: undefined,
        contextDegradationMessage: undefined,
        contextPartial: false,
        extractionStatuses: (request as any)._extractionStatuses,
        attachmentDocumentContext: attachmentContext || undefined,
      };
    }

    // ── Topic details (v2: retired) ─────────────────────────────────────
    const topicName = undefined;
    const topicDescription = undefined;
    const topicScopeConfig = undefined;

    // ── RAG retrieval ──────────────────────────────────────────────────
    let ragContext: string | undefined;
    let sources: Source[] | undefined;
    let contextDegraded = false;
    let contextDegradationLevel: DegradationLevel | undefined;
    let contextDegradationMessage: string | undefined;
    let contextPartial = false;

    if (userId) {
      try {
        const ragOptions: RAGOptions = {
          userId,
          // v2: Topics & document search retired
          enableDocumentSearch: false,
          enableWebSearch: request.enableWebSearch !== false,
          maxDocumentChunks: request.maxDocumentChunks ?? 5,
          maxWebResults: request.maxSearchResults ?? 5,
          minScore: request.minScore,
          topic: request.topic,
          timeRange: request.timeRange,
          startDate: request.startDate,
          endDate: request.endDate,
          country: request.country,
          topicQueryOptions: undefined,
          enableQueryExpansion: request.enableQueryExpansion ?? false,
          expansionStrategy: request.expansionStrategy,
          maxExpansions: request.maxExpansions,
          enableQueryRewriting: request.enableQueryRewriting ?? false,
          queryRewritingOptions: request.queryRewritingOptions,
          enableWebResultReranking: request.enableWebResultReranking ?? false,
          webResultRerankingConfig: request.webResultRerankingConfig,
          enableQualityScoring: request.enableQualityScoring ?? false,
          qualityScoringConfig: request.qualityScoringConfig,
          minQualityScore: request.minQualityScore,
          filterByQuality: request.filterByQuality ?? false,
          enableReranking: request.enableReranking ?? false,
          rerankingStrategy: request.rerankingStrategy,
          rerankingTopK: request.rerankingTopK,
          rerankingMaxResults: request.rerankingMaxResults,
          useAdaptiveThreshold: request.useAdaptiveThreshold ?? true,
          minResults: request.minResults,
          maxResults: request.maxResults,
          enableDiversityFilter: request.enableDiversityFilter ?? false,
          diversityLambda: request.diversityLambda,
          diversityMaxResults: request.diversityMaxResults,
          diversitySimilarityThreshold: undefined,
          enableResultDeduplication: request.enableResultDeduplication ?? false,
          deduplicationThreshold: request.deduplicationThreshold,
          deduplicationNearDuplicateThreshold: request.deduplicationNearDuplicateThreshold,
          useAdaptiveContextSelection: request.useAdaptiveContextSelection ?? true,
          enableAdaptiveContextSelection: request.enableAdaptiveContextSelection ?? true,
          adaptiveContextOptions: request.adaptiveContextOptions,
          minChunks: request.minChunks,
          maxChunks: request.maxChunks,
          enableDynamicLimits: request.enableDynamicLimits ?? true,
          dynamicLimitOptions: request.dynamicLimitOptions,
          enableRelevanceOrdering: request.enableRelevanceOrdering ?? true,
          orderingOptions: request.orderingOptions,
          contextReductionStrategy: request.contextReductionStrategy ?? 'summarize',
          maxContextTokens: request.maxContextTokens,
          summarizationOptions: request.summarizationOptions,
          enableSourcePrioritization: request.enableSourcePrioritization ?? true,
          prioritizationOptions: request.prioritizationOptions,
          enableTokenBudgeting: request.enableTokenBudgeting ?? true,
          tokenBudgetOptions: request.tokenBudgetOptions ? {
            ...request.tokenBudgetOptions,
            model: request.tokenBudgetOptions.model ?? request.model ?? 'gpt-3.5-turbo',
          } : undefined,
        };

        if (request.enableSearch === false) {
          ragOptions.enableWebSearch = false;
        }

        const context = await RAGService.retrieveContext(request.question, ragOptions);

        const [formattedContext, extractedSources] = await Promise.all([
          RAGService.formatContextForPrompt(context, {
            enableRelevanceOrdering: ragOptions.enableRelevanceOrdering ?? true,
            orderingOptions: ragOptions.orderingOptions,
            contextReductionStrategy: ragOptions.contextReductionStrategy ?? 'summarize',
            summarizationOptions: ragOptions.summarizationOptions,
            enableSourcePrioritization: ragOptions.enableSourcePrioritization ?? true,
            prioritizationOptions: ragOptions.prioritizationOptions,
            enableTokenBudgeting: ragOptions.enableTokenBudgeting ?? true,
            tokenBudgetOptions: {
              ...ragOptions.tokenBudgetOptions,
              model: request.model || 'gpt-3.5-turbo',
            },
            query: request.question,
            model: request.model || 'gpt-3.5-turbo',
            userId: userId,
          }),
          Promise.resolve(RAGService.extractSources(context)),
        ]);

        ragContext = formattedContext;
        sources = extractedSources;
        contextDegraded = context.degraded || false;
        contextDegradationLevel = context.degradationLevel;
        contextDegradationMessage = context.degradationMessage;
        contextPartial = context.partial || false;

        logger.info('RAG context retrieved', {
          userId,
          documentChunks: context.documentContexts.length,
          webResults: context.webSearchResults.length,
          totalSources: sources.length,
          degraded: contextDegraded,
          degradationLevel: contextDegradationLevel,
          partial: contextPartial,
        });
      } catch (ragError: any) {
        logger.warn('RAG retrieval failed, continuing without RAG context', {
          error: ragError.message,
          question: request.question,
          userId,
        });
      }
    } else {
      // Fallback web search when no userId
      if (request.enableSearch !== false) {
        try {
          const searchRequest: SearchRequest = {
            query: request.question,
            topic: request.topic,
            maxResults: request.maxSearchResults ?? 5,
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            country: request.country,
          };

          const searchResponse = await SearchService.search(searchRequest);

          if (searchResponse.results && searchResponse.results.length > 0) {
            const webResults = searchResponse.results.map(r => ({
              title: r.title,
              url: r.url,
              content: r.content,
            }));

            ragContext = await RAGService.formatContextForPrompt({
              documentContexts: [],
              webSearchResults: webResults,
            }, {
              enableRelevanceOrdering: true,
              contextReductionStrategy: request.contextReductionStrategy ?? 'summarize',
              summarizationOptions: request.summarizationOptions,
              enableSourcePrioritization: request.enableSourcePrioritization ?? true,
              prioritizationOptions: request.prioritizationOptions,
              enableTokenBudgeting: request.enableTokenBudgeting ?? true,
              tokenBudgetOptions: {
                ...request.tokenBudgetOptions,
                model: request.model || 'gpt-3.5-turbo',
              },
              query: request.question,
              model: request.model || 'gpt-3.5-turbo',
              userId: userId,
            });

            const accessDate = new Date().toISOString();

            sources = searchResponse.results.map((r) => ({
              type: 'web' as const,
              title: r.title,
              url: r.url,
              snippet: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
              metadata: {
                publishedDate: r.publishedDate,
                publicationDate: r.publishedDate,
                accessDate,
                author: r.author,
                url: r.url,
              },
            }));

            logger.info('Search results retrieved (fallback)', {
              query: request.question,
              resultsCount: webResults.length,
            });
          }
        } catch (searchError: any) {
          logger.warn('Search failed, continuing without search results', {
            error: searchError.message,
            question: request.question,
          });
        }
      }
    }

    // ── Time filter ────────────────────────────────────────────────────
    const timeFilter = request.timeRange || request.startDate || request.endDate || request.topic || request.country
      ? {
          timeRange: request.timeRange,
          startDate: request.startDate,
          endDate: request.endDate,
          topic: request.topic,
          country: request.country,
        }
      : undefined;

    // ── Conversation history (unified: sliding window + summarization) ─
    //
    // Strategy decision (Item 21):
    //   **Sliding window with summarization fallback.**
    //
    //   • Deterministic: the most recent N messages (default 10) are kept
    //     verbatim — same window for /ask and /ask/stream.
    //   • When older messages exist, they are summarized into ≤ 1 000 tokens
    //     to stay within the 2 000-token total history budget.
    //   • After windowing, optional relevance filtering (below) may further
    //     prune low-relevance turns.
    //
    //   Configuration (see SlidingWindowConfig in thresholds.config.ts):
    //     - Max messages in window:  10   (windowSize)
    //     - Token budget (win+sum):  2 000 (maxTotalTokens)
    //     - Summary token cap:       1 000 (maxSummaryTokens)
    //     - Summarization trigger:   messages.length > windowSize
    //
    //   Both pipelines call prepareRequestContext() so the LLM always
    //   receives identical conversation context regardless of endpoint.
    // ──────────────────────────────────────────────────────────────────
    let conversationHistory = request.conversationHistory;

    // Load from DB when no client-provided history (or empty array)
    if (request.conversationId && userId && (!conversationHistory || conversationHistory.length === 0)) {
      try {
        const { MessageService } = await import('./message.service');

        conversationHistory = await MessageService.getSlidingWindowHistory(
          request.conversationId,
          userId,
          {
            model: request.model || 'gpt-3.5-turbo',
            ...request.slidingWindowOptions,
          }
        );

        logger.info('Conversation history loaded (unified sliding-window strategy)', {
          conversationId: request.conversationId,
          historyLength: conversationHistory.length,
        });
      } catch (error: any) {
        logger.warn('Failed to fetch conversation history, continuing without history', {
          error: error.message,
          conversationId: request.conversationId,
        });
      }
    } else if (conversationHistory && conversationHistory.length > 0) {
      // Client-provided history — still apply sliding window for consistency
      try {
        const { MessageService } = await import('./message.service');

        conversationHistory = await MessageService.applyHistoryStrategy(
          conversationHistory,
          {
            model: request.model || 'gpt-3.5-turbo',
            ...request.slidingWindowOptions,
          }
        );

        logger.info('Client-provided history windowed (unified strategy)', {
          historyLength: conversationHistory.length,
        });
      } catch (error: any) {
        logger.warn('Failed to apply history strategy to client-provided history, using as-is', {
          error: error.message,
        });
      }
    }

    // ── History relevance filtering ────────────────────────────────────
    if (conversationHistory && conversationHistory.length > 0 && request.enableHistoryFiltering !== false) {
      try {
        const { HistoryFilterService } = await import('./history-filter.service');

        const filterResult = await HistoryFilterService.filterHistory(
          request.question,
          conversationHistory,
          { ...request.historyFilterOptions }
        );

        conversationHistory = filterResult.filteredHistory;

        logger.info('Conversation history filtered by relevance', {
          originalCount: filterResult.stats.originalCount,
          filteredCount: filterResult.stats.filteredCount,
          removedCount: filterResult.stats.removedCount,
          processingTimeMs: filterResult.stats.processingTimeMs,
          avgRelevanceScore: filterResult.scores.reduce((sum: number, msg: any) => sum + msg.relevanceScore, 0) / filterResult.scores.length,
        });
      } catch (error: any) {
        logger.warn('Failed to filter conversation history, using original history', {
          error: error.message,
        });
      }
    }

    // ── Model selection ────────────────────────────────────────────────
    let selectedModel: string;
    let selectedProvider: LLMProvider;
    let modelSelectionReason: string;

    const modelSelection = await this.selectModel(
      userId,
      request.question,
      ragContext,
      conversationHistory,
      request.model,
      'research'
    );
    selectedModel = modelSelection.model;
    selectedProvider = modelSelection.provider;
    modelSelectionReason = modelSelection.reason;

    if (userId) {
      try {
        const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);
        logger.info('Model selected based on tier', {
          userId,
          tier: subscriptionData?.subscription.tier || 'unknown',
          selectedModel,
          reason: modelSelectionReason,
          question: request.question.substring(0, 100),
        });
      } catch (error) {
        // Ignore errors in logging
      }
    }

    // ── Conversation state (entity / topic tracking) ───────────────────
    let conversationStateText = '';

    if (request.conversationId && userId && request.enableStateTracking !== false) {
      try {
        const { ConversationStateService } = await import('./conversation-state.service');
        const state = await ConversationStateService.getState(request.conversationId, userId);

        if (state && (state.topics.length > 0 || state.entities.length > 0 || state.keyConcepts.length > 0)) {
          conversationStateText = ConversationStateService.formatStateForContextCompact(state);
          logger.info('Conversation state injected into prompt', {
            conversationId: request.conversationId,
            topics: state.topics.length,
            entities: state.entities.length,
            concepts: state.keyConcepts.length,
          });
        }
      } catch (stateErr: any) {
        logger.warn('Failed to retrieve conversation state, continuing without it', {
          error: stateErr.message,
          conversationId: request.conversationId,
        });
      }
    }

    // ── Few-shot examples ──────────────────────────────────────────────
    let fewShotExamplesText = '';

    if (request.enableFewShotExamples !== false) {
      try {
        const hasDocuments = ragContext?.includes('Relevant Document Excerpts:') || false;
        const hasWebResults = ragContext?.includes('Web Search Results:') || false;

        const fewShotOptions: FewShotSelectionOptions = {
          query: request.question,
          hasDocuments,
          hasWebResults,
          maxExamples: request.fewShotOptions?.maxExamples ?? 2,
          maxTokens: request.fewShotOptions?.maxTokens ?? 500,
          model: request.model || 'gpt-3.5-turbo',
          preferCitationStyle: request.fewShotOptions?.preferCitationStyle,
          ...request.fewShotOptions,
        };

        const fewShotSelection = FewShotSelectorService.selectExamples(fewShotOptions);
        if (fewShotSelection.examples.length > 0) {
          fewShotExamplesText = FewShotSelectorService.formatExamplesForPrompt(fewShotSelection.examples);
        }
      } catch (err: unknown) {
        logger.warn('Few-shot example selection failed, continuing without examples', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── Build messages ─────────────────────────────────────────────────
    // Process inline attachments for research mode (same as chat mode)
    let researchAttachmentContext = '';
    let researchImageAttachments: Array<{ name: string; mimeType: string; data: string }> | undefined;

    // ── Resolve pre-uploaded attachment IDs (conversation-level attachments) ──
    if ((request as any).attachmentIds && (request as any).attachmentIds.length > 0 && userId) {
      try {
        const { ChatAttachmentService } = await import('./chat-attachment.service');
        const { AttachmentExtractorService } = await import('./attachment-extractor.service');
        const resolved = await ChatAttachmentService.resolveByIds((request as any).attachmentIds, userId);
        if (resolved.length > 0) {
          const docsWithText = resolved
            .filter((r) => r.extractedText)
            .map((r) => ({ name: r.fileName, text: r.extractedText!, mimeType: r.mimeType }));
          if (docsWithText.length > 0) {
            researchAttachmentContext = AttachmentExtractorService.formatAsContext(docsWithText, request.question);
          }
          const resolvedStatuses = resolved.map((r) => ({
            name: r.fileName,
            status: r.extractedText ? 'success' as const : 'failed' as const,
            chars: r.extractedText?.length ?? 0,
          }));
          if (resolvedStatuses.length > 0) {
            (request as any)._extractionStatuses = [
              ...((request as any)._extractionStatuses || []),
              ...resolvedStatuses,
            ];
          }

          // Link to conversation if applicable
          if (request.conversationId) {
            try {
              await ChatAttachmentService.linkToConversation(
                (request as any).attachmentIds,
                request.conversationId,
                userId,
              );
            } catch (linkErr: any) {
              logger.warn('Failed to link attachmentIds to conversation (research)', { error: linkErr.message });
            }
          }

          logger.info('Resolved attachmentIds for research mode', {
            ids: (request as any).attachmentIds,
            resolved: resolved.length,
            withText: docsWithText.length,
          });
        }
      } catch (resolveErr: any) {
        logger.warn('Failed to resolve attachmentIds in research mode', { error: resolveErr.message });
      }
    }

    if (request.attachments && request.attachments.length > 0) {
      const { AttachmentExtractorService } = await import('./attachment-extractor.service');

      // Separate: fileId-only (pre-uploaded) vs base64 documents vs images
      const withFileId = request.attachments.filter((a: any) => a.fileId && !a.data);
      const withBase64 = request.attachments.filter((a: any) => !a.fileId || a.data).filter((a) => a.type === 'document');
      const images = request.attachments.filter((a) => a.type === 'image');

      // Resolve fileId attachments from DB
      if (withFileId.length > 0 && userId) {
        try {
          const { ChatAttachmentService } = await import('./chat-attachment.service');
          const fileIds = withFileId.map((a: any) => a.fileId);
          const resolved = await ChatAttachmentService.resolveByIds(fileIds, userId);
          const docsWithText = resolved
            .filter((r) => r.extractedText)
            .map((r) => ({ name: r.fileName, text: r.extractedText!, mimeType: r.mimeType }));
          if (docsWithText.length > 0) {
            const ctx = AttachmentExtractorService.formatAsContext(docsWithText, request.question);
            researchAttachmentContext = researchAttachmentContext ? researchAttachmentContext + '\n\n' + ctx : ctx;
          }
          const resolvedStatuses = resolved.map((r) => ({
            name: r.fileName,
            status: r.extractedText ? 'success' as const : 'failed' as const,
            chars: r.extractedText?.length ?? 0,
          }));
          if (resolvedStatuses.length > 0) {
            (request as any)._extractionStatuses = [
              ...((request as any)._extractionStatuses || []),
              ...resolvedStatuses,
            ];
          }
        } catch (resolveErr: any) {
          logger.warn('Failed to resolve fileId attachments in research mode', { error: resolveErr.message });
        }
      }

      // Extract text from base64 document attachments
      if (withBase64.length > 0) {
        const { extracted, statuses: researchExtractionStatuses } = await AttachmentExtractorService.extractAllWithStatus(withBase64);
        if (extracted.length > 0) {
          const ctx = AttachmentExtractorService.formatAsContext(extracted, request.question);
          researchAttachmentContext = researchAttachmentContext ? researchAttachmentContext + '\n\n' + ctx : ctx;
        }
        if (researchExtractionStatuses.length > 0) {
          (request as any)._extractionStatuses = [
            ...((request as any)._extractionStatuses || []),
            ...researchExtractionStatuses,
          ];
        }
      }

      if (images.length > 0) {
        researchImageAttachments = images.map((img) => ({
          name: img.name,
          mimeType: img.mimeType,
          data: img.data,
        }));
      }
    }

    // Pass document attachment context separately so the prompt builder
    // can position it ABOVE web results with primary-source hierarchy.
    // Only plain `additionalContext` (non-attachment) goes into enrichedContext.
    const enrichedContext = request.context || undefined;

    const messages = this.buildMessages(
      request.question,
      ragContext,
      enrichedContext,
      conversationHistory,
      request.enableDocumentSearch,
      request.enableWebSearch,
      timeFilter,
      topicName,
      topicDescription,
      topicScopeConfig,
      fewShotExamplesText,
      conversationStateText,
      researchImageAttachments,
      researchAttachmentContext || undefined,
    );

    return {
      ragContext,
      sources,
      conversationHistory,
      selectedModel,
      modelSelectionReason,
      provider: selectedProvider,
      messages,
      topicName,
      topicDescription,
      topicScopeConfig,
      timeFilter,
      temperature,
      maxTokens,
      contextDegraded,
      contextDegradationLevel,
      contextDegradationMessage,
      contextPartial,
      attachmentDocumentContext: researchAttachmentContext || undefined,
      extractionStatuses: (request as any)._extractionStatuses,
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Non-streaming answer pipeline
  // ═════════════════════════════════════════════════════════════════════

  static async answerQuestionInternal(
    request: QuestionRequest,
    userId?: string,
    options?: { signal?: AbortSignal; skipSave?: boolean }
  ): Promise<QuestionResponse> {
    try {
      // Validate input
      if (!request.question || request.question.trim().length === 0) {
        throw new ValidationError('Question is required');
      }

      if (request.question.length > 2000) {
        throw new ValidationError('Question is too long (max 2000 characters)');
      }

      // ── Fetch topic details ── v2: skipped (topics retired)
      const preloadedTopic = undefined;

      // ── Off-topic pre-check ── v2: skipped (topics retired)

      const contextPromise = this.prepareRequestContext(request, userId, preloadedTopic);

      const context = await contextPromise;

      logger.info('Sending question to LLM provider', {
        provider: context.provider.id,
        model: context.selectedModel,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasRAGContext: !!context.ragContext,
        sourcesCount: context.sources?.length || 0,
        historyLength: context.conversationHistory?.length || 0,
        modelSelectionReason: context.modelSelectionReason,
      });

      // Check LLM response cache
      // Skip caching when inline attachments are present — the cache key doesn't
      // incorporate attachmentContext, so swapping documents with the same question
      // would return the cached response for the OLD document.
      const hasAttachments = !!(request.attachments?.length) || !!((request as any).attachmentIds?.length);
      const shouldCache = !hasAttachments && (!context.conversationHistory || context.conversationHistory.length <= 10);
      let completion: ChatCompletionResult | undefined;
      let cachedResponse: QuestionResponse | null = null;
      
      if (shouldCache) {
        const llmCacheKey = generateLLMCacheKey(
          request.question,
          context.selectedModel,
          context.temperature,
          context.ragContext,
          context.conversationHistory,
          undefined
        );
        
        const cached = await RedisCacheService.get<QuestionResponse>(llmCacheKey, {
          prefix: LLM_CACHE_PREFIX,
          ttl: LLM_CACHE_TTL,
        });
        
        if (cached) {
          llmCacheStats.hits++;
          logger.info('LLM response retrieved from cache', {
            question: request.question.substring(0, 100),
            model: context.selectedModel,
            cacheKey: llmCacheKey.substring(0, 50),
          });
          cachedResponse = cached;
        } else {
          llmCacheStats.misses++;
          logger.debug('LLM cache miss', {
            question: request.question.substring(0, 100),
            model: context.selectedModel,
          });
        }
      }

      if (cachedResponse) {
        logger.info('Returning cached LLM response', {
          question: request.question.substring(0, 100),
          model: context.selectedModel,
        });
        return cachedResponse;
      }

      // Call LLM provider with retry logic and circuit breaker
      // Chat mode: plain text response; Research mode: structured JSON output
      const isChatMode = request.mode === 'chat';
      const useJson = !isChatMode;
      try {
        const retryResult = await RetryService.execute(
          async () => {
            return await context.provider.chatCompletion({
              model: context.selectedModel,
              messages: context.messages as any,
              temperature: context.temperature,
              maxTokens: context.maxTokens,
              responseFormat: useJson ? 'json' : 'text',
              signal: options?.signal,
            });
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            multiplier: 2,
            maxDelay: 30000,
            onRetry: (error, attempt, delay) => {
              logger.warn('Retrying LLM API call', {
                attempt,
                delay,
                error: error.message,
                model: context.selectedModel,
                provider: context.provider.id,
                questionLength: request.question.length,
              });
            },
          }
        );
        completion = retryResult.result;
      } catch (openaiError: any) {
        ErrorTrackerService.trackError(ErrorServiceType.AI, openaiError, {
          userId,
          metadata: {
            operation: 'answerQuestion',
            questionLength: request.question.length,
          },
        }).catch(() => {});

        DegradationService.handleServiceError(ServiceType.OPENAI, openaiError);
        
        if (context.ragContext && context.sources && context.sources.length > 0) {
          logger.warn('LLM API failed but partial response available', {
            error: openaiError.message,
            provider: context.provider.id,
            sourcesCount: context.sources.length,
          });
          
          const degradationStatus = DegradationService.getOverallStatus();
          return {
            answer: `I apologize, but I'm experiencing technical difficulties with the AI service. However, I found ${context.sources.length} relevant source${context.sources.length > 1 ? 's' : ''} that may help answer your question. Please try again in a moment, or review the sources provided below.\n\n${context.sources.map((s, i) => `${i + 1}. ${s.title}${s.url ? ` (${s.url})` : ''}`).join('\n')}`,
            model: context.selectedModel,
            sources: context.sources,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            degraded: true,
            degradationLevel: DegradationLevel.SEVERE,
            degradationMessage: degradationStatus.message || 'AI service is currently unavailable',
            partial: true,
          };
        }
        
        throw openaiError;
      }

      const fullResponse = completion.content || (isChatMode ? '' : '{}');
      
      // ── Chat mode: use raw text ─────────────────────────────────────
      if (isChatMode) {
        // Chat mode returns plain text — skip JSON parsing, citations, and quality scoring
        let answer = fullResponse;
        let followUpQuestions: string[] | undefined;

        // Try to extract inline follow-up questions from the text
        const followUpResult = await ResponseProcessorService.processFollowUpQuestions(
          fullResponse,
          request.question,
          context.topicName
        );
        answer = followUpResult.answer;
        followUpQuestions = followUpResult.questions.length > 0 ? followUpResult.questions : undefined;

        // Save message pair if conversationId is provided
        if (request.conversationId && userId && !options?.skipSave) {
          try {
            const { ConversationService } = await import('./conversation.service');
            const { MessageService } = await import('./message.service');

            let conversationId = request.conversationId;
            let conversation = await ConversationService.getConversation(conversationId, userId);

            if (!conversation) {
              const title = ConversationService.generateTitleFromMessage(request.question);
              conversation = await ConversationService.createConversation({
                userId,
                title,
                mode: 'chat',
              });
              conversationId = conversation.id;
            }

            await MessageService.saveMessagePair(
              conversationId,
              request.question,
              answer,
              undefined,
              { model: context.selectedModel, isResend: !!request.resendUserMessageId },
            );
          } catch (saveError: any) {
            logger.warn('Failed to save chat messages (non-stream)', { error: saveError.message });
          }
        }

        return {
          answer,
          model: context.selectedModel,
          sources: [],
          usage: completion.usage ? {
            promptTokens: completion.usage.promptTokens,
            completionTokens: completion.usage.completionTokens,
            totalTokens: completion.usage.totalTokens,
          } : { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          followUpQuestions,
        };
      }

      // ── Research mode: Parse structured JSON response ──────────────────────────────
      // Non-OpenAI providers (especially Anthropic) may wrap JSON in
      // markdown fences or add preamble — sanitize before parsing.
      let structured: AIStructuredResponse | null = null;
      try {
        const sanitized = JsonAnswerStreamParser.sanitizeJson(fullResponse);
        const raw = JSON.parse(sanitized);
        structured = AIResponseSchema.parse(raw);
      } catch (parseErr: any) {
        logger.warn('Structured output parse failed, falling back to text extraction', {
          error: parseErr?.message,
          provider: context.provider.id,
          responsePreview: fullResponse.substring(0, 200),
        });
      }

      // If structured parsing succeeded, use the clean fields directly.
      // Otherwise fall back to legacy regex extraction for compatibility.
      let answer: string;
      let followUpQuestions: string[] | undefined;
      let structuredCitedSources: Array<{ index: number; type: 'document' | 'web'; url: string | null }> | undefined;

      if (structured) {
        answer = structured.answer;
        followUpQuestions = structured.followUpQuestions.length > 0 ? structured.followUpQuestions : undefined;
        structuredCitedSources = structured.citedSources;

        logger.info('Structured output parsed successfully', {
          answerLength: answer.length,
          followUpCount: structured.followUpQuestions.length,
          citedSourceCount: structured.citedSources.length,
        });
      } else {
        // Legacy fallback: regex extraction
        const followUpResult = await ResponseProcessorService.processFollowUpQuestions(
          fullResponse,
          request.question,
          context.topicName
        );
        answer = followUpResult.answer;
        followUpQuestions = followUpResult.questions.length > 0 ? followUpResult.questions : undefined;
      }

      // ── Citation parsing & validation ───────────────────────────────
      // With structured output, citedSources comes from JSON directly.
      // Fall back to regex CitationParserService when structured output is not available.
      let parsedCitations: import('./citation-parser.service').CitationParseResult | undefined;
      let citationValidation: import('./citation-validator.service').CitationValidationResult | undefined;
      let inlineCitations: import('../types/citation').InlineCitationResult | undefined;

      if (structuredCitedSources && structuredCitedSources.length > 0 && context.sources && context.sources.length > 0) {
        // Build validation from structured citedSources
        try {
          const { CitationValidatorService } = await import('./citation-validator.service');
          const sourceInfos: import('./citation-validator.service').SourceInfo[] = context.sources.map((source, idx) => ({
            type: source.type,
            index: idx + 1,
            title: source.title,
            url: source.url,
            documentId: source.documentId,
            id: source.documentId || source.url,
          }));

          // Convert structured citedSources to ParsedCitation shape for validator
          const structuredParsed: import('./citation-parser.service').ParsedCitation[] = structuredCitedSources.map(cs => ({
            type: cs.type,
            format: `[${cs.type === 'web' ? 'Web Source' : 'Document'} ${cs.index}]`,
            index: cs.index,
            url: cs.url ?? undefined,
            position: { start: 0, end: 0 },
          }));

          citationValidation = CitationValidatorService.validateCitationsAgainstSources(
            structuredParsed,
            sourceInfos
          );

          // Build a minimal parsedCitations result for the response
          parsedCitations = {
            citations: structuredParsed,
            textWithoutCitations: answer,
            citationCount: structuredParsed.length,
            documentCitations: structuredParsed.filter(c => c.type === 'document'),
            webCitations: structuredParsed.filter(c => c.type === 'web'),
            referenceCitations: [],
            parsingTimeMs: 0,
          };

          logger.info('Structured citations validated against sources', {
            citedSourceCount: structuredCitedSources.length,
            matchedCitations: citationValidation.matchedCitations,
            unmatchedCitations: citationValidation.unmatchedCitations,
            isValid: citationValidation.isValid,
          });
        } catch (validationError: any) {
          logger.warn('Failed to validate structured citations against sources', {
            error: validationError.message,
          });
        }
      } else if (!structured && request.enableCitationParsing !== false) {
        // Legacy regex-based citation parsing (fallback)
        try {
          const { CitationParserService } = await import('./citation-parser.service');
          
          const parseOptions = {
            removeCitations: false,
            preserveFormat: true,
            ...request.citationParseOptions,
          };
          
          parsedCitations = CitationParserService.parseCitations(answer, parseOptions);
          
          if (context.sources && context.sources.length > 0 && parsedCitations.citations.length > 0) {
            try {
              const { CitationValidatorService } = await import('./citation-validator.service');
              const sourceInfos: import('./citation-validator.service').SourceInfo[] = context.sources.map((source, idx) => ({
                type: source.type,
                index: idx + 1,
                title: source.title,
                url: source.url,
                documentId: source.documentId,
                id: source.documentId || source.url,
              }));
              citationValidation = CitationValidatorService.validateCitationsAgainstSources(
                parsedCitations.citations,
                sourceInfos
              );
            } catch (validationError: any) {
              logger.warn('Failed to validate citations against sources', { error: validationError.message });
            }
          }
        } catch (parseError: any) {
          logger.warn('Failed to parse citations from response', { error: parseError?.message ?? String(parseError) });
        }
      }

      if (!completion.usage) {
        throw new AppError('LLM API did not return usage information', 500, 'AI_API_ERROR');
      }

      // Calculate and track cost
      const costData = CostTrackingService.calculateCost(
        completion.model,
        completion.usage.promptTokens,
        completion.usage.completionTokens
      );
      
      if (userId) {
        CostTrackingService.trackCost(userId, {
          userId,
          queryId: request.conversationId,
          model: costData.model,
          promptTokens: costData.promptTokens,
          completionTokens: costData.completionTokens,
          totalTokens: costData.totalTokens,
          cost: costData.totalCost,
          metadata: {
            provider: context.provider.id,
            modelSelectionReason: context.modelSelectionReason,
            question: request.question.substring(0, 200),
            hasRAGContext: !!context.ragContext,
            sourcesCount: context.sources?.length || 0,
          },
        }).catch((error: any) => {
          logger.warn('Failed to track cost', { error: error.message });
        });
      }

      logger.info('LLM response received', {
        provider: context.provider.id,
        model: completion.model,
        tokensUsed: completion.usage.totalTokens,
        cost: costData.totalCost,
        hasFollowUpQuestions: !!followUpQuestions,
        modelSelectionReason: context.modelSelectionReason,
      });

      // Check overall degradation status
      const degradationStatus = DegradationService.getOverallStatus();
      const isDegraded = degradationStatus.level !== DegradationLevel.NONE || context.contextDegraded;
      const degradationLevel = context.contextDegradationLevel || degradationStatus.level;
      const degradationMessage = context.contextDegradationMessage || (isDegraded ? degradationStatus.message : undefined);
      const isPartial = context.contextPartial || (isDegraded && degradationStatus.canProvidePartialResults);

      const response: QuestionResponse = {
        answer,
        model: completion.model,
        sources: context.sources,
        citations: parsedCitations ? {
          total: parsedCitations.citationCount,
          document: parsedCitations.documentCitations.length,
          web: parsedCitations.webCitations.length,
          reference: parsedCitations.referenceCitations.length,
          parsed: parsedCitations.citations,
          validation: citationValidation ? {
            isValid: citationValidation.isValid,
            matched: citationValidation.matchedCitations,
            unmatched: citationValidation.unmatchedCitations,
            errors: citationValidation.errors,
            warnings: citationValidation.warnings,
            suggestions: citationValidation.suggestions,
            missingSources: citationValidation.missingSources,
            invalidUrls: citationValidation.invalidUrls,
            invalidDocumentIds: citationValidation.invalidDocumentIds,
          } : undefined,
          inline: inlineCitations ? {
            segments: inlineCitations.segments,
            citations: inlineCitations.citations,
            sourceMap: Object.fromEntries(inlineCitations.sourceMap),
            citationCount: inlineCitations.citationCount,
            segmentCount: inlineCitations.segmentCount,
          } : undefined,
        } : undefined,
        followUpQuestions: followUpQuestions && followUpQuestions.length > 0 ? followUpQuestions : undefined,
        usage: {
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          totalTokens: completion.usage.totalTokens,
        },
        degraded: isDegraded,
        degradationLevel: isDegraded ? degradationLevel : undefined,
        degradationMessage: degradationMessage,
        partial: isPartial,
      };

      // Cache LLM response
      if (shouldCache && !isDegraded && !isPartial) {
        const llmCacheKey = generateLLMCacheKey(
          request.question,
          context.selectedModel,
          context.temperature,
          context.ragContext,
          context.conversationHistory,
          undefined
        );
        
        const cacheSet = await RedisCacheService.set(llmCacheKey, response, {
          prefix: LLM_CACHE_PREFIX,
          ttl: LLM_CACHE_TTL,
        });
        
        if (cacheSet) {
          llmCacheStats.sets++;
          logger.debug('LLM response cached', {
            question: request.question.substring(0, 100),
            model: context.selectedModel,
            ttl: LLM_CACHE_TTL,
          });
        } else {
          llmCacheStats.errors++;
          logger.warn('Failed to cache LLM response', {
            question: request.question.substring(0, 100),
            model: context.selectedModel,
          });
        }
      }

      // Collect quality metrics
      if (userId && answer) {
        const qualityCitations = parsedCitations?.citations?.map((citation: import('./citation-parser.service').ParsedCitation) => ({
          text: citation.format || '',
          source: citation.url ?? citation.documentId ?? '',
          accurate: citationValidation?.isValid !== false,
        })) || [];

        QualityMetricsService.collectQualityMetrics(
          userId,
          request.question,
          answer,
          {
            queryId: request.conversationId,
            sources: context.sources || [],
            citations: qualityCitations.length > 0 ? qualityCitations : undefined,
            metadata: {
              model: completion.model || context.selectedModel,
              tokenUsage: completion.usage.totalTokens,
              hasCitations: (parsedCitations?.citations?.length || 0) > 0,
              citationValidation: citationValidation?.isValid,
            },
          }
        ).catch((error: any) => {
          logger.warn('Failed to collect quality metrics', {
            error: error.message,
            userId,
          });
        });
      }

      // ── LLM-as-judge evaluation (sampled, fire-and-forget) ──────
      if (userId) {
        import('./answer-evaluator.service').then(({ AnswerEvaluatorService }) => {
          AnswerEvaluatorService.maybeEvaluate({
            question: request.question,
            answer,
            sources: context.sources,
            userId,
            conversationId: request.conversationId,
            topicId: undefined,
          });
        }).catch((err: any) => {
          logger.warn('Failed to load answer evaluator', { error: err.message });
        });
      }

      // Save messages to conversation
      if (request.conversationId && userId && !options?.skipSave) {
        try {
          const { ConversationService } = await import('./conversation.service');
          const { MessageService } = await import('./message.service');
          
          let conversationId = request.conversationId;
          let conversation = await ConversationService.getConversation(conversationId, userId);
          
          if (!conversation) {
            const title = ConversationService.generateTitleFromMessage(request.question);
            conversation = await ConversationService.createConversation({
              userId,
              title,
              topicId: undefined,
            });
            conversationId = conversation.id;
            logger.info('Created new conversation for message', { conversationId, userId });
          }

          await MessageService.saveMessagePair(
            conversationId,
            request.question,
            response.answer,
            context.sources,
            {
              model: completion.model,
              usage: response.usage,
              ragUsed: !!context.ragContext,
              ...(response.followUpQuestions && response.followUpQuestions.length > 0 && { followUpQuestions: response.followUpQuestions }),
            }
          );

          logger.info('Messages saved to conversation', { conversationId, userId });

          if (request.enableStateTracking !== false && context.conversationHistory) {
            try {
              const { ConversationService: CS } = await import('./conversation.service');
              const { MessageService: MS } = await import('./message.service');
              const stateOptions = {
                updateThreshold: request.stateTrackingOptions?.updateThreshold ?? 5,
                ...request.stateTrackingOptions,
              };

              // Only fetch the messages the state extractor will actually analyse
              const stateMessageLimit = stateOptions.maxMessagesToAnalyze ?? 50;
              const allMessages = await MS.getAllMessages(conversationId, userId!, { limit: stateMessageLimit });
              const allHistory = allMessages.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content || '',
              }));

              const messageCount = allHistory.length;
              const shouldUpdate = messageCount % (stateOptions.updateThreshold ?? 5) === 0 || messageCount === 1;

              if (shouldUpdate) {
                await CS.updateConversationState(
                  conversationId,
                  userId!,
                  allHistory,
                  stateOptions
                );
                
                logger.info('Conversation state updated', { conversationId, messageCount });
              }
            } catch (stateError: any) {
              logger.warn('Failed to update conversation state', {
                error: stateError.message,
                conversationId,
              });
            }
          }

          (response as any).conversationId = conversationId;
        } catch (saveError: any) {
          logger.warn('Failed to save messages to conversation', {
            error: saveError.message,
            conversationId: request.conversationId,
            userId,
          });
        }
      }

      return response;
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // AbortError: client disconnected — not a real error
      if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
        logger.info('Request cancelled by client', {
          userId,
          questionLength: request.question?.length,
        });
        throw new AppError('Request cancelled by client', 499, 'REQUEST_CANCELLED');
      }

      if (error instanceof OpenAI.APIError) {
        ErrorTrackerService.trackError(ErrorServiceType.AI, error, {
          userId,
          metadata: {
            operation: 'answerQuestion',
            questionLength: request.question.length,
          },
        }).catch(() => {});

        logger.error('LLM API error:', {
          status: error.status,
          code: error.code,
          message: error.message,
          type: error.type,
        });

        if (error.status === 401) {
          throw new AppError('Invalid API key for LLM provider', 500, 'AI_API_KEY_INVALID');
        }
        if (error.status === 429) {
          throw new AppError('LLM API rate limit exceeded. Please try again later.', 429, 'AI_RATE_LIMIT');
        }
        if (error.status === 500 || error.status === 503) {
          throw new AppError('LLM API is temporarily unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
        }
        if (error.code === 'context_length_exceeded') {
          throw new ValidationError('Question or context is too long. Please shorten your question.', 'CONTEXT_TOO_LONG');
        }

        throw new AppError(
          `AI service error: ${error.message || 'Unknown error'}`,
          500,
          'AI_API_ERROR'
        );
      }

      // Provider-agnostic error handling (Anthropic, Google, Groq errors)
      const status = error?.status || error?.statusCode;
      if (status) {
        ErrorTrackerService.trackError(ErrorServiceType.AI, error, {
          userId,
          metadata: { operation: 'answerQuestion', questionLength: request.question.length },
        }).catch(() => {});

        logger.error('LLM provider error:', { status, message: error.message });

        if (status === 401) throw new AppError('Invalid API key for LLM provider', 500, 'AI_API_KEY_INVALID');
        if (status === 429) throw new AppError('LLM API rate limit exceeded. Please try again later.', 429, 'AI_RATE_LIMIT');
        if (status === 500 || status === 503) throw new AppError('LLM API is temporarily unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
        if (error.message?.includes('context') && error.message?.includes('length')) {
          throw new ValidationError('Question or context is too long. Please shorten your question.', 'CONTEXT_TOO_LONG');
        }
        throw new AppError(`AI service error: ${error.message || 'Unknown error'}`, 500, 'AI_API_ERROR');
      }

      logger.error('Unexpected error in AI service:', error);
      throw new AppError('Failed to generate AI response', 500, 'AI_SERVICE_ERROR');
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // Post-stream processing (follow-ups, quality, save, usage logging)
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Centralised post-stream business logic.
   *
   * Called by the streaming route handler after all chunks have been
   * collected.  Handles:
   *   1. Follow-up question extraction (structured or LLM-based)
   *   2. Answer quality scoring
   *   3. Conversation creation / message persistence
   *   4. Usage logging for analytics
   *
   * Returns data the route needs to write back over SSE (follow-ups,
   * quality score, conversationId).
   */
  static async postProcessStream(
    params: PostProcessStreamParams
  ): Promise<PostProcessStreamResult> {
    const {
      fullAnswer,
      question,
      userId,
      sources,
      topicName,
      topicId,
      conversationId,
      model,
      isResend,
      structuredFollowUps,
      structuredCitedSources,
      ragSettings,
    } = params;

    let cleanedAnswer = fullAnswer;
    let followUpQuestions: string[] | undefined;
    let qualityScore: number | undefined;
    let finalConversationId: string | undefined = conversationId;

    // ── 1. Follow-up questions ──────────────────────────────────────
    if (structuredFollowUps && structuredFollowUps.length > 0) {
      followUpQuestions = structuredFollowUps;
    } else {
      try {
        const followUpResult = await ResponseProcessorService.processFollowUpQuestions(
          fullAnswer,
          question,
          topicName,
        );
        followUpQuestions = followUpResult.questions.length > 0 ? followUpResult.questions : undefined;
        cleanedAnswer = followUpResult.answer;
      } catch (err: any) {
        logger.warn('Follow-up questions processing failed in streaming', { error: err?.message });
      }
    }

    // ── 2. Quality score ────────────────────────────────────────────
    try {
      qualityScore = ResponseProcessorService.calculateAnswerQualityScore(
        cleanedAnswer,
        sources || [],
        followUpQuestions || [],
      );
    } catch (err: any) {
      logger.warn('Quality score calculation failed', { error: err?.message });
    }

    // ── 2b. LLM-as-judge evaluation (sampled, fire-and-forget) ────
    if (userId) {
      import('../services/answer-evaluator.service').then(({ AnswerEvaluatorService }) => {
        AnswerEvaluatorService.maybeEvaluate({
          question,
          answer: cleanedAnswer,
          sources: sources ?? undefined,
          userId,
          conversationId,
          topicId,
        });
      }).catch((err: any) => {
        logger.warn('Failed to load answer evaluator (streaming)', { error: err.message });
      });
    }

    // ── 3. Persist to conversation ──────────────────────────────────
    if (conversationId && userId && cleanedAnswer) {
      try {
        const { ConversationService } = await import('../services/conversation.service');
        const { MessageService } = await import('../services/message.service');

        let conversation = await ConversationService.getConversation(conversationId, userId);

        if (!conversation) {
          const title = ConversationService.generateTitleFromMessage(question);
          conversation = await ConversationService.createConversation({
            userId,
            title,
            topicId,
          });
          finalConversationId = conversation.id;
          logger.info('Created new conversation for streaming message', {
            conversationId: finalConversationId,
            userId,
          });
        }

        const metadata: Record<string, any> = {
          model: model || 'gpt-4o-mini',
          streaming: true,
          ...(followUpQuestions && followUpQuestions.length > 0 && { followUpQuestions }),
          ...(qualityScore !== undefined && { qualityScore }),
          ...(structuredCitedSources && structuredCitedSources.length > 0 && { citedSources: structuredCitedSources }),
          ...(ragSettings && Object.keys(ragSettings).length > 0 && { ragSettings }),
        };

        if (isResend) {
          await MessageService.saveMessage({
            conversationId: finalConversationId!,
            role: 'assistant',
            content: cleanedAnswer,
            sources: sources ?? undefined,
            metadata,
          });
        } else {
          await MessageService.saveMessagePair(
            finalConversationId!,
            question,
            cleanedAnswer,
            sources,
            metadata,
          );
        }

        logger.info('Messages saved to conversation (streaming)', {
          conversationId: finalConversationId,
          userId,
          isResend,
        });
      } catch (saveError: any) {
        logger.warn('Failed to save messages to conversation (streaming)', {
          error: saveError.message,
          conversationId,
          userId,
        });
      }
    }

    // ── 4. Log usage for analytics ──────────────────────────────────
    if (userId && cleanedAnswer) {
      try {
        const { DatabaseService } = await import('../services/database.service');
        await DatabaseService.logUsage(userId, 'query', {
          question: question.substring(0, 200),
          topicId,
          model: model || 'gpt-3.5-turbo',
          hasSources: sources && sources.length > 0,
          streaming: true,
        });
      } catch (usageError: any) {
        logger.warn('Failed to log query usage (streaming)', { error: usageError?.message });
      }
    }

    return {
      followUpQuestions,
      qualityScore,
      cleanedAnswer,
      conversationId: finalConversationId,
    };
  }

  // ═════════════════════════════════════════════════════════════════════
  // Streaming answer pipeline
  // ═════════════════════════════════════════════════════════════════════

  static async *answerQuestionStreamInternal(
    request: QuestionRequest,
    userId?: string,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<string, void, unknown> {
    try {
      // Validate input
      if (!request.question || request.question.trim().length === 0) {
        throw new ValidationError('Question is required');
      }

      if (request.question.length > 2000) {
        throw new ValidationError('Question is too long (max 2000 characters)');
      }

      // Check if we have pre-retrieved context for streaming (from the route)
      // v2: Topic fetch skipped (topics retired)
      const preloadedTopic = undefined;

      // If request includes document attachments, emit an "extracting" sentinel
      // so the route can send an SSE event and the frontend shows a progress hint.
      const docAttachments = request.attachments?.filter((a) => a.type === 'document') ?? [];
      if (docAttachments.length > 0) {
        yield JSON.stringify({ __extracting: true, files: docAttachments.map((a) => a.name) });
      }

      // Use shared pipeline preparation (includes extraction)
      const context = await this.prepareRequestContext(request, userId, preloadedTopic);

      // Signal that extraction is done so the frontend can drop the extraction indicator
      if (docAttachments.length > 0) {
        yield JSON.stringify({ __extracting: false });
      }

      // Yield extraction status metadata before streaming begins so the route
      // can emit it as an SSE event (similar to the __structured sentinel)
      if (context.extractionStatuses && context.extractionStatuses.length > 0) {
        yield JSON.stringify({ __extractionStatus: true, statuses: context.extractionStatuses });
      }

      // ── Document Research mode ──────────────────────────────────────
      // When the user enables "Research my document" (researchMyDocument=true)
      // and there is attachment text, extract claims and verify via web search.
      logger.debug('Document research check', {
        researchMyDocument: !!request.researchMyDocument,
        hasAttachmentContext: !!context.attachmentDocumentContext,
        attachmentContextLen: context.attachmentDocumentContext?.length ?? 0,
      });
      if (request.researchMyDocument && context.attachmentDocumentContext) {
        try {
          const { DocumentResearchService } = await import('./document-research.service');
          let docResearchContext = '';

          for await (const event of DocumentResearchService.research(
            context.attachmentDocumentContext,
            request.question,
            { timeRange: request.timeRange, country: request.country },
          )) {
            if (event.type === 'status') {
              yield JSON.stringify({ __docResearch: true, status: event.message });
            } else if (event.type === 'claims') {
              yield JSON.stringify({ __docResearch: true, claims: event.claims });
            } else if (event.type === 'result') {
              docResearchContext = event.data.formattedContext;
              // Emit research sources alongside existing sources
              if (event.data.allSources.length > 0) {
                const researchSources = event.data.allSources.map((s) => ({
                  type: 'web' as const,
                  title: s.title,
                  url: s.url,
                  snippet: s.content?.slice(0, 200),
                  score: s.score,
                }));
                yield JSON.stringify({ __docResearch: true, sources: researchSources });
              }
            }
          }

          // Inject document research context into the messages / RAG context
          if (docResearchContext) {
            const researchPreamble = '\n\n--- DOCUMENT RESEARCH RESULTS ---\n' +
              'The following are the results of web-searching key claims from the user\'s document.\n' +
              'Use these to compare what the document says with what web sources report.\n\n';

            if (context.ragContext) {
              context.ragContext = context.ragContext + researchPreamble + docResearchContext;
            } else {
              context.ragContext = researchPreamble + docResearchContext;
            }

            // Rebuild messages with the enriched RAG context
            context.messages = this.buildMessages(
              request.question,
              context.ragContext,
              request.context,
              context.conversationHistory,
              request.enableDocumentSearch,
              request.enableWebSearch,
              context.timeFilter,
              context.topicName,
              context.topicDescription,
              context.topicScopeConfig,
              undefined, // fewShotExamples
              undefined, // conversationState
              undefined, // imageAttachments
              context.attachmentDocumentContext,
            );
          }
        } catch (docResearchErr: any) {
          logger.error('Document research pipeline failed, continuing without research', {
            error: docResearchErr.message,
            stack: docResearchErr.stack,
          });
          yield JSON.stringify({ __docResearch: true, status: 'Document research encountered an error. Generating answer from document content instead…' });
        }
      }
      
      // Override RAG context if pre-retrieved (handling the legacy/route-level optimization)
      if (request._preRetrievedRagContext) {
        context.ragContext = request._preRetrievedRagContext;
        // Re-build messages with the correct RAG context if it was overridden
        context.messages = this.buildMessages(
          request.question,
          context.ragContext,
          request.context,
          context.conversationHistory,
          request.enableDocumentSearch,
          request.enableWebSearch,
          context.timeFilter,
          context.topicName,
          context.topicDescription,
          context.topicScopeConfig,
            // Extract few-shot examples from the original message construction if possible,
            // or re-select if needed. Since we can't easily extract, we'll accept
            // that the messages are rebuilt below.
          undefined, // fewShotExamples
          undefined, // conversationState
          undefined, // imageAttachments
          context.attachmentDocumentContext,
        );
        logger.info('Using pre-retrieved RAG context for streaming', {
          userId,
          contextLength: context.ragContext.length,
        });
      }

      logger.info('Sending streaming question to LLM with RAG', {
        provider: context.provider.id,
        model: context.selectedModel,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasRAGContext: !!context.ragContext,
        historyLength: context.conversationHistory?.length || 0,
        modelSelectionReason: context.modelSelectionReason,
      });

      // Call LLM provider with streaming
      // Chat mode: plain text response; Research mode: structured JSON output
      const isChatMode = request.mode === 'chat';
      const useJson = !isChatMode; // Research mode expects JSON structured output
      const stream = context.provider.chatCompletionStream({
        model: context.selectedModel,
        messages: context.messages as any,
        temperature: context.temperature,
        maxTokens: context.maxTokens,
        responseFormat: useJson ? 'json' : 'text',
        signal: options?.signal,
      });

      if (isChatMode) {
        // Chat mode: yield raw text chunks directly (no JSON parsing)
        for await (const content of stream) {
          if (content) {
            yield content;
          }
        }
      } else {
        // Research mode: use JsonAnswerStreamParser to forward the answer field
        // in real-time while accumulating the full JSON for post-stream parsing.
        // Works across all providers (OpenAI, Anthropic, Google, Groq) — the
        // parser handles markdown fences, preamble text, and unicode escapes.
        const parser = new JsonAnswerStreamParser();

        for await (const content of stream) {
          if (content) {
            const answerChunk = parser.feed(content);
            if (answerChunk) {
              yield answerChunk;
            }
          }
        }

        // Fallback: if the provider ignored JSON instructions and returned plain
        // text (common with Anthropic prompt-injection JSON mode), yield the raw
        // accumulated text so the user still sees something.
        if (!parser.foundAnswerField()) {
          const raw = parser.getRawAccumulated().trim();
          if (raw) {
            logger.warn('Provider did not return structured JSON — falling back to raw text', {
              provider: context.provider.id,
              model: context.selectedModel,
              rawPreview: raw.substring(0, 200),
            });
            yield raw;
          }
        }

        // After stream completes, parse the accumulated JSON for metadata.
        // getAccumulatedJson() strips markdown fences and preamble that
        // non-OpenAI providers (especially Anthropic) may add.
        const accumulatedJson = parser.getAccumulatedJson();
        let structuredMeta: AIStructuredResponse | null = null;
        try {
          const raw = JSON.parse(accumulatedJson);
          structuredMeta = AIResponseSchema.parse(raw);
        } catch (parseErr: any) {
          logger.warn('Streaming structured output parse failed', {
            error: parseErr?.message,
            provider: context.provider.id,
            jsonPreview: accumulatedJson.substring(0, 200),
          });
        }

        // Yield a metadata sentinel object so the route handler
        // can detect follow-ups and cited sources.
        if (structuredMeta) {
          yield JSON.stringify({
            __structured: true,
            followUpQuestions: structuredMeta.followUpQuestions,
            citedSources: structuredMeta.citedSources,
          });
        }
      }

      logger.info('LLM streaming response completed', { 
        provider: context.provider.id,
        model: context.selectedModel,
        modelSelectionReason: context.modelSelectionReason,
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // AbortError: client disconnected — not a real error
      if (error.name === 'AbortError' || error.code === 'ABORT_ERR') {
        logger.info('Stream cancelled by client', {
          userId,
          questionLength: request.question?.length,
        });
        return; // Gracefully end the generator
      }

      // OpenAI-specific error (still imported for backward compat)
      if (error instanceof OpenAI.APIError) {
        logger.error('OpenAI API error (streaming):', {
          status: error.status,
          code: error.code,
          message: error.message,
        });
      }

      // Provider-agnostic error handling
      const status = error?.status || error?.statusCode;
      if (status) {
        logger.error('LLM provider error (streaming):', { status, message: error.message });
        if (status === 401) throw new AppError('Invalid API key for LLM provider', 500, 'AI_API_KEY_INVALID');
        if (status === 429) throw new AppError('LLM API rate limit exceeded. Please try again later.', 429, 'AI_RATE_LIMIT');
        if (status === 500 || status === 503) throw new AppError('LLM API is temporarily unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
        if (error.message?.includes('context') && error.message?.includes('length')) {
          throw new ValidationError('Question or context is too long. Please shorten your question.', 'CONTEXT_TOO_LONG');
        }
        throw new AppError(`AI service error: ${error.message || 'Unknown error'}`, 500, 'AI_API_ERROR');
      }

      logger.error('Unexpected error in AI service (streaming):', error);
      throw new AppError('Failed to generate AI response', 500, 'AI_SERVICE_ERROR');
    }
  }
}
