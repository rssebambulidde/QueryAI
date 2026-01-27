import { AdaptiveContextService } from '../services/adaptive-context.service';
import { ContextSelectorService } from '../services/context-selector.service';
import { TokenBudgetService } from '../services/token-budget.service';

jest.mock('../services/context-selector.service');
jest.mock('../services/token-budget.service');

describe('AdaptiveContextService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('selectAdaptiveContext', () => {
    it('should select context based on query complexity', () => {
      (ContextSelectorService.selectContextSize as jest.Mock).mockReturnValue({
        chunkCount: 5,
        complexity: {
          length: 50,
          wordCount: 10,
          keywordCount: 2,
          keywords: ['test'],
          intentComplexity: 'moderate',
          queryType: 'factual',
          complexityScore: 0.5,
        },
        reasoning: 'Moderate complexity query',
      });

      const result = AdaptiveContextService.selectAdaptiveContext({
        query: 'What is artificial intelligence?',
      });

      expect(result.documentChunks).toBeGreaterThan(0);
      expect(result.webResults).toBeGreaterThan(0);
      expect(result.complexity).toBeDefined();
    });

    it('should respect min and max constraints', () => {
      (ContextSelectorService.selectContextSize as jest.Mock).mockReturnValue({
        chunkCount: 2,
        complexity: {
          length: 10,
          wordCount: 2,
          keywordCount: 0,
          keywords: [],
          intentComplexity: 'simple',
          queryType: 'factual',
          complexityScore: 0.2,
        },
        reasoning: 'Simple query',
      });

      const result = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test',
        minDocumentChunks: 3,
        maxDocumentChunks: 10,
        minWebResults: 2,
        maxWebResults: 5,
      });

      expect(result.documentChunks).toBeGreaterThanOrEqual(3);
      expect(result.documentChunks).toBeLessThanOrEqual(10);
      expect(result.webResults).toBeGreaterThanOrEqual(2);
      expect(result.webResults).toBeLessThanOrEqual(5);
    });

    it('should prefer documents when preferDocuments is true', () => {
      (ContextSelectorService.selectContextSize as jest.Mock).mockReturnValue({
        chunkCount: 5,
        complexity: {
          length: 50,
          wordCount: 10,
          keywordCount: 2,
          keywords: ['test'],
          intentComplexity: 'moderate',
          queryType: 'factual',
          complexityScore: 0.5,
        },
        reasoning: 'Moderate complexity',
      });

      const result1 = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
        preferDocuments: false,
      });

      const result2 = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
        preferDocuments: true,
      });

      expect(result2.documentChunks).toBeGreaterThanOrEqual(result1.documentChunks);
      expect(result2.webResults).toBeLessThanOrEqual(result1.webResults);
    });

    it('should prefer web when preferWeb is true', () => {
      (ContextSelectorService.selectContextSize as jest.Mock).mockReturnValue({
        chunkCount: 5,
        complexity: {
          length: 50,
          wordCount: 10,
          keywordCount: 2,
          keywords: ['test'],
          intentComplexity: 'moderate',
          queryType: 'factual',
          complexityScore: 0.5,
        },
        reasoning: 'Moderate complexity',
      });

      const result1 = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
        preferWeb: false,
      });

      const result2 = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
        preferWeb: true,
      });

      expect(result2.webResults).toBeGreaterThanOrEqual(result1.webResults);
    });

    it('should use token budget when provided', () => {
      const mockBudget = {
        model: 'gpt-3.5-turbo',
        modelLimit: 16385,
        availableBudget: 10000,
        allocations: {
          documentContext: 5000,
          webResults: 2000,
          systemPrompt: 500,
          userPrompt: 500,
          responseReserve: 1500,
          overhead: 500,
        },
        usage: {
          documentContext: 0,
          webResults: 0,
          systemPrompt: 0,
          userPrompt: 0,
          total: 0,
        },
        remaining: {
          documentContext: 5000,
          webResults: 2000,
          total: 10000,
        },
        warnings: [],
      };

      (ContextSelectorService.selectContextSize as jest.Mock).mockReturnValue({
        chunkCount: 10,
        complexity: {
          length: 50,
          wordCount: 10,
          keywordCount: 2,
          keywords: ['test'],
          intentComplexity: 'moderate',
          queryType: 'factual',
          complexityScore: 0.5,
        },
        reasoning: 'Moderate complexity',
      });

      const result = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
        tokenBudget: mockBudget as any,
      });

      expect(result.tokenBudget).toBeDefined();
      expect(result.reasoning).toContain('token');
    });

    it('should calculate token budget when tokenBudgetOptions provided', () => {
      (TokenBudgetService.calculateBudget as jest.Mock).mockReturnValue({
        allocations: {
          documentContext: 5000,
          webResults: 2000,
        },
        remaining: {
          documentContext: 5000,
          webResults: 2000,
          total: 7000,
        },
      });

      (ContextSelectorService.selectContextSize as jest.Mock).mockReturnValue({
        chunkCount: 5,
        complexity: {
          length: 50,
          wordCount: 10,
          keywordCount: 2,
          keywords: ['test'],
          intentComplexity: 'moderate',
          queryType: 'factual',
          complexityScore: 0.5,
        },
        reasoning: 'Moderate complexity',
      });

      const result = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
        model: 'gpt-3.5-turbo',
        tokenBudgetOptions: {
          model: 'gpt-3.5-turbo',
        },
      });

      expect(TokenBudgetService.calculateBudget).toHaveBeenCalled();
      expect(result.tokenBudget).toBeDefined();
    });

    it('should disable complexity analysis when disabled', () => {
      const result = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
        enableComplexityAnalysis: false,
      });

      expect(result.complexity).toBeDefined();
      expect(result.complexity.intentComplexity).toBe('moderate');
      expect(ContextSelectorService.selectContextSize).not.toHaveBeenCalled();
    });

    it('should provide reasoning for selection', () => {
      (ContextSelectorService.selectContextSize as jest.Mock).mockReturnValue({
        chunkCount: 5,
        complexity: {
          length: 50,
          wordCount: 10,
          keywordCount: 2,
          keywords: ['test'],
          intentComplexity: 'moderate',
          queryType: 'factual',
          complexityScore: 0.5,
        },
        reasoning: 'Moderate complexity',
      });

      const result = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
      });

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should include adjustment details', () => {
      (ContextSelectorService.selectContextSize as jest.Mock).mockReturnValue({
        chunkCount: 5,
        complexity: {
          length: 50,
          wordCount: 10,
          keywordCount: 2,
          keywords: ['test'],
          intentComplexity: 'moderate',
          queryType: 'factual',
          complexityScore: 0.5,
        },
        reasoning: 'Moderate complexity',
      });

      const result = AdaptiveContextService.selectAdaptiveContext({
        query: 'Test query',
      });

      expect(result.adjustments).toBeDefined();
      expect(result.adjustments.complexityBased).toBeDefined();
      expect(result.adjustments.tokenBased).toBeDefined();
      expect(result.adjustments.balanceBased).toBeDefined();
    });
  });
});
