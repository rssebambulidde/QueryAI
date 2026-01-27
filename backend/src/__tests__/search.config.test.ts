import {
  DEFAULT_HYBRID_WEIGHTS,
  WEIGHT_PRESETS,
  DEFAULT_HYBRID_SEARCH_CONFIG,
  DEFAULT_AB_TEST_CONFIG,
  getWeightsForPreset,
  validateWeights,
  normalizeWeights,
  selectABTestVariant,
} from '../config/search.config';
import { HybridSearchWeights } from '../config/search.config';

describe('Search Configuration', () => {
  describe('DEFAULT_HYBRID_WEIGHTS', () => {
    it('should have valid default weights', () => {
      expect(DEFAULT_HYBRID_WEIGHTS.semantic).toBeGreaterThan(0);
      expect(DEFAULT_HYBRID_WEIGHTS.keyword).toBeGreaterThan(0);
      expect(DEFAULT_HYBRID_WEIGHTS.semantic + DEFAULT_HYBRID_WEIGHTS.keyword).toBeLessThanOrEqual(2);
    });
  });

  describe('WEIGHT_PRESETS', () => {
    it('should have valid weight presets', () => {
      expect(WEIGHT_PRESETS.balanced).toBeDefined();
      expect(WEIGHT_PRESETS.semanticHeavy).toBeDefined();
      expect(WEIGHT_PRESETS.keywordHeavy).toBeDefined();
      expect(WEIGHT_PRESETS.equal).toBeDefined();
    });

    it('should have balanced preset with 60/40 split', () => {
      const balanced = WEIGHT_PRESETS.balanced;
      expect(balanced.semantic).toBe(0.6);
      expect(balanced.keyword).toBe(0.4);
    });

    it('should have semanticHeavy preset', () => {
      const semanticHeavy = WEIGHT_PRESETS.semanticHeavy;
      expect(semanticHeavy.semantic).toBeGreaterThan(semanticHeavy.keyword);
    });

    it('should have keywordHeavy preset', () => {
      const keywordHeavy = WEIGHT_PRESETS.keywordHeavy;
      expect(keywordHeavy.keyword).toBeGreaterThan(keywordHeavy.semantic);
    });

    it('should have equal preset with 50/50 split', () => {
      const equal = WEIGHT_PRESETS.equal;
      expect(equal.semantic).toBe(0.5);
      expect(equal.keyword).toBe(0.5);
    });
  });

  describe('getWeightsForPreset', () => {
    it('should return weights for valid preset', () => {
      const weights = getWeightsForPreset('balanced');
      expect(weights.semantic).toBe(0.6);
      expect(weights.keyword).toBe(0.4);
    });

    it('should return default weights for invalid preset', () => {
      const weights = getWeightsForPreset('invalid');
      expect(weights).toEqual(DEFAULT_HYBRID_WEIGHTS);
    });
  });

  describe('validateWeights', () => {
    it('should validate correct weights', () => {
      const weights: HybridSearchWeights = { semantic: 0.6, keyword: 0.4 };
      expect(validateWeights(weights)).toBe(true);
    });

    it('should reject negative weights', () => {
      const weights: HybridSearchWeights = { semantic: -0.1, keyword: 0.4 };
      expect(validateWeights(weights)).toBe(false);
    });

    it('should reject weights greater than 1', () => {
      const weights: HybridSearchWeights = { semantic: 1.5, keyword: 0.4 };
      expect(validateWeights(weights)).toBe(false);
    });

    it('should accept weights that sum to any value', () => {
      const weights: HybridSearchWeights = { semantic: 0.8, keyword: 0.4 }; // Sum = 1.2
      expect(validateWeights(weights)).toBe(true);
    });
  });

  describe('normalizeWeights', () => {
    it('should normalize weights to sum to 1', () => {
      const weights: HybridSearchWeights = { semantic: 0.8, keyword: 0.4 }; // Sum = 1.2
      const normalized = normalizeWeights(weights);
      expect(normalized.semantic + normalized.keyword).toBeCloseTo(1.0, 2);
    });

    it('should handle weights that already sum to 1', () => {
      const weights: HybridSearchWeights = { semantic: 0.6, keyword: 0.4 };
      const normalized = normalizeWeights(weights);
      expect(normalized.semantic).toBeCloseTo(0.6, 2);
      expect(normalized.keyword).toBeCloseTo(0.4, 2);
    });

    it('should return default weights when sum is 0', () => {
      const weights: HybridSearchWeights = { semantic: 0, keyword: 0 };
      const normalized = normalizeWeights(weights);
      expect(normalized).toEqual(DEFAULT_HYBRID_WEIGHTS);
    });
  });

  describe('selectABTestVariant', () => {
    it('should return default weights when A/B testing is disabled', () => {
      const config = { ...DEFAULT_AB_TEST_CONFIG, enabled: false };
      const weights = selectABTestVariant('user1', config);
      expect(weights).toEqual(DEFAULT_HYBRID_WEIGHTS);
    });

    it('should return same variant for same user', () => {
      const config = { ...DEFAULT_AB_TEST_CONFIG, enabled: true };
      const weights1 = selectABTestVariant('user1', config);
      const weights2 = selectABTestVariant('user1', config);
      expect(weights1).toEqual(weights2);
    });

    it('should return valid weights when A/B testing is enabled', () => {
      const config = { ...DEFAULT_AB_TEST_CONFIG, enabled: true };
      const weights = selectABTestVariant('user1', config);
      expect(weights.semantic).toBeGreaterThan(0);
      expect(weights.keyword).toBeGreaterThan(0);
      expect(weights.semantic).toBeLessThanOrEqual(1);
      expect(weights.keyword).toBeLessThanOrEqual(1);
    });

    it('should distribute users across variants', () => {
      const config = { ...DEFAULT_AB_TEST_CONFIG, enabled: true };
      const variants = new Set<string>();
      
      // Test multiple users to see variant distribution
      for (let i = 0; i < 100; i++) {
        const weights = selectABTestVariant(`user${i}`, config);
        const variantKey = `${weights.semantic}_${weights.keyword}`;
        variants.add(variantKey);
      }

      // Should have multiple variants (at least 2)
      expect(variants.size).toBeGreaterThan(1);
    });
  });

  describe('DEFAULT_HYBRID_SEARCH_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_HYBRID_SEARCH_CONFIG.defaultWeights).toBeDefined();
      expect(DEFAULT_HYBRID_SEARCH_CONFIG.minScoreThreshold).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_HYBRID_SEARCH_CONFIG.maxResults).toBeGreaterThan(0);
      expect(typeof DEFAULT_HYBRID_SEARCH_CONFIG.enableDeduplication).toBe('boolean');
      expect(DEFAULT_HYBRID_SEARCH_CONFIG.deduplicationThreshold).toBeGreaterThan(0);
      expect(DEFAULT_HYBRID_SEARCH_CONFIG.deduplicationThreshold).toBeLessThanOrEqual(1);
    });
  });

  describe('DEFAULT_AB_TEST_CONFIG', () => {
    it('should have valid A/B test configuration', () => {
      expect(DEFAULT_AB_TEST_CONFIG.variants.length).toBeGreaterThan(0);
      expect(DEFAULT_AB_TEST_CONFIG.defaultVariant).toBeDefined();
      
      // Check that traffic percentages sum to 100
      const totalTraffic = DEFAULT_AB_TEST_CONFIG.variants.reduce(
        (sum, v) => sum + v.trafficPercentage,
        0
      );
      expect(totalTraffic).toBe(100);
    });
  });
});
