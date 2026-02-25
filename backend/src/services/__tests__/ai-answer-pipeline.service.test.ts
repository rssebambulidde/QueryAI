/**
 * Unit tests for AIAnswerPipelineService
 *
 * Tests the helper methods extracted from ai.service.ts:
 *   - isComplexQuery
 *   - selectModel
 *   - LLM cache stats
 */

// Mock dependencies before imports
jest.mock('../../config/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../retry.service', () => ({
  RetryService: {
    execute: jest.fn().mockImplementation(async (fn) => ({
      result: await fn(),
      retries: 0,
    })),
  },
}));

jest.mock('../subscription.service', () => ({
  SubscriptionService: {
    getUserSubscriptionWithLimits: jest.fn(),
  },
}));

jest.mock('../prompt-builder.service', () => ({
  PromptBuilderService: {
    buildMessages: jest.fn().mockReturnValue([]),
    buildSystemPrompt: jest.fn().mockReturnValue(''),
    deriveScopeFromConfig: jest.fn().mockReturnValue(''),
    getFollowUpBlock: jest.fn().mockReturnValue(''),
  },
}));

jest.mock('../redis-cache.service', () => ({
  RedisCacheService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../few-shot-selector.service', () => ({
  FewShotSelectorService: {
    selectExamples: jest.fn().mockReturnValue({ examples: [], formattedExamples: '' }),
    formatExamplesForPrompt: jest.fn().mockReturnValue(''),
  },
}));

jest.mock('../rag.service', () => ({
  RAGService: {
    retrieveContext: jest.fn(),
    formatContextForPrompt: jest.fn(),
    extractSources: jest.fn(),
  },
}));

jest.mock('../search.service', () => ({
  SearchService: {
    search: jest.fn(),
  },
}));

jest.mock('../degradation.service', () => ({
  DegradationService: {
    getOverallStatus: jest.fn().mockReturnValue({ level: 'NONE' }),
    handleServiceError: jest.fn(),
  },
  ServiceType: { OPENAI: 'OPENAI' },
  DegradationLevel: { NONE: 'NONE', SEVERE: 'SEVERE' },
}));

jest.mock('../latency-tracker.service', () => ({
  LatencyTrackerService: {
    trackOperation: jest.fn().mockImplementation(async (_type, fn) => fn()),
    storeLatencyMetric: jest.fn().mockResolvedValue(undefined),
    checkAlerts: jest.fn().mockResolvedValue(undefined),
  },
  OperationType: {
    AI_OFF_TOPIC_CHECK: 'AI_OFF_TOPIC_CHECK',
    AI_QUESTION_ANSWERING: 'AI_QUESTION_ANSWERING',
    AI_STREAMING: 'AI_STREAMING',
  },
}));

jest.mock('../error-tracker.service', () => ({
  ErrorTrackerService: {
    trackError: jest.fn().mockResolvedValue(undefined),
  },
  ServiceType: { AI: 'AI' },
}));

jest.mock('../quality-metrics.service', () => ({
  QualityMetricsService: {
    collectQualityMetrics: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../cost-tracking.service', () => ({
  CostTrackingService: {
    calculateCost: jest.fn().mockReturnValue({
      model: 'gpt-3.5-turbo',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      totalCost: 0.001,
    }),
    trackCost: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../response-processor.service', () => ({
  ResponseProcessorService: {
    processFollowUpQuestions: jest.fn().mockResolvedValue({
      answer: 'Test answer',
      questions: ['Follow-up 1?', 'Follow-up 2?'],
    }),
    getRefusalMessage: jest.fn().mockReturnValue('Off-topic refusal'),
    getRefusalFollowUp: jest.fn().mockReturnValue('Refusal follow-up'),
  },
}));

import { AIAnswerPipelineService } from '../ai-answer-pipeline.service';
import { SubscriptionService } from '../subscription.service';

describe('AIAnswerPipelineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isComplexQuery', () => {
    it('should identify simple queries as not complex', () => {
      expect(AIAnswerPipelineService.isComplexQuery('What is JavaScript?')).toBe(false);
      expect(AIAnswerPipelineService.isComplexQuery('Hello')).toBe(false);
    });

    it('should identify complex queries with analysis keywords', () => {
      // Complex queries need score >= 3, so need complex indicators (2) + something else
      const longComplexQuery = 'Can you compare and contrast the differences between React and Angular, analyze their performance characteristics, and evaluate which one is better for enterprise applications? What are the pros and cons of each?';
      expect(AIAnswerPipelineService.isComplexQuery(longComplexQuery)).toBe(true);
    });

    it('should consider math/logic queries as complex', () => {
      const mathQuery = 'Calculate the proof that the algorithm for solving this equation is optimal given the theorem of computational complexity';
      expect(AIAnswerPipelineService.isComplexQuery(mathQuery)).toBe(true);
    });

    it('should consider extensive context as a factor', () => {
      const longContext = 'A'.repeat(3500); // > 3000 chars
      const analyticQuery = 'Compare and analyze these results';
      expect(AIAnswerPipelineService.isComplexQuery(analyticQuery, longContext)).toBe(true);
    });
  });

  describe('selectModel', () => {
    it('should return GPT-3.5 for no userId', async () => {
      const result = await AIAnswerPipelineService.selectModel(undefined, 'test');
      expect(result).toEqual({ model: 'gpt-3.5-turbo', reason: 'no-user-default' });
    });

    it('should return user-requested model when specified', async () => {
      const result = await AIAnswerPipelineService.selectModel(
        'user-1', 'test', undefined, undefined, 'gpt-4'
      );
      expect(result).toEqual({ model: 'gpt-4', reason: 'user-requested' });
    });

    it('should return GPT-3.5 for free tier', async () => {
      (SubscriptionService.getUserSubscriptionWithLimits as jest.Mock).mockResolvedValue({
        subscription: { tier: 'free' },
      });

      const result = await AIAnswerPipelineService.selectModel('user-1', 'simple question');
      expect(result.model).toBe('gpt-3.5-turbo');
      expect(result.reason).toContain('tier-free');
    });

    it('should return GPT-3.5 for pro tier', async () => {
      (SubscriptionService.getUserSubscriptionWithLimits as jest.Mock).mockResolvedValue({
        subscription: { tier: 'pro' },
      });

      const result = await AIAnswerPipelineService.selectModel('user-1', 'question');
      expect(result.model).toBe('gpt-3.5-turbo');
      expect(result.reason).toContain('tier-pro');
    });

    it('should return GPT-3.5 on subscription error', async () => {
      (SubscriptionService.getUserSubscriptionWithLimits as jest.Mock).mockRejectedValue(
        new Error('DB error')
      );

      const result = await AIAnswerPipelineService.selectModel('user-1', 'question');
      expect(result.model).toBe('gpt-3.5-turbo');
      expect(result.reason).toBe('error-fallback');
    });

    it('should return GPT-3.5 when no subscription found', async () => {
      (SubscriptionService.getUserSubscriptionWithLimits as jest.Mock).mockResolvedValue(null);

      const result = await AIAnswerPipelineService.selectModel('user-1', 'question');
      expect(result).toEqual({ model: 'gpt-3.5-turbo', reason: 'no-subscription-default' });
    });
  });

  describe('LLM cache stats', () => {
    it('should track and return cache stats', () => {
      AIAnswerPipelineService.resetLLMCacheStats();
      const stats = AIAnswerPipelineService.getLLMCacheStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should reset cache stats', () => {
      AIAnswerPipelineService.resetLLMCacheStats();
      const stats = AIAnswerPipelineService.getLLMCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('runOffTopicPreCheckInternal', () => {
    const { openai: mockOpenAI } = require('../../config/openai');

    it('should return true for on-topic queries', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'YES' } }],
      });

      const result = await AIAnswerPipelineService.runOffTopicPreCheckInternal(
        'What is machine learning?',
        'Machine Learning',
        'A study of ML algorithms'
      );

      expect(result).toBe(true);
    });

    it('should return false for off-topic queries', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'NO' } }],
      });

      const result = await AIAnswerPipelineService.runOffTopicPreCheckInternal(
        'What is the best pizza recipe?',
        'Machine Learning',
        'A study of ML algorithms'
      );

      expect(result).toBe(false);
    });

    it('should return true on error (fail-open)', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));

      const result = await AIAnswerPipelineService.runOffTopicPreCheckInternal(
        'question',
        'topic'
      );

      expect(result).toBe(true);
    });
  });

  describe('buildMessages', () => {
    it('should delegate to PromptBuilderService', () => {
      const { PromptBuilderService } = require('../prompt-builder.service');

      AIAnswerPipelineService.buildMessages('question', 'context');

      expect(PromptBuilderService.buildMessages).toHaveBeenCalledWith(
        'question',
        'context',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });
  });
});
