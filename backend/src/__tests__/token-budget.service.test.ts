import { TokenBudgetService, DEFAULT_BUDGET_ALLOCATION } from '../services/token-budget.service';
import { TokenCountService } from '../services/token-count.service';

jest.mock('../services/token-count.service');

describe('TokenBudgetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (TokenCountService.countTokens as jest.Mock).mockImplementation((text: string) => {
      // Simple mock: ~4 tokens per word
      return text.split(/\s+/).length * 4;
    });
  });

  describe('getModelLimit', () => {
    it('should return correct limit for gpt-3.5-turbo', () => {
      expect(TokenBudgetService.getModelLimit('gpt-3.5-turbo')).toBe(16385);
    });

    it('should return correct limit for gpt-4', () => {
      expect(TokenBudgetService.getModelLimit('gpt-4')).toBe(8192);
    });

    it('should return correct limit for gpt-4-turbo', () => {
      expect(TokenBudgetService.getModelLimit('gpt-4-turbo')).toBe(128000);
    });

    it('should return correct limit for gpt-4-32k', () => {
      expect(TokenBudgetService.getModelLimit('gpt-4-32k')).toBe(32768);
    });

    it('should infer limit from model name pattern', () => {
      expect(TokenBudgetService.getModelLimit('gpt-4-turbo-preview')).toBe(128000);
      expect(TokenBudgetService.getModelLimit('gpt-4o')).toBe(128000);
      expect(TokenBudgetService.getModelLimit('gpt-3.5-turbo-16k')).toBe(16385);
    });

    it('should return default limit for unknown model', () => {
      expect(TokenBudgetService.getModelLimit('unknown-model')).toBe(16385);
    });
  });

  describe('calculateBudget', () => {
    it('should calculate budget with default allocation', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
      });

      expect(budget.model).toBe('gpt-3.5-turbo');
      expect(budget.modelLimit).toBe(16385);
      expect(budget.allocations.documentContext).toBeGreaterThan(0);
      expect(budget.allocations.webResults).toBeGreaterThan(0);
      expect(budget.allocations.responseReserve).toBeGreaterThan(0);
    });

    it('should use custom allocation', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
        allocation: {
          documentContext: 0.6,
          webResults: 0.1,
        },
      });

      expect(budget.allocations.documentContext).toBeGreaterThan(
        budget.allocations.webResults
      );
    });

    it('should calculate system prompt tokens', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(budget.usage.systemPrompt).toBeGreaterThan(0);
      expect(budget.allocations.systemPrompt).toBeGreaterThan(0);
    });

    it('should calculate user prompt tokens', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
        userPrompt: 'What is the capital of France?',
      });

      expect(budget.usage.userPrompt).toBeGreaterThan(0);
      expect(budget.allocations.userPrompt).toBeGreaterThan(0);
    });

    it('should calculate available budget correctly', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
      });

      const totalAllocated =
        budget.allocations.documentContext +
        budget.allocations.webResults +
        budget.allocations.systemPrompt +
        budget.allocations.userPrompt +
        budget.allocations.responseReserve +
        budget.allocations.overhead;

      expect(totalAllocated).toBeLessThanOrEqual(budget.modelLimit);
    });

    it('should handle different models', () => {
      const budget1 = TokenBudgetService.calculateBudget({ model: 'gpt-3.5-turbo' });
      const budget2 = TokenBudgetService.calculateBudget({ model: 'gpt-4' });

      expect(budget1.modelLimit).not.toBe(budget2.modelLimit);
    });
  });

  describe('budget remaining', () => {
    it('should expose remaining budget from calculateBudget', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
        systemPrompt: 'System prompt',
        userPrompt: 'User question',
      });

      expect(budget.remaining.total).toBeGreaterThan(0);
      expect(budget.remaining.documentContext).toBeGreaterThan(0);
      expect(budget.remaining.webResults).toBeGreaterThan(0);
    });

    it('should reduce remaining when system/user prompts used', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
        systemPrompt: 'Long system prompt. '.repeat(20),
        userPrompt: 'User question with more text.',
      });

      expect(budget.usage.total).toBeGreaterThan(0);
      expect(budget.remaining.total).toBeLessThan(budget.modelLimit);
    });
  });

  describe('budget validation', () => {
    it('should have no warnings when within limits', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
      });

      expect(budget.warnings.length).toBe(0);
    });

    it('should add warnings when usage exceeds allocation', () => {
      const budget = TokenBudgetService.calculateBudget({
        model: 'gpt-3.5-turbo',
        systemPrompt: 'x '.repeat(50000),
        userPrompt: 'y '.repeat(50000),
      });

      expect(budget.warnings.length).toBeGreaterThan(0);
    });
  });
});
