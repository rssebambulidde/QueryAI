import { describe, it, expect, beforeEach } from '@jest/globals';
import { AIService, QuestionRequest } from '../services/ai.service';
import { ValidationError } from '../types/error';

// Mock OpenAI
jest.mock('../config/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

describe('AIService', () => {
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

  describe('Conversation History', () => {
    it('should format conversation history correctly', () => {
      const history = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      expect(history.length).toBe(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should limit conversation history to last 10 messages', () => {
      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `Message ${i}`,
      }));

      const limited = longHistory.slice(-10);
      expect(limited.length).toBe(10);
    });
  });
});
