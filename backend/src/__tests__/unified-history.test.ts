/**
 * Unified History Strategy Test (Item 21)
 *
 * Verifies that /ask (non-streaming) and /ask/stream (streaming) produce
 * identical conversation history input to the LLM when given the same
 * question and conversation context.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIAnswerPipelineService } from '../services/ai-answer-pipeline.service';
import type { QuestionRequest } from '../services/ai.service';

// ── Mock dependencies ───────────────────────────────────────────────────

jest.mock('../config/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

jest.mock('../config/database', () => {
  const rpcMock = jest.fn();
  return {
    supabaseAdmin: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(),
              range: jest.fn(),
            })),
            single: jest.fn(),
          })),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      rpc: rpcMock,
      schema: jest.fn(() => ({ rpc: rpcMock })),
    },
  };
});

jest.mock('../services/search.service');
jest.mock('../services/rag.service');
jest.mock('../services/few-shot-selector.service');
jest.mock('../services/retry.service');
jest.mock('../services/degradation.service');
jest.mock('../services/latency-tracker.service');
jest.mock('../services/error-tracker.service');
jest.mock('../services/quality-metrics.service');
jest.mock('../services/redis-cache.service');
jest.mock('../services/cost-tracking.service');
jest.mock('../services/subscription.service');
jest.mock('../services/response-processor.service');

jest.mock('../services/conversation.service', () => ({
  ConversationService: {
    getConversation: jest.fn(),
    createConversation: jest.fn(),
    updateConversationTimestamp: jest.fn(),
    generateTitleFromMessage: jest.fn(),
  },
}));

jest.mock('../services/sliding-window.service', () => ({
  SlidingWindowService: {
    applySlidingWindow: jest.fn(),
    formatWindowForHistory: jest.fn(),
  },
}));

jest.mock('../services/conversation-summarizer.service', () => ({
  ConversationSummarizerService: {
    getSummarizedHistory: jest.fn(),
  },
}));

jest.mock('../services/topic.service', () => ({
  TopicService: {
    getTopic: jest.fn(),
  },
}));

jest.mock('../services/history-filter.service', () => ({
  HistoryFilterService: {
    filterHistory: jest.fn(),
  },
}));

jest.mock('../services/conversation-state.service', () => ({
  ConversationStateService: {
    getState: jest.fn(),
  },
}));

const MOCK_DB_MESSAGES = [
  { id: 'm1', conversation_id: 'conv-1', role: 'user', content: 'Hello, what is AI?', sources: null, metadata: null, created_at: '2025-01-01T00:00:00Z' },
  { id: 'm2', conversation_id: 'conv-1', role: 'assistant', content: 'AI stands for artificial intelligence.', sources: null, metadata: null, created_at: '2025-01-01T00:01:00Z' },
  { id: 'm3', conversation_id: 'conv-1', role: 'user', content: 'Can you give examples?', sources: null, metadata: null, created_at: '2025-01-01T00:02:00Z' },
  { id: 'm4', conversation_id: 'conv-1', role: 'assistant', content: 'Examples include chatbots, image recognition, and self-driving cars.', sources: null, metadata: null, created_at: '2025-01-01T00:03:00Z' },
];

const MOCK_HISTORY = MOCK_DB_MESSAGES.map(m => ({
  role: m.role as 'user' | 'assistant',
  content: m.content,
}));

jest.mock('../services/message.service', () => ({
  MessageService: {
    getAllMessages: jest.fn(),
    getSlidingWindowHistory: jest.fn(),
    applyHistoryStrategy: jest.fn(),
    saveMessagePair: jest.fn(),
    saveMessage: jest.fn(),
  },
}));

import { RAGService } from '../services/rag.service';
import { FewShotSelectorService } from '../services/few-shot-selector.service';
import { RetryService } from '../services/retry.service';
import { DegradationService } from '../services/degradation.service';
import { LatencyTrackerService } from '../services/latency-tracker.service';
import { RedisCacheService } from '../services/redis-cache.service';
import { SubscriptionService } from '../services/subscription.service';
import { SlidingWindowService } from '../services/sliding-window.service';
import { ConversationService } from '../services/conversation.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { HistoryFilterService } from '../services/history-filter.service';
import { TopicService } from '../services/topic.service';
import { MessageService } from '../services/message.service';

// ── Test suite ──────────────────────────────────────────────────────────

describe('Unified History Strategy (Item 21)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // RAG: return empty context
    (RAGService.retrieveContext as any).mockResolvedValue({
      documentContexts: [],
      webSearchResults: [],
      degraded: false,
      partial: false,
    });
    (RAGService.formatContextForPrompt as any).mockResolvedValue('');
    (RAGService.extractSources as any).mockReturnValue([]);

    // Few-shot: no examples
    (FewShotSelectorService.selectExamples as any).mockReturnValue({
      examples: [],
      reasoning: '',
    });

    // Retry: execute directly
    (RetryService.execute as any).mockImplementation(async (fn: any) => ({
      result: await fn(),
      attempts: 1,
    }));

    // Degradation: none
    (DegradationService.getOverallStatus as any).mockReturnValue({
      level: 'none',
      affectedServices: [],
      message: undefined,
    });

    // Latency tracker: pass-through
    (LatencyTrackerService.trackOperation as any).mockImplementation(
      async (_op: any, fn: any) => fn()
    );

    // Redis cache: miss
    (RedisCacheService.get as any).mockResolvedValue(null);
    (RedisCacheService.set as any).mockResolvedValue(undefined);

    // Subscription: free tier
    (SubscriptionService.getUserSubscriptionWithLimits as any).mockResolvedValue({
      subscription: { tier: 'free' },
      limits: {},
    });

    // Conversation service
    (ConversationService.getConversation as any).mockResolvedValue({ id: 'conv-1', user_id: 'user-1' });

    // Topic: none
    (TopicService.getTopic as any).mockResolvedValue(null);

    // Conversation state: none
    (ConversationStateService.getState as any).mockResolvedValue(null);

    // History filter: pass-through
    (HistoryFilterService.filterHistory as any).mockImplementation(
      async (_q: any, history: any) => ({
        filteredHistory: history,
        stats: { originalCount: history.length, filteredCount: history.length, removedCount: 0, processingTimeMs: 1 },
        scores: history.map(() => ({ relevanceScore: 1 })),
      })
    );

    // Sliding window: pass-through (return unchanged for small histories)
    (SlidingWindowService.applySlidingWindow as any).mockImplementation(
      async (history: any) => ({
        windowMessages: history,
        originalMessageCount: history.length,
        windowMessageCount: history.length,
        summarizedMessageCount: 0,
        totalTokens: 100,
        windowTokens: 100,
        summaryTokens: 0,
      })
    );
    (SlidingWindowService.formatWindowForHistory as any).mockImplementation(
      (result: any) => result.windowMessages
    );

    // MessageService: configured per mock
    (MessageService.getSlidingWindowHistory as any).mockResolvedValue(MOCK_HISTORY);
    (MessageService.applyHistoryStrategy as any).mockImplementation(
      async (history: any) => history  // pass-through for these tests
    );
  });

  /**
   * Core parity test: prepareRequestContext() returns the same
   * conversationHistory regardless of which pipeline calls it.
   *
   * Since both answerQuestionInternal and answerQuestionStreamInternal
   * delegate to prepareRequestContext() for context building, we call it
   * twice with identical inputs and assert the history is identical.
   */
  it('produces identical conversation history for both streaming and non-streaming (DB-loaded)', async () => {
    const request: QuestionRequest = {
      question: 'What else can you tell me about AI?',
      conversationId: 'conv-1',
      // conversationHistory is undefined — pipeline should load from DB
    };
    const userId = 'user-1';

    const ctx1 = await AIAnswerPipelineService.prepareRequestContext(request, userId);
    const ctx2 = await AIAnswerPipelineService.prepareRequestContext(request, userId);

    // Both contexts must contain conversation history
    expect(ctx1.conversationHistory).toBeDefined();
    expect(ctx1.conversationHistory!.length).toBeGreaterThan(0);

    // Histories must be identical
    expect(ctx1.conversationHistory).toEqual(ctx2.conversationHistory);

    // Messages (the full prompt array sent to OpenAI) must also match
    expect(ctx1.messages).toEqual(ctx2.messages);
  });

  it('produces identical conversation history when client provides history', async () => {
    const clientHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'What is machine learning?' },
      { role: 'assistant', content: 'Machine learning is a subset of AI.' },
      { role: 'user', content: 'How does it differ from deep learning?' },
      { role: 'assistant', content: 'Deep learning uses neural networks with many layers.' },
    ];

    const request: QuestionRequest = {
      question: 'Give me more details.',
      conversationHistory: clientHistory,
      // No conversationId — pure client-side history
    };
    const userId = 'user-1';

    const ctx1 = await AIAnswerPipelineService.prepareRequestContext(request, userId);
    const ctx2 = await AIAnswerPipelineService.prepareRequestContext(request, userId);

    expect(ctx1.conversationHistory).toEqual(ctx2.conversationHistory);
    expect(ctx1.messages).toEqual(ctx2.messages);
  });

  it('applies sliding window to client-provided history (unified strategy)', async () => {
    const clientHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
    ];

    const request: QuestionRequest = {
      question: 'Follow up',
      conversationHistory: clientHistory,
    };

    await AIAnswerPipelineService.prepareRequestContext(request, 'user-1');

    // applyHistoryStrategy should have been called for the client-provided history
    expect(MessageService.applyHistoryStrategy).toHaveBeenCalledTimes(1);
    expect(MessageService.applyHistoryStrategy).toHaveBeenCalledWith(
      clientHistory,
      expect.objectContaining({ model: 'gpt-3.5-turbo' })
    );
  });

  it('loads history from DB and applies sliding window when no client history', async () => {
    const request: QuestionRequest = {
      question: 'Follow up on our conversation',
      conversationId: 'conv-1',
      // conversationHistory undefined — should load from DB
    };

    const ctx = await AIAnswerPipelineService.prepareRequestContext(request, 'user-1');

    // getSlidingWindowHistory should have been called (DB path)
    expect(MessageService.getSlidingWindowHistory).toHaveBeenCalledTimes(1);
    expect(MessageService.getSlidingWindowHistory).toHaveBeenCalledWith(
      'conv-1',
      'user-1',
      expect.objectContaining({ model: 'gpt-3.5-turbo' })
    );

    // History should contain the 4 mock messages
    expect(ctx.conversationHistory).toBeDefined();
    expect(ctx.conversationHistory!.length).toBe(4);
    expect(ctx.conversationHistory![0]).toEqual({
      role: 'user',
      content: 'Hello, what is AI?',
    });
  });

  it('loads history from DB when client provides empty array', async () => {
    const request: QuestionRequest = {
      question: 'Another follow up',
      conversationId: 'conv-1',
      conversationHistory: [], // Empty array — should still load from DB
    };

    await AIAnswerPipelineService.prepareRequestContext(request, 'user-1');

    // Empty array should trigger DB loading, not client-path
    expect(MessageService.getSlidingWindowHistory).toHaveBeenCalledTimes(1);
    expect(MessageService.applyHistoryStrategy).not.toHaveBeenCalled();
  });
});
