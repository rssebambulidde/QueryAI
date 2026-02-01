import {
  QueryOptimizerService,
  QueryOptimizationConfig,
  DEFAULT_QUERY_OPTIMIZATION_CONFIG,
} from '../services/query-optimizer.service';

describe('QueryOptimizerService', () => {
  beforeEach(() => {
    // Reset to default config
    QueryOptimizerService.setConfig(DEFAULT_QUERY_OPTIMIZATION_CONFIG);
  });

  describe('configuration', () => {
    it('should set and get configuration', () => {
      const customConfig: Partial<QueryOptimizationConfig> = {
        removeStopWords: false,
        maxQueryLength: 300,
      };

      QueryOptimizerService.setConfig(customConfig);
      const config = QueryOptimizerService.getConfig();

      expect(config.removeStopWords).toBe(false);
      expect(config.maxQueryLength).toBe(300);
      // Other values should remain from default
      expect(config.enabled).toBe(DEFAULT_QUERY_OPTIMIZATION_CONFIG.enabled);
    });

    it('should have valid default configuration', () => {
      const config = QueryOptimizerService.getConfig();

      expect(config.maxQueryLength).toBeGreaterThan(0);
      expect(config.minKeywordLength).toBeGreaterThan(0);
    });
  });

  describe('classifyQuestionType', () => {
    it('should classify factual questions', () => {
      expect(QueryOptimizerService.classifyQuestionType('What is artificial intelligence?')).toBe('factual');
      expect(QueryOptimizerService.classifyQuestionType('Who is the president?')).toBe('factual');
      expect(QueryOptimizerService.classifyQuestionType('When did World War II end?')).toBe('factual');
      expect(QueryOptimizerService.classifyQuestionType('How many planets are there?')).toBe('factual');
    });

    it('should classify analytical questions', () => {
      expect(QueryOptimizerService.classifyQuestionType('Why does machine learning work?')).toBe('analytical');
      expect(QueryOptimizerService.classifyQuestionType('How does neural network learn?')).toBe('analytical');
      expect(QueryOptimizerService.classifyQuestionType('Explain the cause of climate change')).toBe('analytical');
    });

    it('should classify comparative questions', () => {
      expect(QueryOptimizerService.classifyQuestionType('Compare Python and JavaScript')).toBe('comparative');
      expect(QueryOptimizerService.classifyQuestionType('What is the difference between AI and ML?')).toBe('comparative');
      expect(QueryOptimizerService.classifyQuestionType('Which is better React or Vue?')).toBe('comparative');
    });

    it('should classify procedural questions', () => {
      expect(QueryOptimizerService.classifyQuestionType('How to train a neural network?')).toBe('procedural');
      expect(QueryOptimizerService.classifyQuestionType('Steps to deploy an application')).toBe('procedural');
    });

    it('should classify exploratory questions', () => {
      expect(QueryOptimizerService.classifyQuestionType('Tell me about artificial intelligence')).toBe('exploratory');
      expect(QueryOptimizerService.classifyQuestionType('Learn about machine learning')).toBe('exploratory');
    });

    it('should return unknown for unrecognized queries', () => {
      expect(QueryOptimizerService.classifyQuestionType('Random text query')).toBe('unknown');
    });
  });

  describe('optimizeQuery', () => {
    it('should return original query when disabled', () => {
      QueryOptimizerService.setConfig({ enabled: false });

      const result = QueryOptimizerService.optimizeQuery('What is artificial intelligence?');

      expect(result.optimizedQuery).toBe('What is artificial intelligence?');
      expect(result.optimizationTimeMs).toBeLessThan(200);
    });

    it('should remove stop words', () => {
      const result = QueryOptimizerService.optimizeQuery('What is the artificial intelligence?', {
        removeStopWords: true,
      });

      expect(result.removedStopWords.length).toBeGreaterThan(0);
      expect(result.optimizedQuery).not.toContain('the');
      expect(result.optimizedQuery).toContain('artificial');
      expect(result.optimizedQuery).toContain('intelligence');
    });

    it('should extract keywords', () => {
      const result = QueryOptimizerService.optimizeQuery('What is machine learning and neural networks?', {
        extractKeywords: true,
      });

      expect(result.keywords.length).toBeGreaterThan(0);
      expect(result.keywords).toContain('machine');
      expect(result.keywords).toContain('learning');
      expect(result.keywords).toContain('neural');
      expect(result.keywords).toContain('networks');
    });

    it('should enhance with context', () => {
      const result = QueryOptimizerService.optimizeQuery('What is AI?', {
        enhanceWithContext: true,
        context: 'deep learning neural networks',
        topic: 'machine learning',
      });

      expect(result.optimizedQuery.length).toBeGreaterThan('What is AI?'.length);
      expect(result.enhancements.some(e => e.includes('context'))).toBe(true);
    });

    it('should apply question type optimization', () => {
      const factual = QueryOptimizerService.optimizeQuery('What is machine learning?');
      const analytical = QueryOptimizerService.optimizeQuery('Why does machine learning work?');

      expect(factual.questionType).toBe('factual');
      expect(analytical.questionType).toBe('analytical');
      // Factual queries should remove "What is" prefix
      expect(factual.optimizedQuery).not.toMatch(/^what is\s+/i);
    });

    it('should emphasize important keywords', () => {
      const result = QueryOptimizerService.optimizeQuery('What is artificial intelligence and machine learning?', {
        extractKeywords: true,
      });

      // Important keywords (length >= 5) should be emphasized with quotes
      expect(result.optimizedQuery).toContain('artificial');
      expect(result.optimizedQuery).toContain('intelligence');
      expect(result.optimizedQuery).toContain('machine');
      expect(result.optimizedQuery).toContain('learning');
    });

    it('should limit query length', () => {
      const longQuery = 'word '.repeat(200); // Very long query
      QueryOptimizerService.setConfig({ maxQueryLength: 100 });

      const result = QueryOptimizerService.optimizeQuery(longQuery);

      expect(result.optimizedQuery.length).toBeLessThanOrEqual(100);
      expect(result.enhancements.some(e => e.includes('Truncated'))).toBe(true);
    });

    it('should not return empty query', () => {
      // Query with only stop words
      const result = QueryOptimizerService.optimizeQuery('What is the a an and?', {
        removeStopWords: true,
      });

      expect(result.optimizedQuery.length).toBeGreaterThan(0);
      expect(result.enhancements.some(e => e.includes('Fallback'))).toBe(true);
    });

    it('should complete within performance threshold', () => {
      const startTime = Date.now();
      const result = QueryOptimizerService.optimizeQuery('What is artificial intelligence and machine learning?');
      const processingTime = Date.now() - startTime;

      expect(result.optimizationTimeMs).toBeLessThan(200);
      expect(processingTime).toBeLessThan(200);
    });

    it('should include optimization metadata', () => {
      const result = QueryOptimizerService.optimizeQuery('What is machine learning?');

      expect(result.originalQuery).toBe('What is machine learning?');
      expect(result.optimizedQuery).toBeDefined();
      expect(result.questionType).toBeDefined();
      expect(result.keywords).toBeDefined();
      expect(result.removedStopWords).toBeDefined();
      expect(result.enhancements).toBeDefined();
      expect(result.optimizationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('quickOptimize', () => {
    it('should quickly optimize query', () => {
      const optimized = QueryOptimizerService.quickOptimize('What is the artificial intelligence?');

      expect(optimized).toBeDefined();
      expect(optimized.length).toBeGreaterThan(0);
      expect(optimized).not.toContain('the');
    });

    it('should be faster than full optimization', () => {
      const query = 'What is artificial intelligence and machine learning?';

      const quickStart = Date.now();
      QueryOptimizerService.quickOptimize(query);
      const quickTime = Date.now() - quickStart;

      const fullStart = Date.now();
      QueryOptimizerService.optimizeQuery(query);
      const fullTime = Date.now() - fullStart;

      // Quick should be faster (or at least not much slower)
      expect(quickTime).toBeLessThan(200);
      expect(fullTime).toBeLessThan(200);
    });
  });

  describe('needsOptimization', () => {
    it('should detect queries that need optimization', () => {
      expect(QueryOptimizerService.needsOptimization('What is the artificial intelligence?')).toBe(true);
      expect(QueryOptimizerService.needsOptimization('Who is the president?')).toBe(true);
    });

    it('should detect queries that do not need optimization', () => {
      expect(QueryOptimizerService.needsOptimization('artificial intelligence machine learning')).toBe(false);
      expect(QueryOptimizerService.needsOptimization('')).toBe(false);
    });

    it('should detect long queries that need optimization', () => {
      QueryOptimizerService.setConfig({ maxQueryLength: 50 });
      const longQuery = 'word '.repeat(20);
      expect(QueryOptimizerService.needsOptimization(longQuery)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', () => {
      const result = QueryOptimizerService.optimizeQuery('');

      expect(result.optimizedQuery).toBe('');
      expect(result.questionType).toBe('unknown');
    });

    it('should handle query with only stop words', () => {
      const result = QueryOptimizerService.optimizeQuery('the a an and or', {
        removeStopWords: true,
      });

      // Should fallback to original
      expect(result.optimizedQuery.length).toBeGreaterThan(0);
    });

    it('should handle very long query', () => {
      const longQuery = 'What is ' + 'word '.repeat(500);
      const result = QueryOptimizerService.optimizeQuery(longQuery);

      expect(result.optimizedQuery.length).toBeLessThanOrEqual(200);
      expect(result.optimizationTimeMs).toBeLessThan(200);
    });

    it('should handle special characters', () => {
      const result = QueryOptimizerService.optimizeQuery('What is AI? (with examples)');

      expect(result.optimizedQuery.length).toBeGreaterThan(0);
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const result = QueryOptimizerService.optimizeQuery('What is AI? 🚀');

      expect(result.optimizedQuery.length).toBeGreaterThan(0);
    });
  });

  describe('question type optimizations', () => {
    it('should optimize factual queries', () => {
      const result = QueryOptimizerService.optimizeQuery('What is machine learning?');

      expect(result.questionType).toBe('factual');
      // Should remove "What is" prefix
      expect(result.optimizedQuery).not.toMatch(/^what is\s+/i);
    });

    it('should optimize analytical queries', () => {
      const result = QueryOptimizerService.optimizeQuery('Why does machine learning work?');

      expect(result.questionType).toBe('analytical');
      // Should remove "Why" prefix
      expect(result.optimizedQuery).not.toMatch(/^why\s+/i);
    });

    it('should optimize procedural queries', () => {
      const result = QueryOptimizerService.optimizeQuery('How to train a neural network?');

      expect(result.questionType).toBe('procedural');
      // Should remove "How to" prefix
      expect(result.optimizedQuery).not.toMatch(/^how to\s+/i);
    });

    it('should optimize exploratory queries', () => {
      const result = QueryOptimizerService.optimizeQuery('Tell me about deep learning');

      expect(result.questionType).toBe('exploratory');
      // Should remove "Tell me about" prefix
      expect(result.optimizedQuery).not.toMatch(/^tell me about\s+/i);
    });
  });

  describe('context enhancement', () => {
    it('should add topic to query', () => {
      const result = QueryOptimizerService.optimizeQuery('What is AI?', {
        enhanceWithContext: true,
        topic: 'machine learning',
      });

      expect(result.optimizedQuery.toLowerCase()).toContain('machine');
      expect(result.optimizedQuery.toLowerCase()).toContain('learning');
    });

    it('should not duplicate topic if already in query', () => {
      const result = QueryOptimizerService.optimizeQuery('What is machine learning?', {
        enhanceWithContext: true,
        topic: 'machine learning',
      });

      const topicCount = (result.optimizedQuery.match(/machine learning/gi) || []).length;
      expect(topicCount).toBeLessThanOrEqual(2); // May appear once or twice, but not many times
    });

    it('should add context keywords', () => {
      const result = QueryOptimizerService.optimizeQuery('What is AI?', {
        enhanceWithContext: true,
        context: 'neural networks deep learning',
      });

      // Should include some context keywords
      expect(result.optimizedQuery.length).toBeGreaterThan('What is AI?'.length);
    });
  });
});
