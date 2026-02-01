import {
  EmbeddingModel,
  EMBEDDING_MODELS,
  DEFAULT_EMBEDDING_MODEL,
  getEmbeddingModelSpec,
  getEmbeddingDimensions,
  supportsDimensionReduction,
  getRecommendedModel,
  compareModels,
} from '../config/embedding.config';

describe('Embedding Configuration', () => {
  describe('EMBEDDING_MODELS', () => {
    it('should have all required models', () => {
      const models: EmbeddingModel[] = [
        'text-embedding-3-small',
        'text-embedding-3-large',
        'text-embedding-ada-002',
      ];

      models.forEach(model => {
        expect(EMBEDDING_MODELS[model]).toBeDefined();
        expect(EMBEDDING_MODELS[model].model).toBe(model);
        expect(EMBEDDING_MODELS[model].dimensions).toBeGreaterThan(0);
        expect(EMBEDDING_MODELS[model].maxInputTokens).toBeGreaterThan(0);
      });
    });

    it('should have correct dimensions for each model', () => {
      expect(EMBEDDING_MODELS['text-embedding-3-small'].dimensions).toBe(1536);
      expect(EMBEDDING_MODELS['text-embedding-3-large'].dimensions).toBe(3072);
      expect(EMBEDDING_MODELS['text-embedding-ada-002'].dimensions).toBe(1536);
    });

    it('should have cost information', () => {
      Object.values(EMBEDDING_MODELS).forEach(spec => {
        expect(spec.costPer1kTokens).toBeGreaterThan(0);
        expect(typeof spec.recommended).toBe('boolean');
      });
    });
  });

  describe('getEmbeddingModelSpec', () => {
    it('should return spec for valid model', () => {
      const spec = getEmbeddingModelSpec('text-embedding-3-small');
      expect(spec.model).toBe('text-embedding-3-small');
      expect(spec.dimensions).toBe(1536);
    });

    it('should return default for invalid model', () => {
      const spec = getEmbeddingModelSpec('invalid-model' as EmbeddingModel);
      expect(spec.model).toBe(DEFAULT_EMBEDDING_MODEL);
    });

    it('should return default when no model provided', () => {
      const spec = getEmbeddingModelSpec();
      expect(spec.model).toBe(DEFAULT_EMBEDDING_MODEL);
    });
  });

  describe('getEmbeddingDimensions', () => {
    it('should return correct dimensions for each model', () => {
      expect(getEmbeddingDimensions('text-embedding-3-small')).toBe(1536);
      expect(getEmbeddingDimensions('text-embedding-3-large')).toBe(3072);
      expect(getEmbeddingDimensions('text-embedding-ada-002')).toBe(1536);
    });

    it('should return default dimensions when no model provided', () => {
      const dimensions = getEmbeddingDimensions();
      expect(dimensions).toBe(1536); // Default model dimensions
    });
  });

  describe('supportsDimensionReduction', () => {
    it('should return true for text-embedding-3-* models', () => {
      expect(supportsDimensionReduction('text-embedding-3-small')).toBe(true);
      expect(supportsDimensionReduction('text-embedding-3-large')).toBe(true);
    });

    it('should return false for text-embedding-ada-002', () => {
      expect(supportsDimensionReduction('text-embedding-ada-002')).toBe(false);
    });
  });

  describe('getRecommendedModel', () => {
    it('should return appropriate model for each use case', () => {
      expect(getRecommendedModel('speed')).toBe('text-embedding-3-small');
      expect(getRecommendedModel('cost')).toBe('text-embedding-3-small');
      expect(getRecommendedModel('accuracy')).toBe('text-embedding-3-large');
      expect(getRecommendedModel('balanced')).toBe('text-embedding-3-small');
      expect(getRecommendedModel()).toBe('text-embedding-3-small');
    });
  });

  describe('compareModels', () => {
    it('should return comparison results', () => {
      const comparison = compareModels();
      
      expect(comparison.fastest).toBe('text-embedding-3-small');
      expect(comparison.mostAccurate).toBe('text-embedding-3-large');
      expect(comparison.mostCostEffective).toBe('text-embedding-3-small');
      expect(comparison.recommended).toBe(DEFAULT_EMBEDDING_MODEL);
    });
  });
});
