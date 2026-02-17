/**
 * AI Service — Thin Coordinator
 *
 * Public API for AI question-answering. Delegates to:
 *   - AIAnswerPipelineService  (non-streaming & streaming answer pipelines)
 *   - AIGenerationService      (research summaries, starters, essays, reports)
 *
 * This file owns the canonical type definitions (QuestionRequest,
 * QuestionResponse, Source) so that all downstream services can import
 * them from a single location without circular dependencies.
 */

import { DegradationLevel } from './degradation.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import { ResponseProcessorService } from './response-processor.service';
import { AIAnswerPipelineService } from './ai-answer-pipeline.service';
import { AIGenerationService } from './ai-generation.service';

// ═══════════════════════════════════════════════════════════════════════
// Canonical type definitions — imported by downstream services
// ═══════════════════════════════════════════════════════════════════════

export interface QuestionRequest {
  question: string;
  context?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableSearch?: boolean;
  topic?: string;
  maxSearchResults?: number;
  optimizeSearchQuery?: boolean;
  searchOptimizationContext?: string;
  useTopicAwareQuery?: boolean;
  topicQueryOptions?: import('./topic-query-builder.service').TopicQueryOptions;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  startDate?: string;
  endDate?: string;
  country?: string;
  enableDocumentSearch?: boolean;
  enableWebSearch?: boolean;
  topicId?: string;
  documentIds?: string[];
  maxDocumentChunks?: number;
  minScore?: number;
  enableQueryExpansion?: boolean;
  expansionStrategy?: 'llm' | 'embedding' | 'hybrid' | 'none';
  maxExpansions?: number;
  enableQueryRewriting?: boolean;
  queryRewritingOptions?: import('./query-rewriter.service').QueryRewritingOptions;
  enableWebResultReranking?: boolean;
  webResultRerankingConfig?: import('./web-result-reranker.service').RerankingConfig;
  enableQualityScoring?: boolean;
  qualityScoringConfig?: import('./result-quality-scorer.service').QualityScoringConfig;
  minQualityScore?: number;
  filterByQuality?: boolean;
  enableReranking?: boolean;
  rerankingStrategy?: 'cross-encoder' | 'score-based' | 'hybrid' | 'none';
  rerankingTopK?: number;
  rerankingMaxResults?: number;
  useAdaptiveThreshold?: boolean;
  minResults?: number;
  maxResults?: number;
  enableDiversityFilter?: boolean;
  diversityLambda?: number;
  diversityMaxResults?: number;
  enableResultDeduplication?: boolean;
  deduplicationThreshold?: number;
  deduplicationNearDuplicateThreshold?: number;
  useAdaptiveContextSelection?: boolean;
  enableAdaptiveContextSelection?: boolean;
  adaptiveContextOptions?: Partial<import('./adaptive-context.service').AdaptiveContextOptions>;
  minChunks?: number;
  maxChunks?: number;
  enableDynamicLimits?: boolean;
  dynamicLimitOptions?: import('../config/rag.config').DynamicLimitOptions;
  enableRelevanceOrdering?: boolean;
  orderingOptions?: import('./relevance-ordering.service').OrderingOptions;
  enableContextCompression?: boolean;
  compressionOptions?: import('./context-compressor.service').CompressionOptions;
  maxContextTokens?: number;
  enableContextSummarization?: boolean;
  summarizationOptions?: import('./context-summarizer.service').SummarizationOptions;
  enableSourcePrioritization?: boolean;
  prioritizationOptions?: import('./source-prioritizer.service').PrioritizationOptions;
  enableTokenBudgeting?: boolean;
  tokenBudgetOptions?: import('./token-budget.service').TokenBudgetOptions;
  enableFewShotExamples?: boolean;
  fewShotOptions?: import('./few-shot-selector.service').FewShotSelectionOptions;
  enableConversationSummarization?: boolean;
  conversationSummarizationOptions?: import('./conversation-summarizer.service').ConversationSummarizationOptions;
  enableHistoryFiltering?: boolean;
  historyFilterOptions?: import('./history-filter.service').HistoryFilterOptions;
  enableSlidingWindow?: boolean;
  slidingWindowOptions?: import('./sliding-window.service').SlidingWindowOptions;
  enableStateTracking?: boolean;
  stateTrackingOptions?: import('./conversation-state.service').StateTrackingOptions;
  enableCitationParsing?: boolean;
  citationParseOptions?: import('./citation-parser.service').CitationParseOptions;
  conversationId?: string;
}

export interface Source {
  type: 'document' | 'web';
  title: string;
  url?: string;
  documentId?: string;
  snippet?: string;
  score?: number;
  metadata?: import('../types/source').SourceMetadata;
}

export interface QuestionResponse {
  answer: string;
  model: string;
  sources?: Source[];
  citations?: {
    total: number;
    document: number;
    web: number;
    reference: number;
    parsed: import('./citation-parser.service').ParsedCitation[];
    validation?: {
      isValid: boolean;
      matched: number;
      unmatched: number;
      errors: string[];
      warnings: string[];
      suggestions: string[];
      missingSources: string[];
      invalidUrls: string[];
      invalidDocumentIds: string[];
    };
    inline?: unknown;
  };
  followUpQuestions?: string[];
  refusal?: boolean;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  degraded?: boolean;
  degradationLevel?: DegradationLevel;
  degradationMessage?: string;
  partial?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// AI Service — Coordinator
// ═══════════════════════════════════════════════════════════════════════

export class AIService {
  // ── Refusal helpers ──────────────────────────────────────────────────

  static getRefusalMessage(topicName: string): string {
    return ResponseProcessorService.getRefusalMessage(topicName);
  }

  static getRefusalFollowUp(topicName: string): string {
    return ResponseProcessorService.getRefusalFollowUp(topicName);
  }

  // ── Off-topic pre-check ─────────────────────────────────────────────

  static async runOffTopicPreCheck(
    question: string,
    topicName: string,
    topicDescription?: string,
    topicScopeConfig?: Record<string, any> | null
  ): Promise<boolean> {
    return await LatencyTrackerService.trackOperation(
      OperationType.AI_OFF_TOPIC_CHECK,
      async () => AIAnswerPipelineService.runOffTopicPreCheckInternal(
        question, topicName, topicDescription, topicScopeConfig
      )
    );
  }

  // ── Follow-up questions ─────────────────────────────────────────────

  static async generateFollowUpQuestions(
    question: string,
    answer: string,
    topicName?: string
  ): Promise<string[]> {
    return ResponseProcessorService.generateFollowUpQuestions(question, answer, topicName);
  }

  // ── Non-streaming answer ────────────────────────────────────────────

  static async answerQuestion(
    request: QuestionRequest,
    userId?: string
  ): Promise<QuestionResponse> {
    return await LatencyTrackerService.trackOperation(
      OperationType.AI_QUESTION_ANSWERING,
      async () => AIAnswerPipelineService.answerQuestionInternal(request, userId),
      {
        userId,
        metadata: {
          questionLength: request.question.length,
          enableSearch: request.enableSearch,
          enableDocumentSearch: request.enableDocumentSearch,
          enableWebSearch: request.enableWebSearch,
        },
      }
    );
  }

  // ── Streaming answer ────────────────────────────────────────────────

  static async *answerQuestionStream(
    request: QuestionRequest,
    userId?: string
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      const generator = AIAnswerPipelineService.answerQuestionStreamInternal(request, userId);

      const trackedGenerator = async function*() {
        try {
          for await (const chunk of generator) {
            yield chunk;
          }
          success = true;
        } catch (err: any) {
          error = err.message;
          throw err;
        } finally {
          const duration = Date.now() - startTime;
          const metric = {
            operationType: OperationType.AI_STREAMING,
            userId,
            duration,
            timestamp: Date.now(),
            success,
            error,
            metadata: {
              questionLength: request.question.length,
            },
          };
          (LatencyTrackerService as any).storeLatencyMetric(metric).catch(() => {});
          (LatencyTrackerService as any).checkAlerts(metric).catch(() => {});
        }
      };

      yield* trackedGenerator();
    } catch (err: any) {
      error = err.message;
      throw err;
    }
  }

  // ── Content generation (delegates to AIGenerationService) ───────────

  static async generateResearchSessionSummary(
    conversationId: string,
    userId: string,
    topicName: string
  ): Promise<string> {
    return AIGenerationService.generateResearchSessionSummary(conversationId, userId, topicName);
  }

  static async generateSuggestedStarters(topicId: string, userId: string): Promise<string[]> {
    return AIGenerationService.generateSuggestedStarters(topicId, userId);
  }

  static async summarizeResponse(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    return AIGenerationService.summarizeResponse(originalResponse, keyword, sources);
  }

  static async writeEssay(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    return AIGenerationService.writeEssay(originalResponse, keyword, sources);
  }

  static async generateDetailedReport(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    return AIGenerationService.generateDetailedReport(originalResponse, keyword, sources);
  }

  // ── LLM cache stats (delegates to AIAnswerPipelineService) ──────────

  static getLLMCacheStats() {
    return AIAnswerPipelineService.getLLMCacheStats();
  }

  static resetLLMCacheStats(): void {
    AIAnswerPipelineService.resetLLMCacheStats();
  }
}
