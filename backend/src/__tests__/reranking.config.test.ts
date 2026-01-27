import {
  DEFAULT_RERANKING_CONFIG,
  CROSS_ENCODER_MODELS,
  getRerankingConfig,
  validateRerankingConfig,
} from '../config/reranking.config';
import { RerankingConfig } from '../config/reranking.config';

describe('Reranking Configuration', () => {
  describe('DEFAULT_RERANKING_CONFIG', () => {
    it('should have valid default configuration', () => {
      expect(DEFAULT_RERANKING_CONFIG.enabled).toBeDefined();
      expect(typeof DEFAULT_RERANKING_CONFIG.enabled).toBe('boolean');
      expect(DEFAULT_RERANKING_CONFIG.strategy).toBeDefined();
      expect(DEFAULT_RERANKING_CONFIG.topK).toBeGreaterThan(0);
      expect(DEFAULT_RERANKING_CONFIG.maxResults).toBeGreaterThan(0);
      expect(DEFAULT_RERANKING_CONFIG.maxResults).toBeLessThanOrEqual(DEFAULT_RERANKING_CONFIG.topK);
    });

    it('should have score weights defined', () => {
      expect(DEFAULT_RERANKING_CONFIG.scoreWeights).toBeDefined();
      expect(DEFAULT_RERANKING_CONFIG.scoreWeights?.semantic).toBeGreaterThan(0);
      expect(DEFAULT_RERANKING_CONFIG.scoreWeights?.keyword).toBeGreaterThan(0);
      expect(DEFAULT_RERANKING_CONFIG.scoreWeights?.length).toBeGreaterThan(0);
      expect(DEFAULT_RERANKING_CONFIG.scoreWeights?.position).toBeGreaterThan(0);
    });
  });

  describe('CROSS_ENCODER_MODELS', () => {
    it('should have ms-marco-MiniLM-L-6-v2 model', () => {
      const model = CROSS_ENCODER_MODELS['ms-marco-MiniLM-L-6-v2'];
      expect(model).toBeDefined();
      expect(model.name).toBe('ms-marco-MiniLM-L-6-v2');
      expect(model.maxLength).toBeGreaterThan(0);
      expect(typeof model.recommended).toBe('boolean');
    });

    it('should have ms-marco-MiniLM-L-12-v2 model', () => {
      const model = CROSS_ENCODER_MODELS['ms-marco-MiniLM-L-12-v2'];
      expect(model).toBeDefined();
      expect(model.name).toBe('ms-marco-MiniLM-L-12-v2');
    });
  });

  describe('getRerankingConfig', () => {
    it('should return default configuration', () => {
      const config = getRerankingConfig();
      expect(config).toEqual(DEFAULT_RERANKING_CONFIG);
    });
  });

  describe('validateRerankingConfig', () => {
    it('should validate correct configuration', () => {
      const config: RerankingConfig = {
        enabled: true,
        strategy: 'score-based',
        topK: 20,
        maxResults: 10,
      };
      expect(validateRerankingConfig(config)).toBe(true);
    });

    it('should reject invalid topK', () => {
      const config: RerankingConfig = {
        enabled: true,
        strategy: 'score-based',
        topK: 0,
        maxResults: 10,
      };
      expect(validateRerankingConfig(config)).toBe(false);
    });

    it('should reject invalid maxResults', () => {
      const config: RerankingConfig = {
        enabled: true,
        strategy: 'score-based',
        topK: 10,
        maxResults: 0,
      };
      expect(validateRerankingConfig(config)).toBe(false);
    });

    it('should reject maxResults > topK', () => {
      const config: RerankingConfig = {
        enabled: true,
        strategy: 'score-based',
        topK: 10,
        maxResults: 20, // More than topK
      };
      expect(validateRerankingConfig(config)).toBe(false);
    });

    it('should reject cross-encoder without model', () => {
      const config: RerankingConfig = {
        enabled: true,
        strategy: 'cross-encoder',
        topK: 20,
        maxResults: 10,
        // Missing crossEncoderModel
      };
      expect(validateRerankingConfig(config)).toBe(false);
    });

    it('should accept cross-encoder with model', () => {
      const config: RerankingConfig = {
        enabled: true,
        strategy: 'cross-encoder',
        topK: 20,
        maxResults: 10,
        crossEncoderModel: 'ms-marco-MiniLM-L-6-v2',
      };
      expect(validateRerankingConfig(config)).toBe(true);
    });
  });
});
