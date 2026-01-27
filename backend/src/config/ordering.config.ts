/**
 * Ordering Configuration
 * Configuration for relevance-based ordering strategies
 */

export type OrderingStrategy = 'relevance' | 'score' | 'quality' | 'hybrid' | 'chronological';

export interface OrderingConfig {
  // Document chunk ordering
  documentOrdering: {
    strategy: OrderingStrategy; // Ordering strategy for document chunks
    enableScoreOrdering: boolean; // Order by relevance score (default: true)
    enableQualityOrdering: boolean; // Order by content quality (default: false)
    enableChronologicalOrdering: boolean; // Order by document date (default: false)
    scoreWeight: number; // Weight for score in hybrid ordering (0-1, default: 0.7)
    qualityWeight: number; // Weight for quality in hybrid ordering (0-1, default: 0.3)
    ascending: boolean; // Sort ascending (default: false, descending)
  };
  // Web result ordering
  webResultOrdering: {
    strategy: OrderingStrategy; // Ordering strategy for web results
    enableScoreOrdering: boolean; // Order by search score (default: true)
    enableQualityOrdering: boolean; // Order by content quality (default: false)
    enableAuthorityOrdering: boolean; // Order by domain authority (default: false)
    enableFreshnessOrdering: boolean; // Order by publication date (default: false)
    scoreWeight: number; // Weight for score in hybrid ordering (0-1, default: 0.5)
    qualityWeight: number; // Weight for quality in hybrid ordering (0-1, default: 0.3)
    authorityWeight: number; // Weight for authority in hybrid ordering (0-1, default: 0.2)
    ascending: boolean; // Sort ascending (default: false, descending)
  };
  // Performance settings
  maxProcessingTimeMs: number; // Maximum processing time (default: 50ms)
  enableCaching: boolean; // Enable ordering result caching (default: false)
}

/**
 * Default ordering configuration
 */
export const DEFAULT_ORDERING_CONFIG: OrderingConfig = {
  documentOrdering: {
    strategy: 'relevance',
    enableScoreOrdering: true,
    enableQualityOrdering: false,
    enableChronologicalOrdering: false,
    scoreWeight: 0.7,
    qualityWeight: 0.3,
    ascending: false,
  },
  webResultOrdering: {
    strategy: 'relevance',
    enableScoreOrdering: true,
    enableQualityOrdering: false,
    enableAuthorityOrdering: false,
    enableFreshnessOrdering: false,
    scoreWeight: 0.5,
    qualityWeight: 0.3,
    authorityWeight: 0.2,
    ascending: false,
  },
  maxProcessingTimeMs: 50,
  enableCaching: false,
};

/**
 * Ordering strategy presets
 */
export const ORDERING_PRESETS: Record<OrderingStrategy, Partial<OrderingConfig>> = {
  relevance: {
    documentOrdering: {
      strategy: 'relevance',
      enableScoreOrdering: true,
      enableQualityOrdering: false,
      enableChronologicalOrdering: false,
      scoreWeight: 1.0,
      qualityWeight: 0.0,
      ascending: false,
    },
    webResultOrdering: {
      strategy: 'relevance',
      enableScoreOrdering: true,
      enableQualityOrdering: false,
      enableAuthorityOrdering: false,
      enableFreshnessOrdering: false,
      scoreWeight: 1.0,
      qualityWeight: 0.0,
      authorityWeight: 0.0,
      ascending: false,
    },
  },
  score: {
    documentOrdering: {
      strategy: 'score',
      enableScoreOrdering: true,
      enableQualityOrdering: false,
      enableChronologicalOrdering: false,
      scoreWeight: 1.0,
      qualityWeight: 0.0,
      ascending: false,
    },
    webResultOrdering: {
      strategy: 'score',
      enableScoreOrdering: true,
      enableQualityOrdering: false,
      enableAuthorityOrdering: false,
      enableFreshnessOrdering: false,
      scoreWeight: 1.0,
      qualityWeight: 0.0,
      authorityWeight: 0.0,
      ascending: false,
    },
  },
  quality: {
    documentOrdering: {
      strategy: 'quality',
      enableScoreOrdering: false,
      enableQualityOrdering: true,
      enableChronologicalOrdering: false,
      scoreWeight: 0.0,
      qualityWeight: 1.0,
      ascending: false,
    },
    webResultOrdering: {
      strategy: 'quality',
      enableScoreOrdering: false,
      enableQualityOrdering: true,
      enableAuthorityOrdering: false,
      enableFreshnessOrdering: false,
      scoreWeight: 0.0,
      qualityWeight: 1.0,
      authorityWeight: 0.0,
      ascending: false,
    },
  },
  hybrid: {
    documentOrdering: {
      strategy: 'hybrid',
      enableScoreOrdering: true,
      enableQualityOrdering: true,
      enableChronologicalOrdering: false,
      scoreWeight: 0.7,
      qualityWeight: 0.3,
      ascending: false,
    },
    webResultOrdering: {
      strategy: 'hybrid',
      enableScoreOrdering: true,
      enableQualityOrdering: true,
      enableAuthorityOrdering: true,
      enableFreshnessOrdering: false,
      scoreWeight: 0.5,
      qualityWeight: 0.3,
      authorityWeight: 0.2,
      ascending: false,
    },
  },
  chronological: {
    documentOrdering: {
      strategy: 'chronological',
      enableScoreOrdering: false,
      enableQualityOrdering: false,
      enableChronologicalOrdering: true,
      scoreWeight: 0.0,
      qualityWeight: 0.0,
      ascending: false, // Most recent first
    },
    webResultOrdering: {
      strategy: 'chronological',
      enableScoreOrdering: false,
      enableQualityOrdering: false,
      enableAuthorityOrdering: false,
      enableFreshnessOrdering: true,
      scoreWeight: 0.0,
      qualityWeight: 0.0,
      authorityWeight: 0.0,
      ascending: false, // Most recent first
    },
  },
};

/**
 * Get ordering configuration
 */
export function getOrderingConfig(): OrderingConfig {
  // In the future, this could read from environment variables or database
  return DEFAULT_ORDERING_CONFIG;
}

/**
 * Get ordering configuration for a specific strategy
 */
export function getOrderingConfigForStrategy(strategy: OrderingStrategy): OrderingConfig {
  const preset = ORDERING_PRESETS[strategy];
  if (!preset) {
    return DEFAULT_ORDERING_CONFIG;
  }

  return {
    ...DEFAULT_ORDERING_CONFIG,
    documentOrdering: {
      ...DEFAULT_ORDERING_CONFIG.documentOrdering,
      ...preset.documentOrdering,
    },
    webResultOrdering: {
      ...DEFAULT_ORDERING_CONFIG.webResultOrdering,
      ...preset.webResultOrdering,
    },
  };
}

/**
 * Validate ordering configuration
 */
export function validateOrderingConfig(config: Partial<OrderingConfig>): boolean {
  // Validate weights are between 0 and 1
  const validateWeights = (weights: any) => {
    return Object.values(weights).every((w: any) => 
      typeof w === 'number' && w >= 0 && w <= 1
    );
  };

  if (config.documentOrdering) {
    const doc = config.documentOrdering;
    if (doc.scoreWeight !== undefined && (doc.scoreWeight < 0 || doc.scoreWeight > 1)) {
      return false;
    }
    if (doc.qualityWeight !== undefined && (doc.qualityWeight < 0 || doc.qualityWeight > 1)) {
      return false;
    }
  }

  if (config.webResultOrdering) {
    const web = config.webResultOrdering;
    if (web.scoreWeight !== undefined && (web.scoreWeight < 0 || web.scoreWeight > 1)) {
      return false;
    }
    if (web.qualityWeight !== undefined && (web.qualityWeight < 0 || web.qualityWeight > 1)) {
      return false;
    }
    if (web.authorityWeight !== undefined && (web.authorityWeight < 0 || web.authorityWeight > 1)) {
      return false;
    }
  }

  if (config.maxProcessingTimeMs !== undefined && config.maxProcessingTimeMs < 0) {
    return false;
  }

  return true;
}
