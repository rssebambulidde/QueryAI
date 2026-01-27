import {
  ContextSelectorService,
  ContextSelectionConfig,
  DEFAULT_CONTEXT_SELECTION_CONFIG,
} from '../services/context-selector.service';

describe('ContextSelectorService', () => {
  beforeEach(() => {
    // Reset to default config
    ContextSelectorService.setConfig(DEFAULT_CONTEXT_SELECTION_CONFIG);
  });

  describe('configuration', () => {
    it('should set and get configuration', () => {
      const customConfig: Partial<ContextSelectionConfig> = {
        minChunks: 5,
        maxChunks: 25,
        defaultChunks: 10,
      };

      ContextSelectorService.setConfig(customConfig);
      const config = ContextSelectorService.getConfig();

      expect(config.minChunks).toBe(5);
      expect(config.maxChunks).toBe(25);
      expect(config.defaultChunks).toBe(10);
      // Other values should remain from default
      expect(config.enabled).toBe(DEFAULT_CONTEXT_SELECTION_CONFIG.enabled);
    });

    it('should have valid default configuration', () => {
      const config = ContextSelectorService.getConfig();

      expect(config.minChunks).toBeGreaterThan(0);
      expect(config.maxChunks).toBeGreaterThan(config.minChunks);
      expect(config.defaultChunks).toBeGreaterThanOrEqual(config.minChunks);
      expect(config.defaultChunks).toBeLessThanOrEqual(config.maxChunks);
    });
  });

  describe('analyzeQueryComplexity', () => {
    it('should analyze simple queries', () => {
      const complexity = ContextSelectorService.analyzeQueryComplexity('What is AI?');

      expect(complexity.length).toBeGreaterThan(0);
      expect(complexity.wordCount).toBeGreaterThan(0);
      expect(complexity.keywordCount).toBeGreaterThanOrEqual(0);
      expect(complexity.intentComplexity).toBe('simple');
      expect(complexity.complexityScore).toBeLessThan(0.5);
    });

    it('should analyze complex queries', () => {
      const query = 'Explain in detail how machine learning neural networks work with deep learning algorithms and provide examples of real-world applications';
      const complexity = ContextSelectorService.analyzeQueryComplexity(query);

      expect(complexity.intentComplexity).toBe('complex');
      expect(complexity.complexityScore).toBeGreaterThan(0.6);
      expect(complexity.keywordCount).toBeGreaterThan(3);
    });

    it('should detect query type', () => {
      const factual = ContextSelectorService.analyzeQueryComplexity('What is machine learning?');
      const conceptual = ContextSelectorService.analyzeQueryComplexity('Explain neural networks');
      const exploratory = ContextSelectorService.analyzeQueryComplexity('Tell me about deep learning');

      expect(factual.queryType).toBe('factual');
      expect(conceptual.queryType).toBe('conceptual');
      expect(exploratory.queryType).toBe('exploratory');
    });

    it('should calculate complexity score', () => {
      const simple = ContextSelectorService.analyzeQueryComplexity('What is AI?');
      const complex = ContextSelectorService.analyzeQueryComplexity('Explain in detail how machine learning neural networks work with deep learning algorithms');

      expect(simple.complexityScore).toBeLessThan(complex.complexityScore);
      expect(simple.complexityScore).toBeGreaterThanOrEqual(0);
      expect(complex.complexityScore).toBeLessThanOrEqual(1);
    });

    it('should extract keywords correctly', () => {
      const complexity = ContextSelectorService.analyzeQueryComplexity('What is artificial intelligence and machine learning?');

      expect(complexity.keywordCount).toBeGreaterThan(0);
      expect(complexity.keywords).toContain('artificial');
      expect(complexity.keywords).toContain('intelligence');
      expect(complexity.keywords).toContain('machine');
      expect(complexity.keywords).toContain('learning');
    });
  });

  describe('selectContextSize', () => {
    it('should return default chunks when disabled', () => {
      ContextSelectorService.setConfig({ enabled: false });

      const result = ContextSelectorService.selectContextSize('What is AI?');

      expect(result.chunkCount).toBe(DEFAULT_CONTEXT_SELECTION_CONFIG.defaultChunks);
      expect(result.reasoning).toContain('disabled');
    });

    it('should return more chunks for complex queries', () => {
      const simple = ContextSelectorService.selectContextSize('What is AI?');
      const complex = ContextSelectorService.selectContextSize(
        'Explain in detail how machine learning neural networks work with deep learning algorithms and provide examples'
      );

      expect(complex.chunkCount).toBeGreaterThanOrEqual(simple.chunkCount);
    });

    it('should respect min and max chunks', () => {
      const result = ContextSelectorService.selectContextSize('What is AI?', {
        minChunks: 5,
        maxChunks: 15,
      });

      expect(result.chunkCount).toBeGreaterThanOrEqual(5);
      expect(result.chunkCount).toBeLessThanOrEqual(15);
    });

    it('should assign more chunks to exploratory queries', () => {
      const factual = ContextSelectorService.selectContextSize('What is machine learning?');
      const exploratory = ContextSelectorService.selectContextSize('Tell me about deep learning and neural networks');

      // Exploratory queries should get more chunks (has +3 adjustment)
      expect(exploratory.chunkCount).toBeGreaterThanOrEqual(factual.chunkCount);
    });

    it('should assign more chunks to conceptual queries', () => {
      const factual = ContextSelectorService.selectContextSize('What is AI?');
      const conceptual = ContextSelectorService.selectContextSize('Explain how neural networks work');

      // Conceptual queries should get more chunks (has +2 adjustment)
      expect(conceptual.chunkCount).toBeGreaterThanOrEqual(factual.chunkCount);
    });

    it('should adjust for query length', () => {
      const short = ContextSelectorService.selectContextSize('What is AI?');
      const long = ContextSelectorService.selectContextSize(
        'Explain in detail how machine learning neural networks work with deep learning algorithms and provide comprehensive examples of real-world applications'
      );

      // Long queries should get more chunks
      expect(long.chunkCount).toBeGreaterThanOrEqual(short.chunkCount);
    });

    it('should include reasoning', () => {
      const result = ContextSelectorService.selectContextSize('What is AI?');

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('chunk count');
    });

    it('should include complexity analysis', () => {
      const result = ContextSelectorService.selectContextSize('What is AI?');

      expect(result.complexity).toBeDefined();
      expect(result.complexity.intentComplexity).toBeDefined();
      expect(result.complexity.queryType).toBeDefined();
      expect(result.complexity.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.complexity.complexityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('getChunkCount', () => {
    it('should return chunk count number', () => {
      const count = ContextSelectorService.getChunkCount('What is AI?');

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });

    it('should respect configuration', () => {
      const count = ContextSelectorService.getChunkCount('What is AI?', {
        minChunks: 10,
        maxChunks: 20,
      });

      expect(count).toBeGreaterThanOrEqual(10);
      expect(count).toBeLessThanOrEqual(20);
    });
  });

  describe('isComplexQuery', () => {
    it('should identify simple queries as not complex', () => {
      expect(ContextSelectorService.isComplexQuery('What is AI?')).toBe(false);
    });

    it('should identify complex queries as complex', () => {
      const complexQuery = 'Explain in detail how machine learning neural networks work with deep learning algorithms';
      expect(ContextSelectorService.isComplexQuery(complexQuery)).toBe(true);
    });
  });

  describe('getChunkCountRange', () => {
    it('should return range with recommended value', () => {
      const range = ContextSelectorService.getChunkCountRange('What is AI?');

      expect(range.min).toBeGreaterThan(0);
      expect(range.max).toBeGreaterThan(range.min);
      expect(range.recommended).toBeGreaterThanOrEqual(range.min);
      expect(range.recommended).toBeLessThanOrEqual(range.max);
    });

    it('should respect configuration', () => {
      const range = ContextSelectorService.getChunkCountRange('What is AI?', {
        minChunks: 5,
        maxChunks: 20,
      });

      expect(range.min).toBeGreaterThanOrEqual(5);
      expect(range.max).toBeLessThanOrEqual(20);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', () => {
      const result = ContextSelectorService.selectContextSize('');

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.chunkCount).toBeLessThanOrEqual(DEFAULT_CONTEXT_SELECTION_CONFIG.maxChunks);
    });

    it('should handle very short query', () => {
      const result = ContextSelectorService.selectContextSize('AI?');

      expect(result.chunkCount).toBeGreaterThanOrEqual(DEFAULT_CONTEXT_SELECTION_CONFIG.minChunks);
    });

    it('should handle very long query', () => {
      const longQuery = 'word '.repeat(500);
      const result = ContextSelectorService.selectContextSize(longQuery);

      expect(result.chunkCount).toBeLessThanOrEqual(DEFAULT_CONTEXT_SELECTION_CONFIG.maxChunks);
      expect(result.complexity.length).toBeGreaterThan(100);
    });

    it('should handle special characters', () => {
      const result = ContextSelectorService.selectContextSize('What is AI? (with examples)');

      expect(result.chunkCount).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const result = ContextSelectorService.selectContextSize('What is AI? 🚀');

      expect(result.chunkCount).toBeGreaterThan(0);
    });
  });

  describe('query type adjustments', () => {
    it('should apply adjustments for different query types', () => {
      const factual = ContextSelectorService.selectContextSize('What is machine learning?');
      const conceptual = ContextSelectorService.selectContextSize('Explain neural networks');
      const procedural = ContextSelectorService.selectContextSize('How to train a model?');
      const exploratory = ContextSelectorService.selectContextSize('Tell me about deep learning');

      // Exploratory should get most chunks (+3)
      expect(exploratory.chunkCount).toBeGreaterThanOrEqual(conceptual.chunkCount);
      // Conceptual should get more than factual (+2 vs 0)
      expect(conceptual.chunkCount).toBeGreaterThanOrEqual(factual.chunkCount);
      // Procedural should get more than factual (+1 vs 0)
      expect(procedural.chunkCount).toBeGreaterThanOrEqual(factual.chunkCount);
    });
  });

  describe('complexity multipliers', () => {
    it('should apply simple query multiplier', () => {
      ContextSelectorService.setConfig({ simpleQueryMultiplier: 0.5 });
      const result = ContextSelectorService.selectContextSize('What is AI?');

      // Should be less than default due to 0.5 multiplier
      expect(result.chunkCount).toBeLessThan(DEFAULT_CONTEXT_SELECTION_CONFIG.defaultChunks);
    });

    it('should apply complex query multiplier', () => {
      ContextSelectorService.setConfig({ complexQueryMultiplier: 2.0 });
      const complexQuery = 'Explain in detail how machine learning neural networks work with deep learning algorithms';
      const result = ContextSelectorService.selectContextSize(complexQuery);

      // Should be more than default due to 2.0 multiplier
      expect(result.chunkCount).toBeGreaterThan(DEFAULT_CONTEXT_SELECTION_CONFIG.defaultChunks);
    });
  });
});
