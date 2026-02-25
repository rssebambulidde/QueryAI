/**
 * Zod schemas for AI request validation.
 *
 * The canonical QuestionRequest type is derived from this schema via z.infer,
 * ensuring runtime validation and static types stay in sync.
 */

import { z } from 'zod';

// ── Reusable primitives ──────────────────────────────────────────────

const uuid = z.string().uuid();

const timeRange = z.enum(['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y']);

// ── Nested option objects ────────────────────────────────────────────

const ConversationHistoryEntry = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const TopicQueryOptions = z.object({
  maxQueries: z.number().int().positive().optional(),
  includeSubtopics: z.boolean().optional(),
  queryComplexity: z.enum(['simple', 'moderate', 'complex']).optional(),
}).optional();

const QueryRewritingOptions = z.object({
  maxVariations: z.number().int().positive().optional(),
  useCache: z.boolean().optional(),
  context: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  model: z.string().optional(),
}).optional();

const RerankingConfig = z.object({
  relevanceWeight: z.number().min(0).max(1).optional(),
  domainAuthorityWeight: z.number().min(0).max(1).optional(),
  freshnessWeight: z.number().min(0).max(1).optional(),
  originalScoreWeight: z.number().min(0).max(1).optional(),
  trustedDomains: z.array(z.string()).optional(),
  domainAuthorityBoost: z.number().optional(),
  freshnessDecayDays: z.number().int().positive().optional(),
  maxFreshnessBoost: z.number().optional(),
  titleMatchWeight: z.number().min(0).max(1).optional(),
  contentMatchWeight: z.number().min(0).max(1).optional(),
}).optional();

const QualityScoringConfig = z.object({
  contentLengthWeight: z.number().optional(),
  readabilityWeight: z.number().optional(),
  structureWeight: z.number().optional(),
  completenessWeight: z.number().optional(),
  minContentLength: z.number().int().optional(),
  optimalContentLength: z.number().int().optional(),
  maxContentLength: z.number().int().optional(),
  minWordsPerSentence: z.number().int().optional(),
  maxWordsPerSentence: z.number().int().optional(),
  minSentences: z.number().int().optional(),
  minParagraphs: z.number().int().optional(),
  requireTitle: z.boolean().optional(),
  minWordCount: z.number().int().optional(),
  optimalWordCount: z.number().int().optional(),
}).optional();

const AdaptiveContextOptions = z.object({
  query: z.string().optional(),
  model: z.string().optional(),
  minDocumentChunks: z.number().int().optional(),
  maxDocumentChunks: z.number().int().optional(),
  minWebResults: z.number().int().optional(),
  maxWebResults: z.number().int().optional(),
  preferDocuments: z.boolean().optional(),
  preferWeb: z.boolean().optional(),
  balanceRatio: z.number().min(0).max(1).optional(),
  enableComplexityAnalysis: z.boolean().optional(),
  enableTokenAwareSelection: z.boolean().optional(),
}).optional();

const DynamicLimitOptions = z.object({
  query: z.string().optional(),
  model: z.string().optional(),
  minDocumentChunks: z.number().int().optional(),
  maxDocumentChunks: z.number().int().optional(),
  minWebResults: z.number().int().optional(),
  maxWebResults: z.number().int().optional(),
}).optional();

const OrderingOptions = z.object({
  strategy: z.enum(['relevance', 'score', 'quality', 'hybrid', 'chronological']).optional(),
  maxProcessingTimeMs: z.number().int().positive().optional(),
}).optional();

const SummarizationOptions = z.object({
  query: z.string().optional(),
  model: z.string().optional(),
}).optional();

const PrioritizationOptions = z.object({
  query: z.string().optional(),
}).optional();

const TokenBudgetOptions = z.object({
  model: z.string().optional(),
  maxResponseTokens: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().optional(),
  strictMode: z.boolean().optional(),
}).optional();

const FewShotOptions = z.object({
  maxExamples: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
  preferCitationStyle: z.enum(['mixed', 'document-only', 'web-only', 'web-heavy']).optional(),
}).optional();

const ConversationSummarizationOptions = z.object({
  maxSummaryTokens: z.number().int().positive().optional(),
  strategy: z.string().optional(),
}).optional();

const HistoryFilterOptions = z.object({
  minRelevanceScore: z.number().min(0).max(1).optional(),
  maxHistoryMessages: z.number().int().positive().optional(),
  preserveRecentMessages: z.number().int().nonnegative().optional(),
  useEmbeddingSimilarity: z.boolean().optional(),
  useKeywordMatching: z.boolean().optional(),
  maxFilteringTimeMs: z.number().int().positive().optional(),
  embeddingModel: z.string().optional(),
}).optional();

const SlidingWindowOptions = z.object({
  windowSize: z.number().int().positive().optional(),
  overlapSize: z.number().int().nonnegative().optional(),
}).optional();

const StateTrackingOptions = z.object({
  enableTopicExtraction: z.boolean().optional(),
  enableEntityExtraction: z.boolean().optional(),
  enableConceptExtraction: z.boolean().optional(),
  model: z.string().optional(),
  maxMessagesToAnalyze: z.number().int().positive().optional(),
  updateThreshold: z.number().int().positive().optional(),
  maxExtractionTimeMs: z.number().int().positive().optional(),
}).optional();

const CitationParseOptions = z.object({
  strict: z.boolean().optional(),
  allowPartial: z.boolean().optional(),
}).optional();

// ── Main schema ──────────────────────────────────────────────────────

export const QuestionRequestSchema = z.object({
  // ── Core ─────────────────────────────────────────────
  question: z.string().min(1, 'Question is required').max(10000),
  context: z.string().max(50000).optional(),
  conversationHistory: z.array(ConversationHistoryEntry).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(128000).optional(),

  // ── Conversation mode ───────────────────────────────
  mode: z.enum(['research', 'chat']).optional(),

  // ── Search / topic ──────────────────────────────────
  enableSearch: z.boolean().optional(),
  topic: z.string().max(500).optional(),
  maxSearchResults: z.number().int().positive().max(50).optional(),
  optimizeSearchQuery: z.boolean().optional(),
  searchOptimizationContext: z.string().optional(),
  useTopicAwareQuery: z.boolean().optional(),
  topicQueryOptions: TopicQueryOptions,
  timeRange: timeRange.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  country: z.string().max(100).optional(),

  // ── RAG options ─────────────────────────────────────
  enableDocumentSearch: z.boolean().optional(),
  enableWebSearch: z.boolean().optional(),
  topicId: uuid.optional(),
  documentIds: z.array(uuid).optional(),
  maxDocumentChunks: z.number().int().positive().max(100).optional(),
  minScore: z.number().min(0).max(1).optional(),

  // ── Query expansion / rewriting ─────────────────────
  enableQueryExpansion: z.boolean().optional(),
  expansionStrategy: z.enum(['llm', 'embedding', 'hybrid', 'none']).optional(),
  maxExpansions: z.number().int().positive().max(20).optional(),
  enableQueryRewriting: z.boolean().optional(),
  queryRewritingOptions: QueryRewritingOptions,

  // ── Web result reranking & quality ──────────────────
  enableWebResultReranking: z.boolean().optional(),
  webResultRerankingConfig: RerankingConfig,
  enableQualityScoring: z.boolean().optional(),
  qualityScoringConfig: QualityScoringConfig,
  minQualityScore: z.number().min(0).max(1).optional(),
  filterByQuality: z.boolean().optional(),

  // ── Document reranking / dedup / diversity ──────────
  enableReranking: z.boolean().optional(),
  rerankingStrategy: z.enum(['cross-encoder', 'score-based', 'hybrid', 'none']).optional(),
  rerankingTopK: z.number().int().positive().optional(),
  rerankingMaxResults: z.number().int().positive().optional(),
  useAdaptiveThreshold: z.boolean().optional(),
  minResults: z.number().int().nonnegative().optional(),
  maxResults: z.number().int().positive().optional(),
  enableDiversityFilter: z.boolean().optional(),
  diversityLambda: z.number().min(0).max(1).optional(),
  diversityMaxResults: z.number().int().positive().optional(),
  enableResultDeduplication: z.boolean().optional(),
  deduplicationThreshold: z.number().min(0).max(1).optional(),
  deduplicationNearDuplicateThreshold: z.number().min(0).max(1).optional(),

  // ── Adaptive context / dynamic limits ───────────────
  useAdaptiveContextSelection: z.boolean().optional(),
  enableAdaptiveContextSelection: z.boolean().optional(),
  adaptiveContextOptions: AdaptiveContextOptions,
  minChunks: z.number().int().nonnegative().optional(),
  maxChunks: z.number().int().positive().optional(),
  enableDynamicLimits: z.boolean().optional(),
  dynamicLimitOptions: DynamicLimitOptions,
  enableRelevanceOrdering: z.boolean().optional(),
  orderingOptions: OrderingOptions,

  // ── Context reduction ───────────────────────────────
  contextReductionStrategy: z.enum(['compress', 'summarize', 'none']).optional(),
  maxContextTokens: z.number().int().positive().optional(),
  summarizationOptions: SummarizationOptions,

  // ── Source prioritization / token budget ─────────────
  enableSourcePrioritization: z.boolean().optional(),
  prioritizationOptions: PrioritizationOptions,
  enableTokenBudgeting: z.boolean().optional(),
  tokenBudgetOptions: TokenBudgetOptions,

  // ── Few-shot examples ───────────────────────────────
  enableFewShotExamples: z.boolean().optional(),
  fewShotOptions: FewShotOptions,

  // ── Conversation management ─────────────────────────
  enableConversationSummarization: z.boolean().optional(),
  conversationSummarizationOptions: ConversationSummarizationOptions,
  enableHistoryFiltering: z.boolean().optional(),
  historyFilterOptions: HistoryFilterOptions,
  enableSlidingWindow: z.boolean().optional(),
  slidingWindowOptions: SlidingWindowOptions,
  enableStateTracking: z.boolean().optional(),
  stateTrackingOptions: StateTrackingOptions,

  // ── Citation parsing ────────────────────────────────
  enableCitationParsing: z.boolean().optional(),
  citationParseOptions: CitationParseOptions,

  // ── Conversation ID ─────────────────────────────────
  conversationId: uuid.optional(),

  // ── Queue options (stripped before pipeline) ────────
  useQueue: z.boolean().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),

  // ── Resend / edit support ───────────────────────────
  resendUserMessageId: uuid.optional(),

  // ── Inline attachments (ephemeral images & docs) ───
  attachments: z.array(z.object({
    type: z.enum(['image', 'document']),
    name: z.string().max(500),
    mimeType: z.string().max(200),
    /** Base64 data URI (e.g. "data:image/png;base64,...") */
    data: z.string().max(15_000_000), // ~10 MB base64 ≈ 13.3 M chars
    /** Server-side attachment ID (upload-then-reference pattern).
     *  When present, the pipeline loads extracted text from DB instead of re-extracting from data. */
    fileId: uuid.optional(),
  })).max(5).optional(),

  // ── Pre-uploaded attachment IDs (follow-up messages) ───
  // On follow-ups, the frontend sends only IDs — no base64 payloads.
  attachmentIds: z.array(uuid).max(5).optional(),
})
  // Strip unknown keys so typos like "enableRerankingg" produce a clean
  // object without silently passing through.
  .strict();

// ── Derived TypeScript type ──────────────────────────────────────────

export type QuestionRequestInput = z.input<typeof QuestionRequestSchema>;
export type QuestionRequestParsed = z.output<typeof QuestionRequestSchema>;

// ── Regenerate schema ────────────────────────────────────────────────

export const RegenerateRequestSchema = z.object({
  /** ID of the assistant message to regenerate */
  messageId: z.string().uuid(),
  /** Conversation owning this message */
  conversationId: z.string().uuid(),
  /** Optional overrides merged onto the original request */
  options: z.object({
    model: z.string().optional(),
    maxDocumentChunks: z.number().int().positive().max(100).optional(),
    maxSearchResults: z.number().int().positive().max(50).optional(),
    enableWebSearch: z.boolean().optional(),
    enableDocumentSearch: z.boolean().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().max(128000).optional(),
  }).optional(),
}).strict();

export type RegenerateRequestParsed = z.output<typeof RegenerateRequestSchema>;
