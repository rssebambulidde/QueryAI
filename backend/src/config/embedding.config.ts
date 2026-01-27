/**
 * Embedding Model Configuration
 * Supports multiple OpenAI embedding models with different dimensions
 */

export type EmbeddingModel = 
  | 'text-embedding-3-small'  // 1536 dimensions (default, fast, cost-effective)
  | 'text-embedding-3-large'  // 3072 dimensions (higher accuracy)
  | 'text-embedding-ada-002'; // 1536 dimensions (legacy)

/**
 * Embedding model specifications
 */
export interface EmbeddingModelSpec {
  model: EmbeddingModel;
  dimensions: number;
  maxInputTokens: number;
  description: string;
  costPer1kTokens: number; // Approximate cost in USD per 1k tokens
  recommended: boolean;
}

/**
 * Available embedding models with their specifications
 */
export const EMBEDDING_MODELS: Record<EmbeddingModel, EmbeddingModelSpec> = {
  'text-embedding-3-small': {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    maxInputTokens: 8191,
    description: 'Fast, cost-effective embedding model. Good balance of speed and accuracy.',
    costPer1kTokens: 0.00002, // $0.02 per 1M tokens
    recommended: true, // Recommended for most use cases
  },
  'text-embedding-3-large': {
    model: 'text-embedding-3-large',
    dimensions: 3072,
    maxInputTokens: 8191,
    description: 'Higher accuracy embedding model with larger dimensions. Better for complex semantic tasks.',
    costPer1kTokens: 0.00013, // $0.13 per 1M tokens
    recommended: false, // Use when accuracy is critical
  },
  'text-embedding-ada-002': {
    model: 'text-embedding-ada-002',
    dimensions: 1536,
    maxInputTokens: 8191,
    description: 'Legacy embedding model. Use for backward compatibility only.',
    costPer1kTokens: 0.0001, // $0.10 per 1M tokens
    recommended: false, // Legacy, not recommended for new projects
  },
};

/**
 * Default embedding model
 */
export const DEFAULT_EMBEDDING_MODEL: EmbeddingModel = 'text-embedding-3-small';

/**
 * Get embedding model specification
 */
export function getEmbeddingModelSpec(model: EmbeddingModel = DEFAULT_EMBEDDING_MODEL): EmbeddingModelSpec {
  return EMBEDDING_MODELS[model] || EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL];
}

/**
 * Get embedding dimensions for a model
 */
export function getEmbeddingDimensions(model: EmbeddingModel = DEFAULT_EMBEDDING_MODEL): number {
  return getEmbeddingModelSpec(model).dimensions;
}

/**
 * Check if model supports dimension reduction
 * text-embedding-3-* models support dimension reduction via dimensions parameter
 */
export function supportsDimensionReduction(model: EmbeddingModel): boolean {
  return model.startsWith('text-embedding-3-');
}

/**
 * Get recommended model based on use case
 */
export function getRecommendedModel(useCase: 'speed' | 'accuracy' | 'cost' | 'balanced' = 'balanced'): EmbeddingModel {
  switch (useCase) {
    case 'speed':
    case 'cost':
      return 'text-embedding-3-small';
    case 'accuracy':
      return 'text-embedding-3-large';
    case 'balanced':
    default:
      return 'text-embedding-3-small';
  }
}

/**
 * Compare models for a use case
 */
export function compareModels(): {
  fastest: EmbeddingModel;
  mostAccurate: EmbeddingModel;
  mostCostEffective: EmbeddingModel;
  recommended: EmbeddingModel;
} {
  return {
    fastest: 'text-embedding-3-small',
    mostAccurate: 'text-embedding-3-large',
    mostCostEffective: 'text-embedding-3-small',
    recommended: DEFAULT_EMBEDDING_MODEL,
  };
}
