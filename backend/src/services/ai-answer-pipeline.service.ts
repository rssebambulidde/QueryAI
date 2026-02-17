/**
 * AI Answer Pipeline Service
 *
 * Contains the core answer-generation logic for both streaming and
 * non-streaming paths:
 *   - answerQuestionInternal   (non-streaming: RAG → LLM → citations → quality → save)
 *   - answerQuestionStreamInternal (streaming: RAG → LLM stream → yield chunks)
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

import { openai } from '../config/openai';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import OpenAI from 'openai';
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
import crypto from 'crypto';

import type { QuestionRequest, QuestionResponse, Source } from './ai.service';

// ═══════════════════════════════════════════════════════════════════════
// LLM Response Cache
// ═══════════════════════════════════════════════════════════════════════

const LLM_CACHE_TTL = 3600;
const LLM_CACHE_PREFIX = 'llm';

interface LLMCacheStats {
  hits: number;
  misses: number;
  sets: number;
  errors: number;
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
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
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

  return `${questionHash}|${model}|${temperature}|${contextHash}|${historyHash}`;
}

// ═══════════════════════════════════════════════════════════════════════
// AIAnswerPipelineService
// ═══════════════════════════════════════════════════════════════════════

export class AIAnswerPipelineService {
  // Model configuration (mirrored from AIService)
  private static readonly DEFAULT_MODEL = 'gpt-3.5-turbo';
  private static readonly DEFAULT_TEMPERATURE = 0.7;
  private static readonly DEFAULT_MAX_TOKENS = 1800;
  private static readonly GPT4_MODEL = 'gpt-4o-mini';
  private static readonly GPT35_MODEL = 'gpt-3.5-turbo';
  private static readonly PRO_TIER_GPT4_THRESHOLD = 0.2;

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
  // Helper methods
  // ═════════════════════════════════════════════════════════════════════

  static async runOffTopicPreCheckInternal(
    question: string,
    topicName: string,
    topicDescription?: string,
    topicScopeConfig?: Record<string, any> | null
  ): Promise<boolean> {
    const scopeLine = PromptBuilderService.deriveScopeFromConfig(topicScopeConfig);
    const desc = topicDescription || 'general';
    const prompt = `Topic: ${topicName}. Description: ${desc}.${scopeLine}

Question: ${question}

Is this question clearly within the topic? Answer only YES or NO.`;
    try {
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 10,
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
      const text = (completion.choices[0]?.message?.content || '').trim().toUpperCase();
      if (/^NO\b/.test(text)) return false;
      return true;
    } catch (err: any) {
      logger.warn('Off-topic pre-check failed, proceeding with full flow', { error: err?.message });
      return true;
    }
  }

  static isComplexQuery(
    question: string,
    ragContext?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): boolean {
    const complexIndicators = [
      /\?.*\?/,
      /(?:and|or|also|additionally|furthermore|moreover).*\?/i,
      /(?:compare|contrast|analyze|analysis|evaluate|examine|assess|critique)/i,
      /(?:difference|similarity|relationship|correlation|impact|effect)/i,
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

    const hasComplexIndicators = complexIndicators.some(pattern => pattern.test(question));
    const isLongQuestion = question.length > 200;
    const hasExtensiveContext = (ragContext && ragContext.length > 3000) ||
      (conversationHistory && conversationHistory.length > 5);
    const hasMathLogic = /(?:calculate|solve|equation|formula|theorem|proof|logic|reasoning)/i.test(question);

    const complexityScore =
      (hasComplexIndicators ? 2 : 0) +
      (isLongQuestion ? 1 : 0) +
      (hasExtensiveContext ? 1 : 0) +
      (hasMathLogic ? 2 : 0);

    return complexityScore >= 3;
  }

  static async selectModel(
    userId: string | undefined,
    question: string,
    ragContext?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    requestedModel?: string
  ): Promise<{ model: string; reason: string }> {
    if (requestedModel) {
      return { model: requestedModel, reason: 'user-requested' };
    }

    if (!userId) {
      return { model: this.GPT35_MODEL, reason: 'no-user-default' };
    }

    try {
      const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);

      if (!subscriptionData) {
        return { model: this.GPT35_MODEL, reason: 'no-subscription-default' };
      }

      const tier = subscriptionData.subscription.tier;

      if (tier === 'free' || tier === 'starter' || tier === 'premium') {
        return { model: this.GPT35_MODEL, reason: `tier-${tier}-gpt35-only` };
      }

      if (tier === 'pro') {
        const isComplex = this.isComplexQuery(question, ragContext, conversationHistory);

        if (isComplex) {
          return { model: this.GPT4_MODEL, reason: 'pro-tier-complex-query' };
        }

        const useGPT4 = Math.random() < this.PRO_TIER_GPT4_THRESHOLD;

        if (useGPT4) {
          return { model: this.GPT4_MODEL, reason: 'pro-tier-random-gpt4' };
        }

        return { model: this.GPT35_MODEL, reason: 'pro-tier-standard-gpt35' };
      }

      return { model: this.GPT35_MODEL, reason: 'default-fallback' };
    } catch (error: any) {
      logger.error('Failed to select model based on tier', {
        error: error.message,
        userId,
      });
      return { model: this.GPT35_MODEL, reason: 'error-fallback' };
    }
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
    conversationState?: string
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
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
      conversationState
    );
  }

  // ═════════════════════════════════════════════════════════════════════
  // Non-streaming answer pipeline
  // ═════════════════════════════════════════════════════════════════════

  static async answerQuestionInternal(
    request: QuestionRequest,
    userId?: string
  ): Promise<QuestionResponse> {
    try {
      // Validate input
      if (!request.question || request.question.trim().length === 0) {
        throw new ValidationError('Question is required');
      }

      if (request.question.length > 2000) {
        throw new ValidationError('Question is too long (max 2000 characters)');
      }

      const temperature = request.temperature ?? this.DEFAULT_TEMPERATURE;
      const maxTokens = request.maxTokens ?? this.DEFAULT_MAX_TOKENS;

      // Fetch topic details if topicId is provided (for Research Topic Mode)
      let topicName: string | undefined;
      let topicDescription: string | undefined;
      let topicScopeConfig: Record<string, any> | null | undefined;
      
      const topicFetchPromise = request.topicId && userId
        ? (async () => {
            try {
              const { TopicService } = await import('./topic.service');
              const topic = await TopicService.getTopic(request.topicId!, userId);
              if (topic) {
                return {
                  topicName: topic.name,
                  topicDescription: topic.description ?? undefined,
                  topicScopeConfig: topic.scope_config ?? null,
                };
              }
            } catch (topicError: any) {
              logger.warn('Failed to fetch topic details', {
                topicId: request.topicId,
                error: topicError.message,
              });
            }
            return null;
          })()
        : Promise.resolve(null);

      // Wait for topic fetch to complete before off-topic check
      const topicResult = await topicFetchPromise;
      if (topicResult) {
        topicName = topicResult.topicName;
        topicDescription = topicResult.topicDescription;
        topicScopeConfig = topicResult.topicScopeConfig;
        logger.info('Topic context loaded', { topicId: request.topicId, topicName });
      }

      // Off-topic pre-check
      const preCheckEnabled =
        !!topicName &&
        process.env.ENABLE_OFF_TOPIC_PRE_CHECK !== 'false' &&
        topicScopeConfig?.enable_off_topic_pre_check !== false;
      if (preCheckEnabled && topicName) {
        const onTopic = await LatencyTrackerService.trackOperation(
          OperationType.AI_OFF_TOPIC_CHECK,
          async () => this.runOffTopicPreCheckInternal(request.question, topicName!, topicDescription, topicScopeConfig)
        );
        if (!onTopic) {
          const refusal = ResponseProcessorService.getRefusalMessage(topicName);
          const followUp = ResponseProcessorService.getRefusalFollowUp(topicName);
          let conversationIdForResponse = request.conversationId;
          if (request.conversationId && userId) {
            try {
              const { ConversationService } = await import('./conversation.service');
              const { MessageService } = await import('./message.service');
              let conversation = await ConversationService.getConversation(request.conversationId, userId);
              let cid = request.conversationId;
              if (!conversation) {
                conversation = await ConversationService.createConversation({
                  userId,
                  title: ConversationService.generateTitleFromMessage(request.question),
                  topicId: request.topicId,
                });
                cid = conversation.id;
                conversationIdForResponse = cid;
              }
              await MessageService.saveMessagePair(cid, request.question, refusal, [], {
                followUpQuestions: [followUp],
                isRefusal: true,
              });
            } catch (e: any) {
              logger.warn('Failed to save refusal to conversation', { error: e?.message });
            }
          }
          const defaultModel = this.GPT35_MODEL;
          const response: QuestionResponse = {
            answer: refusal,
            model: defaultModel,
            sources: [],
            followUpQuestions: [followUp],
            refusal: true,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          };
          (response as any).conversationId = conversationIdForResponse;
          return response;
        }
      }

      // Retrieve RAG context (documents + web search)
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
            topicId: request.topicId,
            documentIds: request.documentIds,
            enableDocumentSearch: request.enableDocumentSearch !== false,
            enableWebSearch: request.enableWebSearch !== false,
            maxDocumentChunks: request.maxDocumentChunks ?? 5,
            maxWebResults: request.maxSearchResults ?? 5,
            minScore: request.minScore ?? 0.7,
            topic: request.topic,
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            country: request.country,
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
          };

          if (request.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }

          const context = await RAGService.retrieveContext(request.question, ragOptions);
          
          const [formattedContext, extractedSources] = await Promise.all([
            RAGService.formatContextForPrompt(context, {
              enableRelevanceOrdering: ragOptions.enableRelevanceOrdering ?? true,
              orderingOptions: ragOptions.orderingOptions,
              enableContextSummarization: ragOptions.enableContextSummarization ?? true,
              summarizationOptions: ragOptions.summarizationOptions,
              enableContextCompression: ragOptions.enableContextCompression ?? true,
              compressionOptions: ragOptions.compressionOptions,
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
        if (request.enableSearch !== false) {
          try {
            const searchRequest: SearchRequest = {
              query: request.question,
              topic: request.topic,
              maxResults: request.maxSearchResults ?? 5,
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
                enableContextSummarization: request.enableContextSummarization ?? true,
                summarizationOptions: request.summarizationOptions,
                enableContextCompression: request.enableContextCompression ?? true,
                compressionOptions: request.compressionOptions,
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

      // Build time filter for prompt
      const timeFilter = request.timeRange || request.startDate || request.endDate || request.topic || request.country
        ? {
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            topic: request.topic,
            country: request.country,
          }
        : undefined;

      // Fetch and process conversation history
      const conversationHistoryPromise = (async () => {
        let conversationHistory = request.conversationHistory;
        
        if (request.conversationId && userId && !conversationHistory && request.enableConversationSummarization !== false) {
          try {
            const { MessageService } = await import('./message.service');
            
            const summarizationOptions = {
              model: request.model || 'gpt-3.5-turbo',
              ...request.conversationSummarizationOptions,
            };
            
            conversationHistory = await MessageService.getSummarizedHistory(
              request.conversationId,
              userId,
              summarizationOptions
            );
            
            logger.info('Conversation history summarized', {
              conversationId: request.conversationId,
              historyLength: conversationHistory.length,
            });
          } catch (error: any) {
            logger.warn('Failed to fetch/summarize conversation history, continuing without history', {
              error: error.message,
              conversationId: request.conversationId,
            });
          }
        }

        if (conversationHistory && conversationHistory.length > 0 && request.enableHistoryFiltering !== false) {
          try {
            const { HistoryFilterService } = await import('./history-filter.service');
            
            const filterOptions = {
              ...request.historyFilterOptions,
            };
            
            const filterResult = await HistoryFilterService.filterHistory(
              request.question,
              conversationHistory,
              filterOptions
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

        return conversationHistory;
      })();

      const conversationHistory = await conversationHistoryPromise;

      // Select model based on tier and query complexity
      let selectedModel: string;
      let modelSelectionReason: string;
      
      if (request.model) {
        selectedModel = request.model;
        modelSelectionReason = 'user-requested';
      } else {
        const modelSelection = await this.selectModel(
          userId,
          request.question,
          ragContext,
          conversationHistory,
          request.model
        );
        selectedModel = modelSelection.model;
        modelSelectionReason = modelSelection.reason;
      }
      
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

      // Few-shot examples
      let fewShotExamplesText = '';
      let conversationStateText = '';
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

      const messages = this.buildMessages(
        request.question,
        ragContext,
        request.context,
        conversationHistory,
        request.enableDocumentSearch,
        request.enableWebSearch,
        timeFilter,
        topicName,
        topicDescription,
        topicScopeConfig,
        fewShotExamplesText,
        conversationStateText
      );

      logger.info('Sending question to OpenAI with RAG', {
        model: selectedModel,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasRAGContext: !!ragContext,
        sourcesCount: sources?.length || 0,
        historyLength: conversationHistory?.length || 0,
        modelSelectionReason,
      });

      // Check LLM response cache
      const shouldCache = !request.conversationHistory || request.conversationHistory.length <= 10;
      let completion: OpenAI.Chat.Completions.ChatCompletion | undefined;
      let cachedResponse: QuestionResponse | null = null;
      
      if (shouldCache) {
        const llmCacheKey = generateLLMCacheKey(
          request.question,
          selectedModel,
          temperature,
          ragContext,
          conversationHistory
        );
        
        const cached = await RedisCacheService.get<QuestionResponse>(llmCacheKey, {
          prefix: LLM_CACHE_PREFIX,
          ttl: LLM_CACHE_TTL,
        });
        
        if (cached) {
          llmCacheStats.hits++;
          logger.info('LLM response retrieved from cache', {
            question: request.question.substring(0, 100),
            model: selectedModel,
            cacheKey: llmCacheKey.substring(0, 50),
          });
          cachedResponse = cached;
        } else {
          llmCacheStats.misses++;
          logger.debug('LLM cache miss', {
            question: request.question.substring(0, 100),
            model: selectedModel,
          });
        }
      }

      if (cachedResponse) {
        logger.info('Returning cached LLM response', {
          question: request.question.substring(0, 100),
          model: selectedModel,
        });
        return cachedResponse;
      }

      // Call OpenAI API with retry logic and circuit breaker
      try {
        const retryResult = await RetryService.execute(
          async () => {
            return await openai.chat.completions.create({
              model: selectedModel,
              messages,
              temperature,
              max_tokens: maxTokens,
            });
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            multiplier: 2,
            maxDelay: 30000,
            onRetry: (error, attempt, delay) => {
              logger.warn('Retrying OpenAI API call', {
                attempt,
                delay,
                error: error.message,
                model: selectedModel,
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
        
        if (ragContext && sources && sources.length > 0) {
          logger.warn('OpenAI API failed but partial response available', {
            error: openaiError.message,
            sourcesCount: sources.length,
          });
          
          const degradationStatus = DegradationService.getOverallStatus();
          return {
            answer: `I apologize, but I'm experiencing technical difficulties with the AI service. However, I found ${sources.length} relevant source${sources.length > 1 ? 's' : ''} that may help answer your question. Please try again in a moment, or review the sources provided below.\n\n${sources.map((s, i) => `${i + 1}. ${s.title}${s.url ? ` (${s.url})` : ''}`).join('\n')}`,
            model: selectedModel,
            sources,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            degraded: true,
            degradationLevel: DegradationLevel.SEVERE,
            degradationMessage: degradationStatus.message || 'AI service is currently unavailable',
            partial: true,
          };
        }
        
        throw openaiError;
      }

      const fullResponse = completion.choices[0]?.message?.content || 'No response generated';
      
      // Parse citations from response if enabled
      let parsedCitations: import('./citation-parser.service').CitationParseResult | undefined;
      let citationValidation: import('./citation-validator.service').CitationValidationResult | undefined;
      
      if (request.enableCitationParsing !== false) {
        try {
          const { CitationParserService } = await import('./citation-parser.service');
          
          const parseOptions = {
            removeCitations: false,
            preserveFormat: true,
            ...request.citationParseOptions,
          };
          
          parsedCitations = CitationParserService.parseCitations(fullResponse, parseOptions);
          
          logger.info('Citations parsed from response', {
            totalCitations: parsedCitations.citationCount,
            documentCitations: parsedCitations.documentCitations.length,
            webCitations: parsedCitations.webCitations.length,
            referenceCitations: parsedCitations.referenceCitations.length,
            parsingTimeMs: parsedCitations.parsingTimeMs,
          });

          if (sources && sources.length > 0 && parsedCitations.citations.length > 0) {
            try {
              const { CitationValidatorService } = await import('./citation-validator.service');
              
              const sourceInfos: import('./citation-validator.service').SourceInfo[] = sources.map((source, idx) => ({
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

              logger.info('Citations validated against sources', {
                totalCitations: parsedCitations.citationCount,
                matchedCitations: citationValidation.matchedCitations,
                unmatchedCitations: citationValidation.unmatchedCitations,
                errors: citationValidation.errors.length,
                warnings: citationValidation.warnings.length,
                isValid: citationValidation.isValid,
              });

              if (citationValidation.errors.length > 0) {
                logger.warn('Citation validation errors found', {
                  errorCount: citationValidation.errors.length,
                  errors: citationValidation.errors.slice(0, 5),
                });
              }

              if (citationValidation.warnings.length > 0) {
                logger.debug('Citation validation warnings', {
                  warningCount: citationValidation.warnings.length,
                  warnings: citationValidation.warnings.slice(0, 5),
                });
              }
            } catch (validationError: any) {
              logger.warn('Failed to validate citations against sources', {
                error: validationError.message,
              });
            }
          }
        } catch (parseError: any) {
          logger.warn('Failed to parse citations from response', {
            error: parseError?.message ?? String(parseError),
          });
        }
      }

      // Parse follow-up questions from the response and extract clean answer
      const followUpResult = await ResponseProcessorService.processFollowUpQuestions(
        fullResponse,
        request.question,
        topicName
      );
      const answer = followUpResult.answer;
      const followUpQuestions = followUpResult.questions.length > 0 ? followUpResult.questions : undefined;

      // Build inline citation segments
      let inlineCitations: import('../types/citation').InlineCitationResult | undefined;
      if (parsedCitations && parsedCitations.citations.length > 0 && sources) {
        try {
          const { CitationParserService } = await import('./citation-parser.service');
          
          const answerStartInFullResponse = fullResponse.indexOf(answer);
          const adjustedCitations = parsedCitations.citations
            .filter(citation => {
              if (answerStartInFullResponse >= 0) {
                return citation.position.start >= answerStartInFullResponse &&
                       citation.position.end <= answerStartInFullResponse + answer.length;
              }
              return citation.position.start < answer.length && citation.position.end <= answer.length;
            })
            .map(citation => {
              const adjustedStart = answerStartInFullResponse >= 0
                ? citation.position.start - answerStartInFullResponse
                : citation.position.start;
              const adjustedEnd = answerStartInFullResponse >= 0
                ? citation.position.end - answerStartInFullResponse
                : citation.position.end;
              
              return {
                ...citation,
                position: {
                  start: adjustedStart,
                  end: adjustedEnd,
                },
              };
            });

          const sourceInfos = sources.map((source, idx) => ({
            type: source.type,
            title: source.title,
            url: source.url,
            documentId: source.documentId,
            index: idx + 1,
          }));

          inlineCitations = CitationParserService.buildInlineCitationSegments(
            answer,
            adjustedCitations,
            sourceInfos
          );

          logger.info('Inline citations built', {
            segmentCount: inlineCitations.segmentCount,
            citationCount: inlineCitations.citationCount,
            originalCitationCount: parsedCitations.citations.length,
            adjustedCitationCount: adjustedCitations.length,
          });
        } catch (error: any) {
          logger.warn('Failed to build inline citations', {
            error: error.message,
          });
        }
      }

      if (!completion.usage) {
        throw new AppError('OpenAI API did not return usage information', 500, 'AI_API_ERROR');
      }

      // Calculate and track cost
      const costData = CostTrackingService.calculateCost(
        completion.model,
        completion.usage.prompt_tokens,
        completion.usage.completion_tokens
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
            modelSelectionReason,
            question: request.question.substring(0, 200),
            hasRAGContext: !!ragContext,
            sourcesCount: sources?.length || 0,
          },
        }).catch((error: any) => {
          logger.warn('Failed to track cost', { error: error.message });
        });
      }

      logger.info('OpenAI response received', {
        model: completion.model,
        tokensUsed: completion.usage.total_tokens,
        cost: costData.totalCost,
        hasFollowUpQuestions: !!followUpQuestions,
        modelSelectionReason,
      });

      // Check overall degradation status
      const degradationStatus = DegradationService.getOverallStatus();
      const isDegraded = degradationStatus.level !== DegradationLevel.NONE || contextDegraded;
      const degradationLevel = contextDegradationLevel || degradationStatus.level;
      const degradationMessage = contextDegradationMessage || (isDegraded ? degradationStatus.message : undefined);
      const isPartial = contextPartial || (isDegraded && degradationStatus.canProvidePartialResults);

      const response: QuestionResponse = {
        answer,
        model: completion.model,
        sources,
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
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
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
          selectedModel,
          temperature,
          ragContext,
          conversationHistory
        );
        
        const cacheSet = await RedisCacheService.set(llmCacheKey, response, {
          prefix: LLM_CACHE_PREFIX,
          ttl: LLM_CACHE_TTL,
        });
        
        if (cacheSet) {
          llmCacheStats.sets++;
          logger.debug('LLM response cached', {
            question: request.question.substring(0, 100),
            model: selectedModel,
            ttl: LLM_CACHE_TTL,
          });
        } else {
          llmCacheStats.errors++;
          logger.warn('Failed to cache LLM response', {
            question: request.question.substring(0, 100),
            model: selectedModel,
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
            sources: sources || [],
            citations: qualityCitations.length > 0 ? qualityCitations : undefined,
            metadata: {
              model: completion.model || selectedModel,
              tokenUsage: completion.usage.total_tokens,
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

      // Save messages to conversation
      if (request.conversationId && userId) {
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
              topicId: request.topicId,
            });
            conversationId = conversation.id;
            logger.info('Created new conversation for message', { conversationId, userId });
          }

          await MessageService.saveMessagePair(
            conversationId,
            request.question,
            response.answer,
            sources,
            {
              model: completion.model,
              usage: response.usage,
              ragUsed: !!ragContext,
              ...(response.followUpQuestions && response.followUpQuestions.length > 0 && { followUpQuestions: response.followUpQuestions }),
            }
          );

          logger.info('Messages saved to conversation', { conversationId, userId });

          if (request.enableStateTracking !== false && conversationHistory) {
            try {
              const { ConversationService: CS } = await import('./conversation.service');
              const { MessageService: MS } = await import('./message.service');
              const allMessages = await MS.getAllMessages(conversationId, userId!);
              const allHistory = allMessages.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content || '',
              }));

              const stateOptions = {
                updateThreshold: request.stateTrackingOptions?.updateThreshold ?? 5,
                ...request.stateTrackingOptions,
              };

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

      if (error instanceof OpenAI.APIError) {
        ErrorTrackerService.trackError(ErrorServiceType.AI, error, {
          userId,
          metadata: {
            operation: 'answerQuestion',
            questionLength: request.question.length,
          },
        }).catch(() => {});

        logger.error('OpenAI API error:', {
          status: error.status,
          code: error.code,
          message: error.message,
          type: error.type,
        });

        if (error.status === 401) {
          throw new AppError('Invalid OpenAI API key', 500, 'AI_API_KEY_INVALID');
        }
        if (error.status === 429) {
          throw new AppError('OpenAI API rate limit exceeded. Please try again later.', 429, 'AI_RATE_LIMIT');
        }
        if (error.status === 500 || error.status === 503) {
          throw new AppError('OpenAI API is temporarily unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
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

      logger.error('Unexpected error in AI service:', error);
      throw new AppError('Failed to generate AI response', 500, 'AI_SERVICE_ERROR');
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // Streaming answer pipeline
  // ═════════════════════════════════════════════════════════════════════

  static async *answerQuestionStreamInternal(
    request: QuestionRequest,
    userId?: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      // Validate input
      if (!request.question || request.question.trim().length === 0) {
        throw new ValidationError('Question is required');
      }

      if (request.question.length > 2000) {
        throw new ValidationError('Question is too long (max 2000 characters)');
      }

      const temperature = request.temperature ?? this.DEFAULT_TEMPERATURE;
      const maxTokens = request.maxTokens ?? this.DEFAULT_MAX_TOKENS;

      // Fetch topic details
      let topicName: string | undefined;
      let topicDescription: string | undefined;
      let topicScopeConfig: Record<string, any> | null | undefined;
      if (request.topicId && userId) {
        try {
          const { TopicService } = await import('./topic.service');
          const topic = await TopicService.getTopic(request.topicId, userId);
          if (topic) {
            topicName = topic.name;
            topicDescription = topic.description ?? undefined;
            topicScopeConfig = topic.scope_config ?? null;
            logger.info('Topic context loaded for streaming', { topicId: request.topicId, topicName });
          }
        } catch (topicError: any) {
          logger.warn('Failed to fetch topic details for streaming', {
            topicId: request.topicId,
            error: topicError.message,
          });
        }
      }

      // Retrieve RAG context
      let ragContext: string | undefined;

      if (userId) {
        try {
          const ragOptions: RAGOptions = {
            userId,
            topicId: request.topicId,
            documentIds: request.documentIds,
            enableDocumentSearch: request.enableDocumentSearch !== false,
            enableWebSearch: request.enableWebSearch !== false,
            maxDocumentChunks: request.maxDocumentChunks ?? 5,
            maxWebResults: request.maxSearchResults ?? 5,
            minScore: request.minScore ?? 0.7,
            topic: request.topic,
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            country: request.country,
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
            enableContextCompression: request.enableContextCompression ?? true,
            compressionOptions: request.compressionOptions,
            maxContextTokens: request.maxContextTokens,
            enableContextSummarization: request.enableContextSummarization ?? true,
            summarizationOptions: request.summarizationOptions,
            enableSourcePrioritization: request.enableSourcePrioritization ?? true,
            prioritizationOptions: request.prioritizationOptions,
            enableTokenBudgeting: request.enableTokenBudgeting ?? true,
            tokenBudgetOptions: request.tokenBudgetOptions,
          };

          if (request.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }

          const context = await RAGService.retrieveContext(request.question, ragOptions);
          ragContext = await RAGService.formatContextForPrompt(context, {
            enableRelevanceOrdering: ragOptions.enableRelevanceOrdering ?? true,
            orderingOptions: ragOptions.orderingOptions,
            enableContextSummarization: ragOptions.enableContextSummarization ?? true,
            summarizationOptions: ragOptions.summarizationOptions,
            enableContextCompression: ragOptions.enableContextCompression ?? true,
            compressionOptions: ragOptions.compressionOptions,
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
          });

          logger.info('RAG context retrieved for streaming', {
            userId,
            documentChunks: context.documentContexts.length,
            webResults: context.webSearchResults.length,
          });
        } catch (ragError: any) {
          logger.warn('RAG retrieval failed during streaming, continuing without RAG context', {
            error: ragError.message,
            question: request.question,
            userId,
          });
        }
      } else {
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
                enableContextSummarization: request.enableContextSummarization ?? true,
                summarizationOptions: request.summarizationOptions,
                enableContextCompression: request.enableContextCompression ?? true,
                compressionOptions: request.compressionOptions,
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

              logger.info('Search results retrieved for streaming (fallback)', {
                query: request.question,
                resultsCount: webResults.length,
              });
            }
          } catch (searchError: any) {
            logger.warn('Search failed during streaming, continuing without search results', {
              error: searchError.message,
              question: request.question,
            });
          }
        }
      }

      // Build time filter
      const timeFilter = request.timeRange || request.startDate || request.endDate || request.topic || request.country
        ? {
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            topic: request.topic,
            country: request.country,
          }
        : undefined;

      // Fetch conversation history
      let conversationHistory = request.conversationHistory;
      if (request.conversationId && userId && !conversationHistory) {
        try {
          const { MessageService } = await import('./message.service');
          
          if (request.enableSlidingWindow !== false) {
            const slidingWindowOptions = {
              model: request.model || 'gpt-3.5-turbo',
              ...request.slidingWindowOptions,
            };
            
            conversationHistory = await MessageService.getSlidingWindowHistory(
              request.conversationId,
              userId,
              slidingWindowOptions
            );
            
            logger.info('Conversation history processed with sliding window', {
              conversationId: request.conversationId,
              historyLength: conversationHistory.length,
            });
          } else if (request.enableConversationSummarization !== false) {
            const summarizationOptions = {
              model: request.model || 'gpt-3.5-turbo',
              ...request.conversationSummarizationOptions,
            };
            
            conversationHistory = await MessageService.getSummarizedHistory(
              request.conversationId,
              userId,
              summarizationOptions
            );
            
            logger.info('Conversation history summarized', {
              conversationId: request.conversationId,
              historyLength: conversationHistory.length,
            });
          } else {
            const messages = await MessageService.getAllMessages(request.conversationId, userId);
            conversationHistory = messages.map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content || '',
            }));
            
            logger.info('Conversation history retrieved (no processing)', {
              conversationId: request.conversationId,
              historyLength: conversationHistory.length,
            });
          }
        } catch (error: any) {
          logger.warn('Failed to fetch conversation history, continuing without history', {
            error: error.message,
            conversationId: request.conversationId,
          });
        }
      }

      // Filter conversation history
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

      // Few-shot examples
      let fewShotExamplesText = '';
      let conversationStateText = '';
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
            
            logger.info('Few-shot examples selected', {
              query: request.question.substring(0, 100),
              exampleCount: fewShotSelection.examples.length,
              totalTokens: fewShotSelection.totalTokens,
              reasoning: fewShotSelection.reasoning,
            });
          }
        } catch (error: any) {
          logger.warn('Few-shot example selection failed, continuing without examples', {
            error: error.message,
          });
        }
      }

      // Select model
      let selectedModel: string;
      let modelSelectionReason: string;
      
      if (request.model) {
        selectedModel = request.model;
        modelSelectionReason = 'user-requested';
      } else {
        const modelSelection = await this.selectModel(
          userId,
          request.question,
          ragContext,
          conversationHistory,
          request.model
        );
        selectedModel = modelSelection.model;
        modelSelectionReason = modelSelection.reason;
      }
      
      if (userId) {
        try {
          const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);
          logger.info('Model selected for streaming based on tier', {
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

      const messages = this.buildMessages(
        request.question,
        ragContext,
        request.context,
        conversationHistory,
        request.enableDocumentSearch,
        request.enableWebSearch,
        timeFilter,
        topicName,
        topicDescription,
        topicScopeConfig,
        fewShotExamplesText,
        conversationStateText
      );

      logger.info('Sending streaming question to OpenAI with RAG', {
        model: selectedModel,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasRAGContext: !!ragContext,
        historyLength: conversationHistory?.length || 0,
        modelSelectionReason,
      });

      // Call OpenAI API with streaming
      const stream = await openai.chat.completions.create({
        model: selectedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }

      logger.info('OpenAI streaming response completed', { 
        model: selectedModel,
        modelSelectionReason,
      });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof OpenAI.APIError) {
        logger.error('OpenAI API error (streaming):', {
          status: error.status,
          code: error.code,
          message: error.message,
          type: error.type,
        });

        if (error.status === 401) {
          throw new AppError('Invalid OpenAI API key', 500, 'AI_API_KEY_INVALID');
        }
        if (error.status === 429) {
          throw new AppError('OpenAI API rate limit exceeded. Please try again later.', 429, 'AI_RATE_LIMIT');
        }
        if (error.status === 500 || error.status === 503) {
          throw new AppError('OpenAI API is temporarily unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
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

      logger.error('Unexpected error in AI service (streaming):', error);
      throw new AppError('Failed to generate AI response', 500, 'AI_SERVICE_ERROR');
    }
  }
}
