/**
 * Centralized Threshold & Magic Number Configuration
 *
 * All numeric thresholds, weights, limits, and timeouts that were previously
 * scattered as magic numbers across service files are collected here.
 *
 * Grouping follows service domain boundaries so each service can import
 * only the section it needs.
 */

// ---------------------------------------------------------------------------
// Retrieval — similarity scores, min-score defaults, result limits
// ---------------------------------------------------------------------------
export const RetrievalConfig = {
  /** Default minimum similarity score for search results */
  minSimilarityScore: 0.7,
  /** Threshold above which two results are considered near-duplicates */
  nearDuplicateThreshold: 0.95,
  /** Threshold for general similarity-based deduplication */
  similarityDedupeThreshold: 0.85,
  /** Default minimum quality score */
  qualityThreshold: 0.5,
  /** Default minimum domain-authority score */
  authorityThreshold: 0.5,
  /** Similarity threshold for RAG context cache lookup */
  cacheSimThreshold: 0.85,
  /** Lowered minScore for keyword search (multiplier applied to base minScore) */
  keywordMinScoreMultiplier: 0.5,
  /** Lowered base minScore for keyword search */
  keywordBaseMinScore: 0.3,
  /** Low threshold for initial broad analysis */
  broadAnalysisMinScore: 0.3,
  /** Threshold reduction when doing adaptive fallback */
  adaptiveFallbackReduction: 0.1,
  /** Minimum relevance score for source extraction */
  sourceExtractionMinScore: 0.6,
  /** Priority threshold for high-priority classification */
  highPriorityThreshold: 0.7,

  /** Default search weights */
  weights: {
    semantic: 0.6,
    keyword: 0.4,
  },

  /** Default result counts */
  defaults: {
    topK: 10,
    maxDocumentChunks: 5,
    maxWebResults: 5,
    minResults: 3,
    maxResults: 10,
    minWebResults: 2,
    maxWebResultsCeiling: 15,
    defaultChunks: 5,
    maxDocumentChunksCeiling: 30,
  },

  /** Retry / resilience for embedding + search calls inside RAG */
  retry: {
    maxAttempts: 2,
    retryDelayMs: 1000,
    webRetryDelayMs: 2000,
  },

  /** Processing time targets (ms) */
  processingTargets: {
    orderingTargetMs: 50,
    summarizationTimeoutMs: 3000,
    compressionTimeoutMs: 2000,
  },
} as const;

// ---------------------------------------------------------------------------
// Chunking — sizes, overlaps, similarity break
// ---------------------------------------------------------------------------
export const ChunkingConfig = {
  /** Maximum tokens per chunk (~600 words) */
  maxChunkSize: 800,
  /** Overlap tokens between consecutive chunks (~75 words) */
  overlapSize: 100,
  /** Minimum tokens per chunk (~75 words) */
  minChunkSize: 100,
  /** Chunk break ratio — break if chunk is N% full at a paragraph boundary */
  semanticSimilarityBreak: 0.7,
  /** Default similarity threshold for semantic chunking */
  semanticChunkingSimilarityThreshold: 0.7,
} as const;

// ---------------------------------------------------------------------------
// Compression — token budgets, timeouts
// ---------------------------------------------------------------------------
export const CompressionConfig = {
  /** Target maximum context tokens after compression */
  maxTokens: 8000,
  /** Token count above which compression is triggered */
  compressionThreshold: 10000,
  /** Token count above which summarization is triggered */
  summarizationThreshold: 12000,
  /** Hard limit on compression processing time (ms) */
  maxCompressionTimeMs: 2000,
  /** Max tokens per summary */
  summarizationMaxTokens: 500,
  /** Temperature for summarization LLM calls */
  summarizationTemperature: 0.3,
  /** Maximum key points to extract */
  maxKeyPoints: 5,
  /** Safety margin multiplier for truncation (90%) */
  truncationSafetyMargin: 0.9,
  /** Compression effectiveness threshold — if compressed >= N% of original, try harder */
  compressionEffectivenessThreshold: 0.9,
} as const;

// ---------------------------------------------------------------------------
// Summarization — specific to context-summarizer service
// ---------------------------------------------------------------------------
export const SummarizationConfig = {
  /** Token threshold that triggers summarization */
  threshold: 12000,
  /** Max tokens per summary */
  maxSummaryTokens: 400,
  /** Temperature for summarization */
  temperature: 0.3,
  /** Max processing time (ms) */
  maxTimeMs: 3000,
  /** Quick summarization overrides */
  quick: {
    maxSummaryTokens: 200,
    temperature: 0.2,
    maxTimeMs: 2000,
  },
} as const;

// ---------------------------------------------------------------------------
// Embedding — batching, queue, cache
// ---------------------------------------------------------------------------
export const EmbeddingConfig = {
  /** Default batch size for embedding generation */
  batchSize: 100,
  /** OpenAI maximum batch size */
  maxBatchSize: 2048,
  /** Minimum batch size */
  minBatchSize: 1,
  /** Interval between queue processing runs (ms) */
  batchProcessingIntervalMs: 100,
  /** Queue timeout per item (ms) */
  queueTimeoutMs: 30000,
  /** Maximum items allowed in the queue */
  maxQueueSize: 10000,
  /** Max wait before force-processing a batch (ms) */
  maxBatchWaitTimeMs: 5000,
  /** Embedding cache TTL (seconds) — 7 days */
  cacheTtlSeconds: 7 * 24 * 60 * 60,
  /** Maximum processing time samples to keep for stats */
  maxProcessingTimeSamples: 100,
  /** Minimum acceptable embedding dimensions */
  minDimensions: 256,
} as const;

// ---------------------------------------------------------------------------
// Cache TTLs (seconds)
// ---------------------------------------------------------------------------
export const CacheTtlConfig = {
  /** RAG mixed (document + web) — 30 min */
  ragMixed: 1800,
  /** RAG web-only — 15 min */
  ragWebOnly: 900,
  /** RAG document-only — 1 hour */
  ragDocOnly: 3600,
  /** Tavily / web search — 24 hours */
  search: 86400,
  /** LLM response cache — 1 hour */
  llmResponse: 3600,
  /** General cache fallback — 1 hour */
  defaultFallback: 3600,
  /** Embedding cache — 24 hours (tiered) */
  embeddingTiered: 86400,
  /** Short search cache (tiered) — 15 min */
  searchTiered: 900,
  /** System cache — 7 days */
  system: 86400 * 7,
} as const;

// ---------------------------------------------------------------------------
// Circuit Breaker / Resilience defaults
// ---------------------------------------------------------------------------
export const CircuitBreakerDefaults = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  monitoringWindowMs: 60000,
  operationTimeoutMs: 30000,
} as const;

// ---------------------------------------------------------------------------
// Retry defaults
// ---------------------------------------------------------------------------
export const RetryDefaults = {
  maxRetries: 3,
  initialDelayMs: 1000,
  multiplier: 2,
  maxDelayMs: 10000,
} as const;

// ---------------------------------------------------------------------------
// Search / Tavily
// ---------------------------------------------------------------------------
export const SearchConfig = {
  /** Maximum query length before rejection */
  maxQueryLength: 500,
  /** Maximum query variations for expansion */
  maxQueryVariations: 3,
  /** Target processing time for deduplication (ms) */
  deduplicationTargetMs: 150,
} as const;

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------
export const DeduplicationConfig = {
  /** Exact match threshold */
  exactDuplicateThreshold: 1.0,
  /** Near-duplicate threshold (95%) */
  nearDuplicateThreshold: 0.95,
  /** General similarity threshold (85%) */
  similarityThreshold: 0.85,
  /** Weights for combined similarity: char vs word */
  charSimilarityWeight: 0.6,
  wordSimilarityWeight: 0.4,
} as const;

// ---------------------------------------------------------------------------
// Web Deduplication
// ---------------------------------------------------------------------------
export const WebDeduplicationConfig = {
  /** Content similarity threshold (85%) */
  contentSimilarityThreshold: 0.85,
  /** Title similarity threshold (90%) */
  titleSimilarityThreshold: 0.90,
  /** Max processing time (ms) */
  maxProcessingTimeMs: 150,
  /** Minimum word length for similarity comparison */
  minWordLength: 2,
  /** Combined similarity weights: content vs title */
  contentWeight: 0.4,
  titleWeight: 0.6,
  /** Max comparisons for performance */
  maxComparisonLimit: 20,
  /** Minimum remaining time to continue processing (ms) */
  minRemainingTimeMs: 10,
} as const;

// ---------------------------------------------------------------------------
// Diversity Filter (MMR)
// ---------------------------------------------------------------------------
export const DiversityConfig = {
  /** Lambda: relevance vs diversity trade-off (0.7 = 70% relevance) */
  lambda: 0.7,
  /** Default max results after filtering */
  maxResults: 10,
  /** Similarity threshold for diversity calculation */
  similarityThreshold: 0.7,
} as const;

// ---------------------------------------------------------------------------
// Hybrid Search
// ---------------------------------------------------------------------------
export const HybridSearchConfig = {
  /** Default deduplication similarity threshold */
  deduplicationThreshold: 0.85,
} as const;

// ---------------------------------------------------------------------------
// Reranking (score-based internal)
// ---------------------------------------------------------------------------
export const RerankingInternalConfig = {
  /** Length normalizer divisor */
  lengthNormalizationDivisor: 100,
  /** Score component estimation weights */
  semanticEstimateWeight: 0.6,
  keywordEstimateWeight: 0.4,
  /** Hybrid reranking weights: cross-encoder vs score-based */
  crossEncoderWeight: 0.7,
  scoreBasedWeight: 0.3,
  /** Top-N for precision metrics */
  precisionTopN: 5,
} as const;

// ---------------------------------------------------------------------------
// Web Result Reranker
// ---------------------------------------------------------------------------
export const WebRerankerConfig = {
  weights: {
    relevance: 0.4,
    domainAuthority: 0.3,
    freshness: 0.2,
    originalScore: 0.1,
    titleMatch: 0.6,
    contentMatch: 0.4,
  },
  boosts: {
    domainAuthority: 1.2,
    maxFreshness: 1.3,
  },
  freshnessDecayDays: 365,
  /** Minimum keyword length for relevance scoring */
  minKeywordLength: 3,
  /** Default scores for fallback */
  defaultScore: 0.5,
  /** Domain authority scores by TLD-quality tier */
  domainScores: {
    eduGovOrg: 0.8,
    academic: 0.9,
    suspicious: 0.6,
    default: 0.5,
  },
  /** Freshness score tiers */
  freshnessTiers: {
    veryRecent: { days: 7, score: 1.0 },
    recent: { days: 30, score: 0.9 },
    moderate: { days: 90, score: 0.8 },
    somewhat: { days: 180, score: 0.7 },
    withinYear: { days: 365, score: 0.6 },
    /** Minimum decay factor for content older than a year */
    minDecayFactor: 0.3,
  },
  /** Penalty score for future/invalid dates */
  futureDatePenalty: 0.3,
} as const;

// ---------------------------------------------------------------------------
// Result Quality Scorer
// ---------------------------------------------------------------------------
export const QualityScorerConfig = {
  weights: {
    contentLength: 0.25,
    readability: 0.30,
    structure: 0.25,
    completeness: 0.20,
  },
  content: {
    minLength: 50,
    optimalLength: 500,
    maxLength: 5000,
    minWordCount: 20,
    optimalWordCount: 200,
  },
  readability: {
    minWordsPerSentence: 5,
    maxWordsPerSentence: 25,
    minSentences: 3,
    /** Weight split: sentence length vs count */
    sentenceLengthWeight: 0.6,
    sentenceCountWeight: 0.4,
    /** Minimum score floor for short sentences */
    minSentenceLengthScore: 0.3,
    /** Max penalty for long sentences */
    maxLongSentencePenalty: 0.5,
  },
  structure: {
    minParagraphs: 1,
    titlePresenceScore: 0.3,
    paragraphScoreWeight: 0.4,
    formattingScore: 0.3,
    multipleParagraphsBonus: 0.15,
  },
  completeness: {
    /** Weights: length vs word count */
    lengthWeight: 0.6,
    wordCountWeight: 0.4,
    /** Penalty caps */
    moderateLengthPenalty: 0.3,
    severeLengthPenalty: 0.5,
    excessWordPenalty: 0.2,
    /** Minimum content length score floor */
    minContentLengthScore: 0.3,
  },
} as const;

// ---------------------------------------------------------------------------
// Domain Authority
// ---------------------------------------------------------------------------
export const DomainAuthorityConfig = {
  /** Default authority weight */
  authorityWeight: 0.3,
  /** Default minimum authority score */
  minAuthorityScore: 0.5,
  /** Boost factor for high authority domains */
  highAuthorityBoost: 1.2,
  /** Penalty factor for low authority domains */
  lowAuthorityPenalty: 0.9,
  /** Default category weight */
  defaultCategoryWeight: 0.5,
  /** Default authority score (0-1) and raw (0-100) */
  defaultScore: 0.5,
  defaultRawScore: 50,
  /** Normalization divisor (raw score is out of 100) */
  rawScoreNormalizer: 100,
  /** Low authority threshold */
  lowAuthorityThreshold: 0.3,
  /** TLD authority scores (raw, 0-100) */
  tldScores: {
    edu: 85,
    gov: 90,
    org: 70,
    default: 50,
  },
} as const;

// ---------------------------------------------------------------------------
// Threshold Optimizer
// ---------------------------------------------------------------------------
export const ThresholdOptimizerConfig = {
  defaults: {
    threshold: 0.7,
    minThreshold: 0.3,
    maxThreshold: 0.95,
  },
  queryTypeThresholds: {
    factual: 0.75,
    conceptual: 0.65,
    procedural: 0.70,
    exploratory: 0.60,
    unknown: 0.70,
  },
  /** Percentile used for distribution analysis */
  percentileThreshold: 0.75,
  /** Threshold adjustment increments */
  adjustDown: 0.1,
  adjustUpSmall: 0.05,
  adjustDownSmall: 0.05,
  /** Confidence scores by strategy */
  confidence: {
    default: 0.7,
    distributionBased: 0.8,
    fallback: 0.6,
    optimized: 0.9,
  },
  /** Distribution analysis parameters */
  distribution: {
    lowStdDevThreshold: 0.1,
    meanThreshold: 0.5,
    meanAdjustment: 0.1,
  },
  /** Default min/max results */
  minResults: 3,
  maxResults: 10,
  /** Max optimization iterations */
  maxIterations: 5,
} as const;

// ---------------------------------------------------------------------------
// Source Prioritizer
// ---------------------------------------------------------------------------
export const SourcePrioritizerConfig = {
  weights: {
    document: 0.6,
    web: 0.4,
    relevance: 0.4,
    authority: 0.3,
    recency: 0.2,
    quality: 0.1,
  },
  boosts: {
    recent: 1.2,
    highAuthority: 1.3,
  },
  thresholds: {
    recentDays: 30,
    highAuthority: 0.7,
    highPriority: 0.7,
    recentFreshness: 0.8,
  },
  /** Freshness tiers (same structure as web reranker) */
  freshnessTiers: {
    veryRecent: { days: 7, score: 1.0 },
    recent: { days: 30, score: 0.9 },
    moderate: { days: 90, score: 0.8 },
    withinYear: { days: 365, score: 0.7 },
    minDecayFactor: 0.3,
  },
  /** Default scores for documents */
  documentDefaults: {
    authorityScore: 0.9,
    freshnessScore: 0.7,
    relevanceScore: 0.5,
  },
  /** Weight calculation: base + normalizedPriority * range */
  priorityWeightBase: 0.3,
  priorityWeightRange: 0.7,
  /** Presets */
  presets: {
    documentsFirst: { documentWeight: 0.8, webWeight: 0.2 },
    webFirst: { documentWeight: 0.3, webWeight: 0.7 },
    balanced: { documentWeight: 0.5, webWeight: 0.5 },
    authorityFirst: {
      authorityWeight: 0.5,
      relevanceWeight: 0.3,
      highAuthorityBoost: 1.5,
    },
    recentFirst: {
      recencyWeight: 0.4,
      relevanceWeight: 0.3,
      recentBoost: 1.5,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Relevance Ordering
// ---------------------------------------------------------------------------
export const RelevanceOrderingConfig = {
  /** Default scores for fallback */
  defaultQualityScore: 0.5,
  defaultAuthorityScore: 0.5,
  defaultFreshnessScore: 0.5,
  defaultOrderingScore: 0.5,
  /** Freshness tiers (shared pattern) */
  freshnessTiers: {
    veryRecent: { days: 7, score: 1.0 },
    recent: { days: 30, score: 0.9 },
    moderate: { days: 90, score: 0.8 },
    withinYear: { days: 365, score: 0.7 },
    minDecayFactor: 0.3,
  },
} as const;

// ---------------------------------------------------------------------------
// Sliding Window (conversation context)
// ---------------------------------------------------------------------------
export const SlidingWindowConfig = {
  /** Default number of recent messages to keep */
  windowSize: 10,
  /** Maximum total tokens for window + summary */
  maxTotalTokens: 2000,
  /** Maximum tokens for summary */
  maxSummaryTokens: 1000,
} as const;

// ---------------------------------------------------------------------------
// Token Budget
// ---------------------------------------------------------------------------
export const TokenBudgetConfig = {
  /** Model token limits (context window) */
  modelTokenLimits: {
    'gpt-3.5-turbo': 16385,
    'gpt-3.5-turbo-16k': 16385,
    'gpt-3.5-turbo-1106': 16385,
    'gpt-3.5-turbo-0125': 16385,
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-turbo': 128000,
    'gpt-4-turbo-preview': 128000,
    'gpt-4-0125-preview': 128000,
    'gpt-4-1106-preview': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    default: 16385,
  } as Record<string, number>,

  /** Default allocation ratios (must sum to 1.0) */
  allocation: {
    documentContext: 0.50,
    webResults: 0.20,
    systemPrompt: 0.05,
    userPrompt: 0.05,
    responseReserve: 0.15,
    overhead: 0.05,
  },
  /** Allocation ratio validation tolerance */
  allocationTolerance: 0.01,
  /** Minimum remaining tokens to include a document */
  minRemainingTokens: 100,
  /** Reserved tokens for document metadata */
  documentMetadataReserve: 50,
  /** Reserved tokens for web result title/URL */
  webResultMetadataReserve: 100,
  /** Approximate characters per token */
  charsPerToken: 4,
} as const;
