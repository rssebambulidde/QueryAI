/**
 * Re-ranking Configuration
 * Configuration for cross-encoder re-ranking of search results
 */

export type RerankingStrategy = 'cross-encoder' | 'score-based' | 'hybrid' | 'none';

export interface RerankingConfig {
  enabled: boolean; // Enable/disable re-ranking
  strategy: RerankingStrategy; // Re-ranking strategy
  topK: number; // Number of results to re-rank (re-rank top-K from initial retrieval)
  maxResults: number; // Maximum results to return after re-ranking
  minScore?: number; // Minimum score threshold after re-ranking
  // Cross-encoder specific settings (Cohere Rerank)
  cohereModel?: string; // Cohere model name (default: 'rerank-v3.5')
  crossEncoderModel?: string; // Legacy – unused, kept for back-compat
  crossEncoderApiUrl?: string; // Legacy – unused
  batchSize?: number; // Batch size for re-ranking (for performance)
  // Score-based settings
  scoreWeights?: {
    semantic: number; // Weight for semantic score
    keyword: number; // Weight for keyword score
    length: number; // Weight for document length (shorter = better)
    position: number; // Weight for original position
  };
}

/**
 * Default re-ranking configuration
 */
export const DEFAULT_RERANKING_CONFIG: RerankingConfig = {
  enabled: false, // Disabled by default for backward compatibility
  strategy: 'score-based', // Use score-based as default (can be extended to cross-encoder)
  topK: 20, // Re-rank top 20 results from initial retrieval
  maxResults: 10, // Return top 10 after re-ranking
  minScore: 0.3, // Minimum score threshold
  cohereModel: 'rerank-v3.5', // Cohere rerank model
  batchSize: 10, // Process 10 query-document pairs at a time
  scoreWeights: {
    semantic: 0.4,
    keyword: 0.3,
    length: 0.2, // Prefer shorter documents (inverse)
    position: 0.1, // Slight preference for original position
  },
};

/**
 * Cross-encoder model configurations
 */
export const CROSS_ENCODER_MODELS: Record<string, {
  name: string;
  description: string;
  maxLength: number; // Max input length
  recommended: boolean;
}> = {
  'ms-marco-MiniLM-L-6-v2': {
    name: 'ms-marco-MiniLM-L-6-v2',
    description: 'Microsoft MS MARCO cross-encoder model (fast, good performance)',
    maxLength: 512,
    recommended: true,
  },
  'ms-marco-MiniLM-L-12-v2': {
    name: 'ms-marco-MiniLM-L-12-v2',
    description: 'Microsoft MS MARCO cross-encoder model (slower, better performance)',
    maxLength: 512,
    recommended: false,
  },
};

/**
 * Get re-ranking configuration
 */
export function getRerankingConfig(): RerankingConfig {
  // In the future, this could read from environment variables or database
  return DEFAULT_RERANKING_CONFIG;
}

/**
 * Validate re-ranking configuration
 */
export function validateRerankingConfig(config: RerankingConfig): boolean {
  if (config.topK <= 0 || config.maxResults <= 0) {
    return false;
  }
  
  if (config.maxResults > config.topK) {
    return false; // Can't return more results than we re-rank
  }
  
  // Cross-encoder (Cohere) just needs the API key at runtime; no model field required here
  return true;
}
