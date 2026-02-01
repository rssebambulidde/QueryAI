/**
 * Search Configuration
 * Configuration for hybrid search, weights, and A/B testing
 */

export interface HybridSearchWeights {
  semantic: number; // Weight for semantic search (0.0 - 1.0)
  keyword: number; // Weight for keyword search (0.0 - 1.0)
}

export interface HybridSearchConfig {
  defaultWeights: HybridSearchWeights;
  minScoreThreshold: number; // Minimum combined score to include result
  maxResults: number; // Maximum results to return
  enableDeduplication: boolean; // Enable result deduplication
  deduplicationThreshold: number; // Similarity threshold for deduplication (0.0 - 1.0)
  enableABTesting: boolean; // Enable A/B testing for weight optimization
  abTestVariants: HybridSearchWeights[]; // A/B test weight variants
}

export interface ABTestConfig {
  enabled: boolean;
  variants: Array<{
    name: string;
    weights: HybridSearchWeights;
    trafficPercentage: number; // 0-100
  }>;
  defaultVariant: string; // Default variant name
}

export interface DomainAuthorityConfig {
  // Weight for domain authority in search ranking (0-1)
  authorityWeight?: number; // Default: 0.3
  // Minimum authority score to boost (0-1)
  minAuthorityScore?: number; // Default: 0.5
  // Boost factor for high-authority domains
  highAuthorityBoost?: number; // Default: 1.2
  // Penalty factor for low-authority domains
  lowAuthorityPenalty?: number; // Default: 0.9
  // Enable domain authority scoring
  enabled?: boolean; // Default: true
  // Custom domain overrides (domain -> score)
  customDomainScores?: Record<string, number>;
  // Filter results by minimum authority score
  filterByAuthority?: boolean; // Default: false
  // Minimum authority score for filtering (0-1)
  minAuthorityFilter?: number; // Default: 0.3
}

/**
 * Default hybrid search weights
 * Balanced: 60% semantic, 40% keyword
 */
export const DEFAULT_HYBRID_WEIGHTS: HybridSearchWeights = {
  semantic: 0.6,
  keyword: 0.4,
};

/**
 * Alternative weight configurations for different use cases
 */
export const WEIGHT_PRESETS: Record<string, HybridSearchWeights> = {
  balanced: { semantic: 0.6, keyword: 0.4 },
  semanticHeavy: { semantic: 0.8, keyword: 0.2 },
  keywordHeavy: { semantic: 0.3, keyword: 0.7 },
  equal: { semantic: 0.5, keyword: 0.5 },
};

/**
 * Default hybrid search configuration
 */
export const DEFAULT_HYBRID_SEARCH_CONFIG: HybridSearchConfig = {
  defaultWeights: DEFAULT_HYBRID_WEIGHTS,
  minScoreThreshold: 0.3, // Minimum combined score
  maxResults: 20, // Maximum results
  enableDeduplication: true,
  deduplicationThreshold: 0.85, // 85% similarity threshold
  enableABTesting: false,
  abTestVariants: [
    { semantic: 0.6, keyword: 0.4 }, // Variant A (default)
    { semantic: 0.7, keyword: 0.3 }, // Variant B
    { semantic: 0.5, keyword: 0.5 }, // Variant C
  ],
};

/**
 * A/B testing configuration
 */
export const DEFAULT_AB_TEST_CONFIG: ABTestConfig = {
  enabled: false,
  variants: [
    {
      name: 'balanced',
      weights: { semantic: 0.6, keyword: 0.4 },
      trafficPercentage: 50,
    },
    {
      name: 'semantic_heavy',
      weights: { semantic: 0.8, keyword: 0.2 },
      trafficPercentage: 30,
    },
    {
      name: 'keyword_heavy',
      weights: { semantic: 0.3, keyword: 0.7 },
      trafficPercentage: 20,
    },
  ],
  defaultVariant: 'balanced',
};

/**
 * Get hybrid search configuration
 */
export function getHybridSearchConfig(): HybridSearchConfig {
  // In the future, this could read from environment variables or database
  return DEFAULT_HYBRID_SEARCH_CONFIG;
}

/**
 * Get A/B test configuration
 */
export function getABTestConfig(): ABTestConfig {
  // In the future, this could read from environment variables or database
  return DEFAULT_AB_TEST_CONFIG;
}

/**
 * Get weights for a specific preset
 */
export function getWeightsForPreset(preset: string): HybridSearchWeights {
  return WEIGHT_PRESETS[preset] || DEFAULT_HYBRID_WEIGHTS;
}

/**
 * Validate hybrid search weights
 */
export function validateWeights(weights: HybridSearchWeights): boolean {
  const { semantic, keyword } = weights;
  
  // Weights should be between 0 and 1
  if (semantic < 0 || semantic > 1 || keyword < 0 || keyword > 1) {
    return false;
  }
  
  // Weights don't need to sum to 1, but should be reasonable
  // Allow weights to sum to any value (will be normalized)
  return true;
}

/**
 * Normalize weights to sum to 1.0
 */
export function normalizeWeights(weights: HybridSearchWeights): HybridSearchWeights {
  const { semantic, keyword } = weights;
  const sum = semantic + keyword;
  
  if (sum === 0) {
    return DEFAULT_HYBRID_WEIGHTS;
  }
  
  return {
    semantic: semantic / sum,
    keyword: keyword / sum,
  };
}

/**
 * Select A/B test variant based on user ID or random
 */
export function selectABTestVariant(
  userId: string,
  config: ABTestConfig = DEFAULT_AB_TEST_CONFIG
): HybridSearchWeights {
  if (!config.enabled || config.variants.length === 0) {
    return DEFAULT_HYBRID_WEIGHTS;
  }
  
  // Use deterministic selection based on user ID hash
  // This ensures same user always gets same variant
  const hash = simpleHash(userId);
  const random = hash % 100; // 0-99
  
  let cumulative = 0;
  for (const variant of config.variants) {
    cumulative += variant.trafficPercentage;
    if (random < cumulative) {
      return variant.weights;
    }
  }
  
  // Fallback to default variant
  const defaultVariant = config.variants.find(v => v.name === config.defaultVariant);
  return defaultVariant?.weights || DEFAULT_HYBRID_WEIGHTS;
}

/**
 * Default domain authority configuration
 */
export const DEFAULT_DOMAIN_AUTHORITY_CONFIG: Required<Omit<DomainAuthorityConfig, 'customDomainScores'>> & {
  customDomainScores: Record<string, number>;
} = {
  authorityWeight: 0.3,
  minAuthorityScore: 0.5,
  highAuthorityBoost: 1.2,
  lowAuthorityPenalty: 0.9,
  enabled: true,
  customDomainScores: {},
  filterByAuthority: false,
  minAuthorityFilter: 0.3,
};

/**
 * Get domain authority configuration
 */
export function getDomainAuthorityConfig(): Required<Omit<DomainAuthorityConfig, 'customDomainScores'>> & {
  customDomainScores: Record<string, number>;
} {
  // In the future, this could read from environment variables or database
  return DEFAULT_DOMAIN_AUTHORITY_CONFIG;
}

/**
 * Simple hash function for deterministic variant selection
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
