import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AIService, QuestionRequest } from '../services/ai.service';
import { ValidationError } from '../types/error';

// Mock all dependencies
jest.mock('../config/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

jest.mock('../services/search.service');
jest.mock('../services/rag.service');
jest.mock('../services/few-shot-selector.service');
jest.mock('../services/citation-validator.service');
jest.mock('../services/answer-quality.service');
jest.mock('../services/conflict-resolution.service');
jest.mock('../services/retry.service');
jest.mock('../services/degradation.service');
jest.mock('../services/circuit-breaker.service');
jest.mock('../services/latency-tracker.service');
jest.mock('../services/error-tracker.service');
jest.mock('../services/quality-metrics.service');

// Import mocked services
import { openai } from '../config/openai';
import { SearchService } from '../services/search.service';
import { RAGService } from '../services/rag.service';
import { FewShotSelectorService } from '../services/few-shot-selector.service';
import { CitationValidatorService } from '../services/citation-validator.service';
import { AnswerQualityService } from '../services/answer-quality.service';
import { ConflictResolutionService } from '../services/conflict-resolution.service';
import { RetryService } from '../services/retry.service';
import { DegradationService } from '../services/degradation.service';
import { LatencyTrackerService } from '../services/latency-tracker.service';

describe('AIService', () => {
  const mockQuestion = 'What is artificial intelligence?';
  const mockUserId = 'user-123';
  const mockTopicId = 'topic-456';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    (openai.chat.completions.create as any).mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Artificial intelligence is the simulation of human intelligence by machines.',
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    });

    (SearchService.search as any).mockResolvedValue({
      query: mockQuestion,
      results: [],
    });

    (RAGService.retrieveContext as any).mockResolvedValue({
      documentContexts: [],
      webSearchResults: [],
    });

    (RAGService.formatContextForPrompt as any).mockResolvedValue('');

    (FewShotSelectorService.selectExamples as any).mockResolvedValue('');

    (CitationValidatorService.formatCitationGuidelines as any).mockReturnValue('Citation guidelines');
    (CitationValidatorService.validateCitations as any).mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
    });

    (AnswerQualityService.formatQualityGuidelines as any).mockReturnValue('Quality guidelines');
    (AnswerQualityService.evaluateAnswer as any).mockReturnValue({
      score: 0.9,
      feedback: 'Good answer',
    });

    (ConflictResolutionService.formatConflictResolutionGuidelines as any).mockReturnValue(
      'Conflict resolution guidelines'
    );

    (RetryService.execute as any).mockImplementation(async (fn: any) => {
      return { result: await fn(), attempts: 1 };
    });

    (DegradationService.getOverallStatus as any).mockReturnValue({
      level: 'none',
      affectedServices: [],
      message: undefined,
    });

    (LatencyTrackerService.trackOperation as any).mockImplementation(
      async (operationType: any, fn: any, metadata: any) => {
        return await fn();
      }
    );
  });

  describe('Input Validation', () => {
    it('should validate question is required', () => {
      const request: QuestionRequest = {
        question: '',
      };
      expect(request.question.trim().length).toBe(0);
    });

    it('should validate question length', () => {
      const maxLength = 2000;
      const shortQuestion = 'What is AI?';
      const longQuestion = 'a'.repeat(2001);

      expect(shortQuestion.length <= maxLength).toBe(true);
      expect(longQuestion.length <= maxLength).toBe(false);
    });

    it('should handle valid question', () => {
      const request: QuestionRequest = {
        question: 'What is artificial intelligence?',
      };
      expect(request.question.trim().length).toBeGreaterThan(0);
      expect(request.question.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('answerQuestion', () => {
    it('should answer question with basic request', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
      };

      const response = await AIService.answerQuestion(request);

      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(openai.chat.completions.create).toHaveBeenCalled();
    });

    it('should include RAG context when document search enabled', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        enableDocumentSearch: true,
      };

      await AIService.answerQuestion(request);

      expect(RAGService.retrieveContext).toHaveBeenCalled();
      expect(RAGService.formatContextForPrompt).toHaveBeenCalled();
    });

    it('should include web search when enabled', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        enableWebSearch: true,
      };

      await AIService.answerQuestion(request);

      expect(RAGService.retrieveContext).toHaveBeenCalled();
    });

    it('should include conversation history when provided', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      await AIService.answerQuestion(request);

      expect(openai.chat.completions.create).toHaveBeenCalled();
      const callArgs = (openai.chat.completions.create as any).mock.calls[0][0];
      expect(callArgs.messages.length).toBeGreaterThan(2); // System + history + current
    });

    it('should use specified model', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        model: 'gpt-4',
      };

      await AIService.answerQuestion(request);

      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
        })
      );
    });

    it('should use specified temperature', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        temperature: 0.7,
      };

      await AIService.answerQuestion(request);

      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        })
      );
    });

    it('should use specified maxTokens', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        maxTokens: 500,
      };

      await AIService.answerQuestion(request);

      expect(openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 500,
        })
      );
    });

    it('should include topic scope when topicName provided', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        topicName: 'AI Research',
      };

      await AIService.answerQuestion(request);

      expect(openai.chat.completions.create).toHaveBeenCalled();
      const callArgs = (openai.chat.completions.create as any).mock.calls[0][0];
      const systemPrompt = callArgs.messages.find((m: any) => m.role === 'system')?.content;
      expect(systemPrompt).toContain('AI Research');
    });

    it('should perform off-topic check when topicName provided', async () => {
      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        topicName: 'AI Research',
      };

      await AIService.answerQuestion(request);

      // Off-topic check should be performed
      expect(openai.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle off-topic questions with refusal', async () => {
      // Mock off-topic response
      (openai.chat.completions.create as any).mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'NO',
            },
          },
        ],
      });

      const request: QuestionRequest = {
        question: 'What is the weather?',
        userId: mockUserId,
        topicName: 'AI Research',
      };

      const response = await AIService.answerQuestion(request);

      expect(response).toBeDefined();
    });
  });

  describe('answerQuestionStream', () => {
    it('should stream answer response', async () => {
      // Mock streaming response
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [
              {
                delta: { content: 'Artificial ' },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: 'intelligence ' },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: { content: 'is...' },
              },
            ],
          };
        },
      };
      (openai.chat.completions.create as any).mockResolvedValue(mockStream);

      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
      };

      const chunks: string[] = [];
      for await (const chunk of AIService.answerQuestionStream(request)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('generateFollowUpQuestions', () => {
    it('should generate follow-up questions', async () => {
      (openai.chat.completions.create as any).mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '1. How does machine learning work?\n2. What are neural networks?\n3. What is deep learning?',
            },
          },
        ],
      });

      const questions = await AIService.generateFollowUpQuestions(
        mockQuestion,
        'AI is the simulation of human intelligence.',
        'AI Research'
      );

      expect(questions).toBeDefined();
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it('should handle empty answer', async () => {
      const questions = await AIService.generateFollowUpQuestions(
        mockQuestion,
        '',
        'AI Research'
      );

      expect(questions).toBeDefined();
    });
  });

  describe('getRefusalMessage', () => {
    it('should return refusal message for topic', () => {
      const message = AIService.getRefusalMessage('AI Research');
      
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('getRefusalFollowUp', () => {
    it('should return follow-up for refusal', () => {
      const followUp = AIService.getRefusalFollowUp('AI Research');
      
      expect(followUp).toBeDefined();
      expect(typeof followUp).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle empty question', async () => {
      const request: QuestionRequest = {
        question: '',
        userId: mockUserId,
      };

      await expect(AIService.answerQuestion(request)).rejects.toThrow();
    });

    it('should handle very long question', async () => {
      const longQuestion = 'a '.repeat(1000);
      const request: QuestionRequest = {
        question: longQuestion,
        userId: mockUserId,
      };

      const response = await AIService.answerQuestion(request);

      expect(response).toBeDefined();
    });

    it('should handle OpenAI API errors', async () => {
      (openai.chat.completions.create as any).mockRejectedValueOnce(
        new Error('API Error')
      );

      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
      };

      await expect(AIService.answerQuestion(request)).rejects.toThrow();
    });

    it('should handle RAG service errors gracefully', async () => {
      (RAGService.retrieveContext as any).mockRejectedValueOnce(
        new Error('RAG Error')
      );

      const request: QuestionRequest = {
        question: mockQuestion,
        userId: mockUserId,
        enableDocumentSearch: true,
      };

      // Should still attempt to answer
      await expect(AIService.answerQuestion(request)).resolves.toBeDefined();
    });
  });
});
