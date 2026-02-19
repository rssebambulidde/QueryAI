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
 *
 * QuestionRequest is derived from the Zod schema defined in
 *   schemas/ai-request.schema.ts
 * so that runtime validation and static types stay in sync.
 */

import { DegradationLevel } from './degradation.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import { ResponseProcessorService } from './response-processor.service';
import { AIAnswerPipelineService } from './ai-answer-pipeline.service';
import { AIGenerationService } from './ai-generation.service';
import type { QuestionRequestParsed } from '../schemas/ai-request.schema';

// ═══════════════════════════════════════════════════════════════════════
// Canonical type definitions — imported by downstream services
// ═══════════════════════════════════════════════════════════════════════

/**
 * QuestionRequest: the validated request shape produced by Zod,
 * extended with internal pipeline-only fields that are never
 * sent by clients.
 */
export type QuestionRequest = QuestionRequestParsed & {
  /** Injected by streaming route when RAG context is pre-retrieved */
  _preRetrievedRagContext?: string;
};

export interface Source {
  type: 'document' | 'web';
  title: string;
  url?: string;
  documentId?: string;
  snippet?: string;
  score?: number;
  pageNumber?: number;
  sectionTitle?: string;
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
    userId?: string,
    options?: { signal?: AbortSignal }
  ): Promise<QuestionResponse> {
    return await LatencyTrackerService.trackOperation(
      OperationType.AI_QUESTION_ANSWERING,
      async () => AIAnswerPipelineService.answerQuestionInternal(request, userId, options),
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
    userId?: string,
    options?: { signal?: AbortSignal }
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      const generator = AIAnswerPipelineService.answerQuestionStreamInternal(request, userId, options);

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

  // ── Streaming content generation (delegates to AIGenerationService) ──

  static summarizeResponseStream(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): AsyncGenerator<string, void, unknown> {
    return AIGenerationService.summarizeResponseStream(originalResponse, keyword, sources);
  }

  static writeEssayStream(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): AsyncGenerator<string, void, unknown> {
    return AIGenerationService.writeEssayStream(originalResponse, keyword, sources);
  }

  static generateDetailedReportStream(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): AsyncGenerator<string, void, unknown> {
    return AIGenerationService.generateDetailedReportStream(originalResponse, keyword, sources);
  }

  // ── LLM cache stats (delegates to AIAnswerPipelineService) ──────────

  static getLLMCacheStats() {
    return AIAnswerPipelineService.getLLMCacheStats();
  }

  static resetLLMCacheStats(): void {
    AIAnswerPipelineService.resetLLMCacheStats();
  }
}
