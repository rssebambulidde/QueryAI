import {
  ThresholdOptimizerService,
  QueryType,
  ScoreDistribution,
  ThresholdResult,
  DEFAULT_THRESHOLD_CONFIG,
} from '../services/threshold-optimizer.service';

describe('ThresholdOptimizerService', () => {
  beforeEach(() => {
    // Reset to default config
    ThresholdOptimizerService.setConfig(DEFAULT_THRESHOLD_CONFIG);
  });

  describe('detectQueryType', () => {
    it('should detect factual queries', () => {
      expect(ThresholdOptimizerService.detectQueryType('What is artificial intelligence?')).toBe('factual');
      expect(ThresholdOptimizerService.detectQueryType('Who invented the computer?')).toBe('factual');
      expect(ThresholdOptimizerService.detectQueryType('When did World War II end?')).toBe('factual');
      expect(ThresholdOptimizerService.detectQueryType('Where is the Eiffel Tower?')).toBe('factual');
      expect(ThresholdOptimizerService.detectQueryType('How many planets are there?')).toBe('factual');
      // "What does" should be conceptual, not factual
      expect(ThresholdOptimizerService.detectQueryType('What does quantum computing mean?')).toBe('conceptual');
    });

    it('should detect conceptual queries', () => {
      expect(ThresholdOptimizerService.detectQueryType('Explain machine learning')).toBe('conceptual');
      expect(ThresholdOptimizerService.detectQueryType('What does quantum computing mean?')).toBe('conceptual');
      expect(ThresholdOptimizerService.detectQueryType('Understand neural networks')).toBe('conceptual');
    });

    it('should detect procedural queries', () => {
      expect(ThresholdOptimizerService.detectQueryType('How to train a neural network?')).toBe('procedural');
      expect(ThresholdOptimizerService.detectQueryType('Steps to deploy an application')).toBe('procedural');
      expect(ThresholdOptimizerService.detectQueryType('How can I learn Python?')).toBe('procedural');
    });

    it('should detect exploratory queries', () => {
      expect(ThresholdOptimizerService.detectQueryType('Tell me about artificial intelligence')).toBe('exploratory');
      expect(ThresholdOptimizerService.detectQueryType('Learn about machine learning')).toBe('exploratory');
      expect(ThresholdOptimizerService.detectQueryType('Information about deep learning')).toBe('exploratory');
    });

    it('should return unknown for unrecognized queries', () => {
      expect(ThresholdOptimizerService.detectQueryType('Random text query')).toBe('unknown');
      expect(ThresholdOptimizerService.detectQueryType('Hello world')).toBe('unknown');
    });
  });

  describe('analyzeScoreDistribution', () => {
    it('should analyze score distribution correctly', () => {
      const scores = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3];
      const distribution = ThresholdOptimizerService.analyzeScoreDistribution(scores);

      expect(distribution.mean).toBeCloseTo(0.6, 1);
      expect(distribution.median).toBe(0.6);
      expect(distribution.min).toBe(0.3);
      expect(distribution.max).toBe(0.9);
      expect(distribution.percentiles.p25).toBeLessThanOrEqual(distribution.median);
      expect(distribution.percentiles.p75).toBeGreaterThanOrEqual(distribution.median);
    });

    it('should handle empty scores', () => {
      const distribution = ThresholdOptimizerService.analyzeScoreDistribution([]);

      expect(distribution.mean).toBe(0);
      expect(distribution.median).toBe(0);
      expect(distribution.scores.length).toBe(0);
    });

    it('should calculate percentiles correctly', () => {
      const scores = Array.from({ length: 100 }, (_, i) => i / 100); // 0.00 to 0.99
      const distribution = ThresholdOptimizerService.analyzeScoreDistribution(scores);

      expect(distribution.percentiles.p25).toBeCloseTo(0.25, 1);
      expect(distribution.percentiles.p50).toBeCloseTo(0.50, 1);
      expect(distribution.percentiles.p75).toBeCloseTo(0.75, 1);
      expect(distribution.percentiles.p90).toBeCloseTo(0.90, 1);
      expect(distribution.percentiles.p95).toBeCloseTo(0.95, 1);
    });
  });

  describe('calculateThreshold', () => {
    it('should return default threshold when adaptive is disabled', () => {
      ThresholdOptimizerService.setConfig({ adaptiveEnabled: false });
      
      const result = ThresholdOptimizerService.calculateThreshold('test query');
      
      expect(result.threshold).toBe(DEFAULT_THRESHOLD_CONFIG.defaultThreshold);
      expect(result.strategy).toBe('default');
    });

    it('should use query-type threshold for known query types', () => {
      const result = ThresholdOptimizerService.calculateThreshold('What is AI?');
      
      expect(result.queryType).toBe('factual');
      expect(result.strategy).toBe('query-type');
      expect(result.threshold).toBe(DEFAULT_THRESHOLD_CONFIG.queryTypeThresholds.factual);
    });

    it('should use distribution-based threshold when results provided', () => {
      const initialResults = [
        { score: 0.9 },
        { score: 0.8 },
        { score: 0.7 },
        { score: 0.6 },
        { score: 0.5 },
      ];

      const result = ThresholdOptimizerService.calculateThreshold('test query', initialResults);
      
      expect(result.strategy).toBe('distribution');
      expect(result.threshold).toBeGreaterThan(0);
      expect(result.threshold).toBeLessThanOrEqual(1);
    });

    it('should apply fallback for too few results', () => {
      ThresholdOptimizerService.setConfig({ fallbackEnabled: true });
      
      const initialResults = [{ score: 0.8 }]; // Only 1 result
      const result = ThresholdOptimizerService.calculateThreshold(
        'test query',
        initialResults,
        { minResults: 3 }
      );
      
      // Should lower threshold to get more results
      expect(result.strategy).toBe('fallback');
      expect(result.reasoning).toContain('Lowered threshold');
    });

    it('should apply fallback for too many results', () => {
      ThresholdOptimizerService.setConfig({ fallbackEnabled: true });
      
      const initialResults = Array.from({ length: 20 }, (_, i) => ({ score: 0.8 - i * 0.01 }));
      const result = ThresholdOptimizerService.calculateThreshold(
        'test query',
        initialResults,
        { maxResults: 5 }
      );
      
      // Should raise threshold to get fewer results
      expect(result.strategy).toBe('fallback');
      expect(result.reasoning).toContain('Raised threshold');
    });

    it('should respect min and max threshold bounds', () => {
      const config = { ...DEFAULT_THRESHOLD_CONFIG, minThreshold: 0.4, maxThreshold: 0.9 };
      ThresholdOptimizerService.setConfig(config);
      
      const result = ThresholdOptimizerService.calculateThreshold('test query');
      
      expect(result.threshold).toBeGreaterThanOrEqual(0.4);
      expect(result.threshold).toBeLessThanOrEqual(0.9);
    });
  });

  describe('getThreshold', () => {
    it('should return threshold number', () => {
      const threshold = ThresholdOptimizerService.getThreshold('What is AI?');
      
      expect(typeof threshold).toBe('number');
      expect(threshold).toBeGreaterThan(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });

    it('should use query type for threshold', () => {
      const factualThreshold = ThresholdOptimizerService.getThreshold('What is machine learning?');
      const exploratoryThreshold = ThresholdOptimizerService.getThreshold('Tell me about AI');
      
      // Factual queries should have higher threshold
      expect(factualThreshold).toBeGreaterThanOrEqual(exploratoryThreshold);
    });
  });

  describe('optimizeThreshold', () => {
    it('should optimize threshold iteratively', async () => {
      let callCount = 0;
      const searchFunction = async (threshold: number) => {
        callCount++;
        // Simulate: lower threshold = more results
        const resultCount = Math.floor((1 - threshold) * 10);
        return Array.from({ length: resultCount }, (_, i) => ({ score: 0.9 - i * 0.1 }));
      };

      const result = await ThresholdOptimizerService.optimizeThreshold(
        'test query',
        searchFunction,
        { minResults: 3, maxResults: 5 }
      );

      expect(callCount).toBeGreaterThan(0);
      expect(result.threshold).toBeGreaterThan(0);
      expect(result.strategy).toBe('adaptive');
    });

    it('should stop when results are in desired range', async () => {
      const searchFunction = async (threshold: number) => {
        // Always return 4 results (in range 3-5)
        return [
          { score: 0.9 },
          { score: 0.8 },
          { score: 0.7 },
          { score: 0.6 },
        ];
      };

      const result = await ThresholdOptimizerService.optimizeThreshold(
        'test query',
        searchFunction,
        { minResults: 3, maxResults: 5 }
      );

      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should respect max iterations', async () => {
      let callCount = 0;
      const searchFunction = async (threshold: number) => {
        callCount++;
        // Always return too many results to force iterations
        return Array.from({ length: 20 }, (_, i) => ({ score: 0.9 }));
      };

      await ThresholdOptimizerService.optimizeThreshold(
        'test query',
        searchFunction,
        { minResults: 3, maxResults: 5, maxIterations: 3 }
      );

      expect(callCount).toBeLessThanOrEqual(3);
    });
  });

  describe('configuration', () => {
    it('should set and get configuration', () => {
      const customConfig = {
        defaultThreshold: 0.8,
        adaptiveEnabled: false,
      };

      ThresholdOptimizerService.setConfig(customConfig);
      const config = ThresholdOptimizerService.getConfig();

      expect(config.defaultThreshold).toBe(0.8);
      expect(config.adaptiveEnabled).toBe(false);
      // Other values should remain from default
      expect(config.minThreshold).toBe(DEFAULT_THRESHOLD_CONFIG.minThreshold);
    });

    it('should have valid default configuration', () => {
      const config = ThresholdOptimizerService.getConfig();

      expect(config.defaultThreshold).toBeGreaterThan(0);
      expect(config.defaultThreshold).toBeLessThanOrEqual(1);
      expect(config.minThreshold).toBeLessThan(config.defaultThreshold);
      expect(config.maxThreshold).toBeGreaterThan(config.defaultThreshold);
      expect(Object.keys(config.queryTypeThresholds).length).toBeGreaterThan(0);
    });
  });
});
