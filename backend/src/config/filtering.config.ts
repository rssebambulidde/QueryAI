/**
 * Filtering Configuration
 * Configuration for result filtering strategies and A/B testing
 */

export type FilteringMode = 'strict' | 'moderate' | 'lenient';

export interface FilteringStrategy {
  mode: FilteringMode;
  // Time range filtering
  timeRangeFiltering: {
    enabled: boolean;
    useHardFilter: boolean; // If false, use ranking penalty instead
    strictThreshold: number; // Threshold for strict filtering (0-1)
    moderateThreshold: number; // Threshold for moderate filtering (0-1)
    lenientThreshold: number; // Threshold for lenient filtering (0-1)
    rankingPenalty: number; // Penalty to apply when using ranking (0-1)
  };
  // Topic filtering
  topicFiltering: {
    enabled: boolean;
    useHardFilter: boolean;
    strictThreshold: number; // Minimum topic match score for strict mode
    moderateThreshold: number;
    lenientThreshold: number;
    rankingPenalty: number;
  };
  // Quality filtering
  qualityFiltering: {
    enabled: boolean;
    useHardFilter: boolean;
    strictThreshold: number; // Minimum quality score (0-1)
    moderateThreshold: number;
    lenientThreshold: number;
    rankingPenalty: number;
  };
  // Authority filtering
  authorityFiltering: {
    enabled: boolean;
    useHardFilter: boolean;
    strictThreshold: number; // Minimum authority score (0-1)
    moderateThreshold: number;
    lenientThreshold: number;
    rankingPenalty: number;
  };
  // Diversity settings
  diversity: {
    enabled: boolean;
    minDomainDiversity: number; // Minimum unique domains (0-1 ratio)
    maxResultsPerDomain: number; // Maximum results per domain
  };
}

/**
 * Strict filtering strategy
 * Hard filters with high thresholds
 */
export const STRICT_FILTERING_STRATEGY: FilteringStrategy = {
  mode: 'strict',
  timeRangeFiltering: {
    enabled: true,
    useHardFilter: true,
    strictThreshold: 0.9,
    moderateThreshold: 0.8,
    lenientThreshold: 0.7,
    rankingPenalty: 0.5,
  },
  topicFiltering: {
    enabled: true,
    useHardFilter: true,
    strictThreshold: 0.8,
    moderateThreshold: 0.7,
    lenientThreshold: 0.6,
    rankingPenalty: 0.4,
  },
  qualityFiltering: {
    enabled: true,
    useHardFilter: true,
    strictThreshold: 0.7,
    moderateThreshold: 0.6,
    lenientThreshold: 0.5,
    rankingPenalty: 0.3,
  },
  authorityFiltering: {
    enabled: true,
    useHardFilter: true,
    strictThreshold: 0.7,
    moderateThreshold: 0.6,
    lenientThreshold: 0.5,
    rankingPenalty: 0.3,
  },
  diversity: {
    enabled: true,
    minDomainDiversity: 0.7,
    maxResultsPerDomain: 2,
  },
};

/**
 * Moderate filtering strategy
 * Mix of hard filtering and ranking penalties
 */
export const MODERATE_FILTERING_STRATEGY: FilteringStrategy = {
  mode: 'moderate',
  timeRangeFiltering: {
    enabled: true,
    useHardFilter: false, // Use ranking penalty
    strictThreshold: 0.8,
    moderateThreshold: 0.7,
    lenientThreshold: 0.6,
    rankingPenalty: 0.3, // Apply penalty instead of filtering
  },
  topicFiltering: {
    enabled: true,
    useHardFilter: false,
    strictThreshold: 0.7,
    moderateThreshold: 0.6,
    lenientThreshold: 0.5,
    rankingPenalty: 0.25,
  },
  qualityFiltering: {
    enabled: true,
    useHardFilter: false,
    strictThreshold: 0.6,
    moderateThreshold: 0.5,
    lenientThreshold: 0.4,
    rankingPenalty: 0.2,
  },
  authorityFiltering: {
    enabled: true,
    useHardFilter: false,
    strictThreshold: 0.6,
    moderateThreshold: 0.5,
    lenientThreshold: 0.4,
    rankingPenalty: 0.2,
  },
  diversity: {
    enabled: true,
    minDomainDiversity: 0.5,
    maxResultsPerDomain: 3,
  },
};

/**
 * Lenient filtering strategy
 * Mostly ranking-based, minimal hard filtering
 */
export const LENIENT_FILTERING_STRATEGY: FilteringStrategy = {
  mode: 'lenient',
  timeRangeFiltering: {
    enabled: true,
    useHardFilter: false,
    strictThreshold: 0.7,
    moderateThreshold: 0.6,
    lenientThreshold: 0.5,
    rankingPenalty: 0.15, // Light penalty
  },
  topicFiltering: {
    enabled: true,
    useHardFilter: false,
    strictThreshold: 0.6,
    moderateThreshold: 0.5,
    lenientThreshold: 0.4,
    rankingPenalty: 0.15,
  },
  qualityFiltering: {
    enabled: true,
    useHardFilter: false,
    strictThreshold: 0.5,
    moderateThreshold: 0.4,
    lenientThreshold: 0.3,
    rankingPenalty: 0.1,
  },
  authorityFiltering: {
    enabled: true,
    useHardFilter: false,
    strictThreshold: 0.5,
    moderateThreshold: 0.4,
    lenientThreshold: 0.3,
    rankingPenalty: 0.1,
  },
  diversity: {
    enabled: true,
    minDomainDiversity: 0.3,
    maxResultsPerDomain: 5,
  },
};

/**
 * Filtering strategy presets
 */
export const FILTERING_STRATEGIES: Record<FilteringMode, FilteringStrategy> = {
  strict: STRICT_FILTERING_STRATEGY,
  moderate: MODERATE_FILTERING_STRATEGY,
  lenient: LENIENT_FILTERING_STRATEGY,
};

/**
 * A/B test variant configuration
 */
export interface FilteringABTestVariant {
  name: string;
  strategy: FilteringStrategy;
  trafficPercentage: number; // 0-100
}

export interface FilteringABTestConfig {
  enabled: boolean;
  variants: FilteringABTestVariant[];
  defaultVariant: string; // Default variant name
}

/**
 * Default A/B test configuration
 */
export const DEFAULT_FILTERING_AB_TEST_CONFIG: FilteringABTestConfig = {
  enabled: false,
  variants: [
    {
      name: 'strict',
      strategy: STRICT_FILTERING_STRATEGY,
      trafficPercentage: 33,
    },
    {
      name: 'moderate',
      strategy: MODERATE_FILTERING_STRATEGY,
      trafficPercentage: 34,
    },
    {
      name: 'lenient',
      strategy: LENIENT_FILTERING_STRATEGY,
      trafficPercentage: 33,
    },
  ],
  defaultVariant: 'moderate',
};

/**
 * Get filtering strategy for a mode
 */
export function getFilteringStrategy(mode: FilteringMode): FilteringStrategy {
  return FILTERING_STRATEGIES[mode] || MODERATE_FILTERING_STRATEGY;
}

/**
 * Get A/B test configuration
 */
export function getFilteringABTestConfig(): FilteringABTestConfig {
  // In the future, this could read from environment variables or database
  return DEFAULT_FILTERING_AB_TEST_CONFIG;
}

/**
 * Select A/B test variant based on user ID
 */
export function selectFilteringVariant(
  userId: string,
  config: FilteringABTestConfig = DEFAULT_FILTERING_AB_TEST_CONFIG
): FilteringStrategy {
  if (!config.enabled || config.variants.length === 0) {
    return MODERATE_FILTERING_STRATEGY;
  }

  // Use deterministic selection based on user ID hash
  const hash = simpleHash(userId);
  const random = hash % 100; // 0-99

  let cumulative = 0;
  for (const variant of config.variants) {
    cumulative += variant.trafficPercentage;
    if (random < cumulative) {
      return variant.strategy;
    }
  }

  // Fallback to default variant
  const defaultVariant = config.variants.find(v => v.name === config.defaultVariant);
  return defaultVariant?.strategy || MODERATE_FILTERING_STRATEGY;
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

/**
 * Validate filtering strategy
 */
export function validateFilteringStrategy(strategy: FilteringStrategy): boolean {
  // Validate thresholds are between 0 and 1
  const validateThresholds = (config: any) => {
    return (
      config.strictThreshold >= 0 && config.strictThreshold <= 1 &&
      config.moderateThreshold >= 0 && config.moderateThreshold <= 1 &&
      config.lenientThreshold >= 0 && config.lenientThreshold <= 1 &&
      config.rankingPenalty >= 0 && config.rankingPenalty <= 1
    );
  };

  return (
    validateThresholds(strategy.timeRangeFiltering) &&
    validateThresholds(strategy.topicFiltering) &&
    validateThresholds(strategy.qualityFiltering) &&
    validateThresholds(strategy.authorityFiltering) &&
    strategy.diversity.minDomainDiversity >= 0 &&
    strategy.diversity.minDomainDiversity <= 1 &&
    strategy.diversity.maxResultsPerDomain > 0
  );
}
