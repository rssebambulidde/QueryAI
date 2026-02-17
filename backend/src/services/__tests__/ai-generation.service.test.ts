/**
 * Unit tests for AIGenerationService
 *
 * Tests the standalone LLM generation tasks extracted from ai.service.ts:
 *   - generateResearchSessionSummary
 *   - generateSuggestedStarters
 *   - summarizeResponse
 *   - writeEssay
 *   - generateDetailedReport
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

jest.mock('../topic.service', () => ({
  TopicService: {
    getTopic: jest.fn(),
  },
}));

jest.mock('../message.service', () => ({
  MessageService: {
    getMessages: jest.fn(),
  },
}));

import { AIGenerationService } from '../ai-generation.service';
import { openai } from '../../config/openai';

const mockCreate = openai.chat.completions.create as jest.Mock;

describe('AIGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('summarizeResponse', () => {
    it('should return a summary from the LLM', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'This is a concise summary.' } }],
      });

      const result = await AIGenerationService.summarizeResponse(
        'Original long response text here...',
        'quantum computing'
      );

      expect(result).toBe('This is a concise summary.');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          max_tokens: 300,
        })
      );
    });

    it('should include sources in prompt when provided', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Summary with sources.' } }],
      });

      await AIGenerationService.summarizeResponse(
        'Response text',
        'AI',
        [
          { type: 'web', title: 'Source A', url: 'https://example.com' },
          { type: 'document', title: 'Doc B', documentId: 'doc-123' },
        ]
      );

      const callArgs = mockCreate.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;
      expect(prompt).toContain('Source A');
      expect(prompt).toContain('Doc B');
    });

    it('should return fallback message when LLM returns empty', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '' } }],
      });

      const result = await AIGenerationService.summarizeResponse('text', 'topic');
      expect(result).toBe('Summary could not be generated.');
    });
  });

  describe('writeEssay', () => {
    it('should return an essay from the LLM', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '## Essay Title\n\nBody paragraph...' } }],
      });

      const result = await AIGenerationService.writeEssay(
        'Response text',
        'machine learning'
      );

      expect(result).toContain('Essay Title');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1500,
        })
      );
    });
  });

  describe('generateDetailedReport', () => {
    it('should return a detailed report from the LLM', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '## Report\n\n### Section 1\n\nDetails...' } }],
      });

      const result = await AIGenerationService.generateDetailedReport(
        'Response text',
        'climate change'
      );

      expect(result).toContain('Report');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2500,
        })
      );
    });
  });

  describe('generateSuggestedStarters', () => {
    it('should return up to 4 starter questions', async () => {
      const { TopicService } = await import('../topic.service');
      (TopicService.getTopic as jest.Mock).mockResolvedValue({
        name: 'Neural Networks',
        description: 'Deep learning research',
      });

      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'What are the latest advances in neural network architectures?\nHow does backpropagation work in deep networks?\nWhat is transfer learning and when should it be used?\nHow do convolutional neural networks process images?',
          },
        }],
      });

      const result = await AIGenerationService.generateSuggestedStarters('topic-1', 'user-1');

      expect(result).toHaveLength(4);
      expect(result[0]).toContain('neural network');
    });

    it('should throw if topic not found', async () => {
      const { TopicService } = await import('../topic.service');
      (TopicService.getTopic as jest.Mock).mockResolvedValue(null);

      await expect(
        AIGenerationService.generateSuggestedStarters('missing-topic', 'user-1')
      ).rejects.toThrow('Topic not found');
    });
  });

  describe('generateResearchSessionSummary', () => {
    it('should generate a summary from conversation messages', async () => {
      const { MessageService } = await import('../message.service');
      (MessageService.getMessages as jest.Mock).mockResolvedValue([
        { role: 'user', content: 'What is quantum entanglement?' },
        { role: 'assistant', content: 'Quantum entanglement is a phenomenon where particles become correlated...' },
        { role: 'user', content: 'How is it used in quantum computing?' },
        { role: 'assistant', content: 'In quantum computing, entanglement enables quantum gates to operate on multiple qubits...' },
      ]);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '## Key Findings\n\n- Quantum entanglement explained\n- Applications in computing' } }],
      });

      const result = await AIGenerationService.generateResearchSessionSummary(
        'conv-1',
        'user-1',
        'Quantum Computing'
      );

      expect(result).toContain('Key Findings');
    });

    it('should return fallback for insufficient Q&A', async () => {
      const { MessageService } = await import('../message.service');
      (MessageService.getMessages as jest.Mock).mockResolvedValue([
        { role: 'user', content: 'Hi' },
      ]);

      const result = await AIGenerationService.generateResearchSessionSummary(
        'conv-1',
        'user-1',
        'Topic'
      );

      expect(result).toContain('Not enough on-topic Q&A');
    });
  });
});
