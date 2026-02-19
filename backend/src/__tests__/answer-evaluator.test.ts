/**
 * Answer Evaluator Service Tests
 *
 * Verifies sampling logic, evaluation response parsing, and storage.
 */

// ─── Mocks (before imports) ─────────────────────────────────────────

const mockCreate = jest.fn();
jest.mock('../config/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: any[]) => mockCreate(...args),
      },
    },
  },
}));

const insertMock = jest.fn().mockResolvedValue({ error: null });
const rpcMock = jest.fn().mockResolvedValue({ data: [], error: null });
const selectMock = jest.fn().mockReturnValue({
  order: jest.fn().mockReturnValue({
    range: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
});

jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => {
      if (table === 'answer_evaluations') {
        return { insert: insertMock, select: selectMock };
      }
      return { insert: jest.fn(), select: jest.fn() };
    }),
    schema: jest.fn(() => ({ rpc: rpcMock })),
  },
}));

jest.mock('../config/env', () => ({
  __esModule: true,
  default: {
    ANSWER_EVAL_SAMPLE_RATE: '0.05',
    OPENAI_API_KEY: 'test-key',
  },
}));

jest.mock('../config/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ─── Imports ────────────────────────────────────────────────────────

import { AnswerEvaluatorService } from '../services/answer-evaluator.service';

// ─── Tests ──────────────────────────────────────────────────────────

describe('AnswerEvaluatorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldEvaluate', () => {
    it('respects sampling rate — returns boolean', () => {
      // Call many times; at 5 % rate, most should be false
      const results = Array.from({ length: 200 }, () =>
        AnswerEvaluatorService.shouldEvaluate()
      );
      const trueCount = results.filter(Boolean).length;
      // Statistically: expect ~10 trues out of 200 ± margin
      expect(trueCount).toBeLessThan(60); // Very generous upper bound
    });
  });

  describe('evaluateAnswer', () => {
    it('parses structured JSON from GPT-4o-mini and clamps scores', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                faithfulness: 4,
                relevance: 5,
                citation_accuracy: 3,
                reason: {
                  faithfulness: 'Well grounded in sources',
                  relevance: 'Directly answers the question',
                  citation_accuracy: 'Most citations correct',
                },
              }),
            },
          },
        ],
      });

      const result = await AnswerEvaluatorService.evaluateAnswer(
        'What is RAG?',
        'RAG stands for Retrieval-Augmented Generation...',
        [{ type: 'web', title: 'RAG Explained', url: 'https://example.com', snippet: 'RAG is...' }],
      );

      expect(result.faithfulness).toBe(4);
      expect(result.relevance).toBe(5);
      expect(result.citation_accuracy).toBe(3);
      expect(result.reason.faithfulness).toBe('Well grounded in sources');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('clamps out-of-range scores to 1-5', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                faithfulness: 0,
                relevance: 7,
                citation_accuracy: -2,
                reason: { faithfulness: '', relevance: '', citation_accuracy: '' },
              }),
            },
          },
        ],
      });

      const result = await AnswerEvaluatorService.evaluateAnswer('q', 'a');
      expect(result.faithfulness).toBe(1);
      expect(result.relevance).toBe(5);
      expect(result.citation_accuracy).toBe(1);
    });
  });

  describe('getAggregates', () => {
    it('calls private schema RPC with correct params', async () => {
      rpcMock.mockResolvedValue({
        data: [{ period: '2025-01-01', evaluation_count: 10, avg_faithfulness: 4.2 }],
        error: null,
      });

      const result = await AnswerEvaluatorService.getAggregates(7, 'day');

      expect(rpcMock).toHaveBeenCalledWith('get_evaluation_aggregates', {
        p_days: 7,
        p_group_by: 'day',
      });
      expect(result).toHaveLength(1);
      expect(result[0].period).toBe('2025-01-01');
    });
  });
});
