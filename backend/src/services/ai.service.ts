import { openai } from '../config/openai';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import OpenAI from 'openai';
import { SearchService, SearchRequest } from './search.service';
import { RAGService, RAGOptions } from './rag.service';
import { FewShotSelectorService, FewShotSelectionOptions } from './few-shot-selector.service';
import { CitationValidatorService } from './citation-validator.service';
import { AnswerQualityService } from './answer-quality.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { RetryService } from './retry.service';
import { DegradationService, ServiceType, DegradationLevel } from './degradation.service';
import { CircuitBreakerService, CircuitState } from './circuit-breaker.service';
import { LatencyTrackerService, OperationType } from './latency-tracker.service';
import { ErrorTrackerService, ServiceType as ErrorServiceType } from './error-tracker.service';
import { QualityMetricsService, QualityMetricType } from './quality-metrics.service';

export interface QuestionRequest {
  question: string;
  context?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  // Search options
  enableSearch?: boolean;
  topic?: string; // Any keyword for topic filtering
  maxSearchResults?: number;
  optimizeSearchQuery?: boolean; // Enable query optimization for web search
  searchOptimizationContext?: string; // Context for search query optimization
  useTopicAwareQuery?: boolean; // Use topic-aware query construction
  topicQueryOptions?: import('./topic-query-builder.service').TopicQueryOptions; // Options for topic-aware query construction
  // Advanced search filters
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  startDate?: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string (YYYY-MM-DD)
  country?: string; // ISO country code (e.g., 'US', 'UG', 'KE')
  // RAG options
  enableDocumentSearch?: boolean; // Search user's uploaded documents
  enableWebSearch?: boolean; // Search web via Tavily
  topicId?: string; // Topic ID for filtering documents
  documentIds?: string[]; // Specific documents to search
  maxDocumentChunks?: number; // Max document chunks to retrieve
  minScore?: number; // Minimum similarity score for document chunks
  // Query expansion options
  enableQueryExpansion?: boolean; // Enable query expansion for better recall
  expansionStrategy?: 'llm' | 'embedding' | 'hybrid' | 'none'; // Expansion strategy
  maxExpansions?: number; // Maximum number of expansion terms
  // Query rewriting options
  enableQueryRewriting?: boolean; // Enable query rewriting (default: false)
  queryRewritingOptions?: import('./query-rewriter.service').QueryRewritingOptions; // Options for query rewriting
  // Web result re-ranking options
  enableWebResultReranking?: boolean; // Enable web result re-ranking (default: false)
  webResultRerankingConfig?: import('./web-result-reranker.service').RerankingConfig; // Re-ranking configuration
  // Quality scoring options
  enableQualityScoring?: boolean; // Enable quality scoring (default: false)
  qualityScoringConfig?: import('./result-quality-scorer.service').QualityScoringConfig; // Quality scoring configuration
  minQualityScore?: number; // Minimum quality score threshold (0-1, default: 0.5)
  filterByQuality?: boolean; // Filter results by quality threshold (default: false)
  // Re-ranking options
  enableReranking?: boolean; // Enable re-ranking of results
  rerankingStrategy?: 'cross-encoder' | 'score-based' | 'hybrid' | 'none'; // Re-ranking strategy
  rerankingTopK?: number; // Number of results to re-rank
  rerankingMaxResults?: number; // Maximum results after re-ranking
  // Adaptive threshold options
  useAdaptiveThreshold?: boolean; // Enable adaptive similarity thresholds
  minResults?: number; // Minimum number of results desired
  maxResults?: number; // Maximum number of results desired (for threshold optimization)
  // Diversity filtering options
  enableDiversityFilter?: boolean; // Enable diversity filtering (MMR)
  diversityLambda?: number; // Diversity parameter (0-1): higher = more relevance, lower = more diversity
  diversityMaxResults?: number; // Maximum results after diversity filtering
  // Deduplication options
  enableResultDeduplication?: boolean; // Enable comprehensive result deduplication
  deduplicationThreshold?: number; // Similarity threshold for deduplication (0-1)
  deduplicationNearDuplicateThreshold?: number; // Threshold for near-duplicates (0-1)
  // Adaptive context selection options
  useAdaptiveContextSelection?: boolean; // Enable adaptive context selection based on query complexity (legacy)
  enableAdaptiveContextSelection?: boolean; // Enable adaptive context selection (default: true)
  adaptiveContextOptions?: import('./adaptive-context.service').AdaptiveContextOptions; // Adaptive context configuration
  minChunks?: number; // Minimum number of chunks
  maxChunks?: number; // Maximum number of chunks
  // Dynamic limits options
  enableDynamicLimits?: boolean; // Enable dynamic limit calculation (default: true)
  dynamicLimitOptions?: import('../config/rag.config').DynamicLimitOptions; // Dynamic limit configuration
  // Relevance ordering options
  enableRelevanceOrdering?: boolean; // Enable relevance-based ordering (default: true)
  orderingOptions?: import('./relevance-ordering.service').OrderingOptions; // Ordering configuration
  // Context compression options
  enableContextCompression?: boolean; // Enable context compression (default: true)
  compressionOptions?: import('./context-compressor.service').CompressionOptions; // Compression configuration
  maxContextTokens?: number; // Maximum tokens for context (default: 8000)
  // Context summarization options
  enableContextSummarization?: boolean; // Enable context summarization (default: true)
  summarizationOptions?: import('./context-summarizer.service').SummarizationOptions; // Summarization configuration
  // Source prioritization options
  enableSourcePrioritization?: boolean; // Enable source prioritization (default: true)
  prioritizationOptions?: import('./source-prioritizer.service').PrioritizationOptions; // Prioritization configuration
  // Token budgeting options
  enableTokenBudgeting?: boolean; // Enable token budgeting (default: true)
  tokenBudgetOptions?: import('./token-budget.service').TokenBudgetOptions; // Token budget configuration
  // Few-shot examples options
  enableFewShotExamples?: boolean; // Enable few-shot examples (default: true)
  fewShotOptions?: FewShotSelectionOptions; // Few-shot example selection configuration
  // Conversation summarization options
  enableConversationSummarization?: boolean; // Enable conversation history summarization (default: true)
  conversationSummarizationOptions?: import('./conversation-summarizer.service').ConversationSummarizationOptions; // Summarization configuration
  // History filtering options
  enableHistoryFiltering?: boolean; // Enable relevance-based history filtering (default: true)
  historyFilterOptions?: import('./history-filter.service').HistoryFilterOptions; // History filtering configuration
  // Sliding window options
  enableSlidingWindow?: boolean; // Enable sliding window for long conversations (default: true)
  slidingWindowOptions?: import('./sliding-window.service').SlidingWindowOptions; // Sliding window configuration
  // Conversation state tracking options
  enableStateTracking?: boolean; // Enable conversation state tracking (default: true)
  stateTrackingOptions?: import('./conversation-state.service').StateTrackingOptions; // State tracking configuration
  // Citation parsing options
  enableCitationParsing?: boolean; // Enable citation parsing from response (default: true)
  citationParseOptions?: import('./citation-parser.service').CitationParseOptions; // Citation parsing configuration
  // Conversation management
  conversationId?: string; // Save messages to this conversation (auto-create if not provided)
}

export interface Source {
  type: 'document' | 'web';
  title: string;
  url?: string;
  documentId?: string;
  snippet?: string;
  score?: number;
  metadata?: import('../types/source').SourceMetadata;
}

export interface QuestionResponse {
  answer: string;
  model: string;
  sources?: Source[];
  citations?: {
    total: number;
    document: number;
    web: number;
    reference: number;
    parsed: import('./citation-parser.service').ParsedCitation[];
    validation?: {
      isValid: boolean;
      matched: number;
      unmatched: number;
      errors: string[];
      warnings: string[];
      suggestions: string[];
      missingSources: string[];
      invalidUrls: string[];
      invalidDocumentIds: string[];
    };
    inline?: import('../types/citation').InlineCitationData;
  };
  followUpQuestions?: string[]; // AI-generated follow-up questions
  refusal?: boolean; // true when response is an off-topic refusal (e.g. from pre-check) (11.1)
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  // Degradation information
  degraded?: boolean;
  degradationLevel?: DegradationLevel;
  degradationMessage?: string;
  partial?: boolean; // Indicates if results are partial due to degradation
}

/**
 * AI Service
 * Handles AI question-answering using OpenAI API
 */
export class AIService {
  // Default model configuration
  private static readonly DEFAULT_MODEL = 'gpt-3.5-turbo';
  private static readonly DEFAULT_TEMPERATURE = 0.7;
  private static readonly DEFAULT_MAX_TOKENS = 1800; // enough for answer + FOLLOW_UP_QUESTIONS on 2nd+ turns and in research mode

  /**
   * Build system prompt with RAG context (documents + web search)
   */
  /** Refusal message when off-topic (pre-check or model refusal). */
  static getRefusalMessage(topicName: string): string {
    return `I'm currently in Research Topic Mode and limited to **${topicName}**. Your question seems outside this scope. You can ask about ${topicName} or disable research mode to ask anything.`;
  }

  /** Single meta follow-up for off-topic refusals. */
  static getRefusalFollowUp(topicName: string): string {
    return `Would you like to ask something about ${topicName}?`;
  }

  /**
   * Off-topic pre-check: lightweight LLM call. Returns true = on-topic (proceed), false = off-topic (refuse).
   * When in doubt, returns true to avoid blocking valid questions.
   */
  static async runOffTopicPreCheck(
    question: string,
    topicName: string,
    topicDescription?: string,
    topicScopeConfig?: Record<string, any> | null
  ): Promise<boolean> {
    // Track latency for off-topic check
    return await LatencyTrackerService.trackOperation(
      OperationType.AI_OFF_TOPIC_CHECK,
      async () => {
        return await this.runOffTopicPreCheckInternal(question, topicName, topicDescription, topicScopeConfig);
      }
    );
  }

  /**
   * Internal method for off-topic pre-check
   */
  private static async runOffTopicPreCheckInternal(
    question: string,
    topicName: string,
    topicDescription?: string,
    topicScopeConfig?: Record<string, any> | null
  ): Promise<boolean> {
    const scopeLine = this.deriveScopeFromConfig(topicScopeConfig);
    const desc = topicDescription || 'general';
    const prompt = `Topic: ${topicName}. Description: ${desc}.${scopeLine}

Question: ${question}

Is this question clearly within the topic? Answer only YES or NO.`;
    try {
      // Use retry service for off-topic pre-check
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 10,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 500,
          multiplier: 2,
          maxDelay: 5000,
        }
      );

      const completion = retryResult.result;
      const text = (completion.choices[0]?.message?.content || '').trim().toUpperCase();
      // Treat as off-topic only when the answer clearly starts with NO
      if (/^NO\b/.test(text)) return false;
      return true;
    } catch (err: any) {
      logger.warn('Off-topic pre-check failed, proceeding with full flow', { error: err?.message });
      return true; // on error, proceed to avoid blocking
    }
  }

  /**
   * Derive a short scope line from topic.scope_config for the Research Topic Mode prompt.
   * Supports: { keywords: string[], subtopics: string[] }
   */
  private static deriveScopeFromConfig(scopeConfig?: Record<string, any> | null): string {
    if (!scopeConfig || typeof scopeConfig !== 'object') return '';
    const parts: string[] = [];
    if (Array.isArray(scopeConfig.keywords) && scopeConfig.keywords.length > 0) {
      const kw = scopeConfig.keywords.slice(0, 10).filter((s: any) => typeof s === 'string').join(', ');
      if (kw) parts.push(`keywords: ${kw}`);
    }
    if (Array.isArray(scopeConfig.subtopics) && scopeConfig.subtopics.length > 0) {
      const st = scopeConfig.subtopics.slice(0, 10).filter((s: any) => typeof s === 'string').join(', ');
      if (st) parts.push(`subtopics: ${st}`);
    }
    if (parts.length === 0) return '';
    return ` Scope includes: ${parts.join('; ')}.`;
  }

  private static buildSystemPrompt(
    ragContext?: string,
    additionalContext?: string,
    enableDocumentSearch?: boolean,
    enableWebSearch?: boolean,
    timeFilter?: { timeRange?: string; startDate?: string; endDate?: string; topic?: string; country?: string },
    topicName?: string,
    topicDescription?: string,
    topicScopeConfig?: Record<string, any> | null,
    fewShotExamples?: string,
    conversationState?: string
  ): string {
    const hasDocuments = ragContext?.includes('Relevant Document Excerpts:') || false;
    const hasWebResults = ragContext?.includes('Web Search Results:') || false;
    
    let modeInstruction = '';
    if (enableDocumentSearch && !enableWebSearch) {
      modeInstruction = `IMPORTANT: You are in DOCUMENT-ONLY mode. You MUST ONLY use information from the provided document excerpts. Do NOT use any general knowledge or web information. If the document excerpts do not contain the answer, you must clearly state that the information is not available in the provided documents.`;
    } else if (!enableDocumentSearch && enableWebSearch) {
      modeInstruction = `IMPORTANT: You are in WEB-ONLY mode. You MUST ONLY use information from the provided web search results.`;
    } else if (enableDocumentSearch && enableWebSearch) {
      modeInstruction = `You can use both document excerpts and web search results. Prioritize document excerpts when they directly answer the question.`;
    }

    // Add time filter context if applicable
    let timeFilterInstruction = '';
    if (timeFilter) {
      if (timeFilter.timeRange) {
        const timeRangeLabels: Record<string, string> = {
          'day': 'last 24 hours',
          'd': 'last 24 hours',
          'week': 'last 7 days',
          'w': 'last 7 days',
          'month': 'last 30 days',
          'm': 'last 30 days',
          'year': 'last 12 months',
          'y': 'last 12 months',
        };
        const timeLabel = timeRangeLabels[timeFilter.timeRange] || timeFilter.timeRange;
        timeFilterInstruction = `\n\nCRITICAL TIME FILTER CONTEXT: The user has applied a time filter for "${timeLabel}". All information you provide MUST be from this time period. When responding:\n- Explicitly mention that the information is from the specified time period (e.g., "Based on information from the last 24 hours...")\n- If the sources don't contain information from this time period, clearly state that no recent information is available\n- Emphasize the recency of the information in your response\n- Do NOT include information that is clearly outside this time range`;
      } else if (timeFilter.startDate || timeFilter.endDate) {
        timeFilterInstruction = `\n\nCRITICAL TIME FILTER CONTEXT: The user has applied a custom date range filter (${timeFilter.startDate || 'start'} to ${timeFilter.endDate || 'end'}). All information you provide MUST be from this date range.`;
      }
      
      if (timeFilter.topic) {
        timeFilterInstruction += `\n- The search is filtered by topic/keyword: "${timeFilter.topic}"`;
      }
      if (timeFilter.country) {
        timeFilterInstruction += `\n- The search is filtered by country: "${timeFilter.country}"`;
      }
    }

    // Research Topic Mode: when topicName is set, scope all answers. If scope_config.strict !== false, also refuse off-topic (12.1).
    let topicScopeInstruction = '';
    if (topicName) {
      const isStrict = topicScopeConfig?.strict !== false; // default true
      if (isStrict) {
        topicScopeInstruction = `\n\nRESEARCH TOPIC MODE (STRICT): You are in **Research Topic Mode**. Your research topic is: **${topicName}**.${topicDescription ? ` Scope: ${topicDescription}` : ''}${this.deriveScopeFromConfig(topicScopeConfig)}

You MUST:
- Answer fully and use documents/web search ONLY for questions that are clearly on-topic or reasonably related to "${topicName}".
- REFUSE off-topic questions: If the user's question is clearly unrelated to "${topicName}", give a short, polite refusal (1–2 sentences). Do NOT provide a substantive answer and do NOT use document or web sources for off-topic questions. Example: "That's outside my current research focus on ${topicName}. Would you like to ask something about ${topicName}?"
- For questions that are tangential: give a brief, steered answer that ties back to "${topicName}" when possible.
- When you refuse as off-topic: do NOT include a FOLLOW_UP_QUESTIONS block, or include only one meta follow-up such as "Would you like to ask something about ${topicName}?"`;
      } else {
        topicScopeInstruction = `\n\nTOPIC SCOPE: You are currently operating within the topic scope of "${topicName}".${topicDescription ? ` Scope: ${topicDescription}` : ''}${this.deriveScopeFromConfig(topicScopeConfig)}

All your responses should be focused on this specific topic domain. When searching for information or providing answers:
- Prioritize information directly related to "${topicName}"
- If information is not available within this topic scope, clearly indicate this limitation
- Maintain focus on the topic context throughout your response`;
      }
    }

    // Get enhanced guidelines in parallel for better performance
    const [citationGuidelinesResult, qualityGuidelinesResult, conflictResolutionGuidelinesResult] = await Promise.allSettled([
      Promise.resolve(CitationValidatorService.formatCitationGuidelines()),
      Promise.resolve(AnswerQualityService.formatQualityGuidelines()),
      Promise.resolve(ConflictResolutionService.formatConflictResolutionGuidelines()),
    ]);

    let citationGuidelines = '';
    if (citationGuidelinesResult.status === 'fulfilled') {
      citationGuidelines = citationGuidelinesResult.value;
    } else {
      logger.warn('Failed to load citation guidelines, using basic instructions', {
        error: citationGuidelinesResult.reason?.message,
      });
    }

    let qualityGuidelines = '';
    if (qualityGuidelinesResult.status === 'fulfilled') {
      qualityGuidelines = qualityGuidelinesResult.value;
    } else {
      logger.warn('Failed to load answer quality guidelines, using basic instructions', {
        error: qualityGuidelinesResult.reason?.message,
      });
    }

    let conflictResolutionGuidelines = '';
    if (conflictResolutionGuidelinesResult.status === 'fulfilled') {
      conflictResolutionGuidelines = conflictResolutionGuidelinesResult.value;
    } else {
      logger.warn('Failed to load conflict resolution guidelines, using basic instructions', {
        error: conflictResolutionGuidelinesResult.reason?.message,
      });
    }

    const basePrompt = `You are a helpful AI assistant that provides accurate, informative, and well-structured answers to user questions using Retrieval-Augmented Generation (RAG).

${modeInstruction}${timeFilterInstruction}${topicScopeInstruction}

CRITICAL SOURCE CITATION REQUIREMENT (MANDATORY - NO EXCEPTIONS):
EVERY SINGLE PIECE OF INFORMATION in your response MUST have an inline clickable source hyperlink. This is NON-NEGOTIABLE and applies to:
- Direct question responses
- All facts, claims, data, statistics, quotes, or any information presented
- Every sentence that contains factual information must include a source link
- NO information should be presented without a source citation

${citationGuidelines}

${qualityGuidelines}

${conflictResolutionGuidelines}

Guidelines:
- Provide clear, concise, and accurate answers
- Use information from the provided document excerpts and/or web search results based on the mode
- If you don't know something based on the provided sources, admit it rather than guessing
- Use proper formatting (bullet points, paragraphs) when appropriate
- Format your responses with clear structure: Use paragraphs for main points, bullet points for lists, and bold text for key terms when appropriate
- Provide concise but comprehensive summaries that capture the essential information
- Be friendly and professional`;

    let fullContext = '';

    // Add conversation state if available
    if (conversationState) {
      fullContext += `\n\n## Conversation Context\n${conversationState}\n`;
    }

    // Add RAG context (documents + web search)
    if (ragContext) {
      fullContext += ragContext;
    }

    // Add warning if document-only mode but no documents found
    if (enableDocumentSearch && !enableWebSearch && !hasDocuments) {
      fullContext += '\n\nWARNING: Document search was enabled but no relevant document excerpts were found. You must inform the user that the information is not available in their documents.';
    }

    // Add additional context if provided
    if (additionalContext) {
      fullContext += `Additional Context:\n${additionalContext}\n`;
    }

    // Add few-shot examples if provided
    let examplesSection = '';
    if (fewShotExamples) {
      examplesSection = fewShotExamples;
    }

    if (fullContext) {
      return `${basePrompt}${examplesSection}

${fullContext}

CRITICAL: Use the provided sources to answer the question. ${enableDocumentSearch && !enableWebSearch ? 'Remember: You are in DOCUMENT-ONLY mode. Only use information from the document excerpts provided above.' : ''} 

RESPONSE FORMATTING (CRITICAL - FOLLOW EXACTLY - PARAGRAPH-PER-SOURCE):
You MUST format your response as 3-5 short, spaced paragraphs following these rules:

1. EACH PARAGRAPH MUST:
   - Cover ONE distinct idea or perspective
   - Be derived from ONE source (either one document or one web source)
   - Be 2-4 sentences long
   - Be visually separated with blank lines between paragraphs
   - Include exactly ONE inline clickable source hyperlink embedded within the paragraph

2. INLINE SOURCE ATTRIBUTION (CRITICAL - ALWAYS USE CLICKABLE LINKS - MANDATORY FOR EVERY PARAGRAPH):
   - Each paragraph MUST contain exactly ONE clickable source link embedded inline. Never use bold or plain text for a source—always use markdown [text](URL).
   - EVERY sentence containing factual information MUST include a source citation. No exceptions.
   - For web sources: You MUST use [Web Source 1](URL), [Web Source 2](URL), etc. exactly as labeled in the "Web Search Results" context. The URLs are in that context. This makes links work in the app.
   - For documents: Use [Document 1], [Document 2], etc. as in the "Relevant Document Excerpts" context, or [Document Name](document://id) when a URL is shown.
   - The source link should appear naturally within the paragraph text, not at the end
   - If a paragraph contains multiple facts, each fact should reference the same source or use multiple citations
   - Example: "SQL is a standard language used to manage relational databases, allowing users to query and modify structured data efficiently. [official documentation](https://example.com/docs)"
   - Another example: "Relational systems such as MySQL and PostgreSQL rely on SQL to define schemas and enforce data integrity. [Database Guide](document://doc123)"
   - REMEMBER: Every piece of information must be traceable to a source. If you cannot cite a source, do not include that information.
   
   CITATION ENFORCEMENT:
   - Before submitting your response, verify that EVERY factual statement has a citation
   - Check that ALL statistics, numbers, and data points are cited
   - Ensure ALL quotes and attributed statements have citations
   - Validate that citation formats match the examples provided above
   - Confirm that URLs in web citations match exactly those provided in the context
   - If you find any uncited factual information, either add a citation or remove that information

3. PARAGRAPH STRUCTURE:
   - NO numbered lists, bullet points, or structured sections
   - NO introduction or conclusion paragraphs
   - Each paragraph is standalone and covers one perspective
   - Paragraphs should flow naturally but be distinct from each other
   - Use proper spacing (blank line) between each paragraph

4. SOURCE DISTRIBUTION:
   - Use different sources for different paragraphs when possible
   - Each paragraph should reference a different source or different aspect from sources
   - Do NOT repeat the same source in consecutive paragraphs unless necessary

5. FORMATTING:
   - Use bold text (**text**) for key terms or important concepts within paragraphs
   - Keep language clear and concise
   - Focus on the user's question and keyword throughout

Example format:
SQL is a standard language used to manage relational databases, allowing users to query and modify structured data efficiently. [SQL Documentation](https://example.com/sql-docs)

Relational systems such as MySQL and PostgreSQL rely on SQL to define schemas and enforce data integrity. [Database Systems Guide](document://db-guide-123)

SQL supports complex operations such as joins and aggregations, enabling advanced data analysis directly within databases. [Advanced SQL Tutorial](https://example.com/advanced-sql)

IMPORTANT: There is NO separate "Sources:" section. All source attribution is inline within each paragraph.

VALIDATION CHECK: Before finalizing your response, verify that:
- Every paragraph contains at least one inline source hyperlink
- Every factual statement has a source citation
- No information is presented without a source
- All web sources use the format [text](URL) with clickable links
- All document sources use [Document N] or [Document Name](document://id) format

If you cannot cite a source for information, DO NOT include that information in your response.

${this.getFollowUpBlock(topicName)}`;
    }

    // If no context and document-only mode, provide clear instruction
    if (enableDocumentSearch && !enableWebSearch) {
      return `${basePrompt}

No document excerpts were found for this query. You must inform the user that the information is not available in their documents.

REMINDER: Even when stating that information is not available, if you provide any general information or context, it must still include source citations if sources are available.

${this.getFollowUpBlock(topicName)}`;
    }

    return `${basePrompt}

CRITICAL REMINDER: If you provide any information in your response, it MUST include inline source hyperlinks. Every factual statement requires a source citation. No exceptions.

${this.getFollowUpBlock(topicName)}`;
  }

  /** FOLLOW_UP_QUESTIONS block: mandatory on every response (research or not), dynamic from latest Q&A. */
  private static getFollowUpBlock(topicName?: string): string {
    return `FOLLOW-UP QUESTIONS (MANDATORY - EVERY RESPONSE, RESEARCH MODE OR NOT):
This is NON-NEGOTIABLE: every response in the conversation thread MUST end with a FOLLOW_UP_QUESTIONS block. Applies to: first answer, every follow-up, multi-turn, and Research Topic Mode. The only exception is off-topic refusals (those use at most one meta follow-up).
The 4 questions MUST be dynamically generated from the latest user question and your answer in this turn—based on the specific subject and content just discussed, not generic templates or previous follow-ups. If your answer is long, still end with the FOLLOW_UP_QUESTIONS block; do not truncate or omit it.

CRITICAL: When these follow-up questions are asked and answered later, those answers MUST include inline source hyperlinks for every piece of information, as per the mandatory citation requirements.

After your complete answer, add a line break, then "FOLLOW_UP_QUESTIONS:" followed by exactly 4 questions, one per line, each starting with "- "
These questions should:
- Be directly related to the user's question and your answer
- Explore different aspects, deeper details, or related topics
- Be specific and actionable (not generic)
- Help the user learn more about the topic
- Be phrased as complete questions (e.g., "How does X work?" not just "X details")
- Use the actual topic/subject from the user's question, NOT section headings like "Summary" or "Key Points"${topicName ? `\n- When in Research Topic Mode: all 4 follow-up questions must be clearly within the topic "${topicName}" and help the user explore it further.` : ''}
Example format:
FOLLOW_UP_QUESTIONS:
- How does [main topic] work in practice?
- What are the key benefits and challenges of [main topic]?
- Can you provide examples of [main topic] in real-world applications?
- What should I know about [related aspect]?`;
  }

  /**
   * Generate 2–4 follow-up questions from the latest Q&A when the main model omits them.
   * Used as a fallback so every response has follow-ups (research or not).
   * Note: Follow-up questions themselves are just questions, not answers, so they don't need source citations.
   * However, when these questions are asked and answered, those answers MUST include source citations.
   */
  static async generateFollowUpQuestions(question: string, answer: string, topicName?: string): Promise<string[]> {
    // Track latency for follow-up generation
    return await LatencyTrackerService.trackOperation(
      OperationType.AI_FOLLOW_UP_GENERATION,
      async () => {
        return await this.generateFollowUpQuestionsInternal(question, answer, topicName);
      }
    );
  }

  /**
   * Internal method for generating follow-up questions
   */
  private static async generateFollowUpQuestionsInternal(question: string, answer: string, topicName?: string): Promise<string[]> {
    const ans = answer.length > 1500 ? answer.slice(0, 1500) + '...' : answer;
    const prompt = `Based on this exchange, generate exactly 4 short follow-up questions.

User asked: ${question}

Assistant answered: ${ans}
${topicName ? `\nKeep all questions clearly within the research topic: "${topicName}".` : ''}

IMPORTANT: These are questions only. When these questions are answered later, those answers MUST include inline source hyperlinks for every piece of information, as per the citation requirements.

Output only the 4 questions, one per line. No numbering or bullets. Each must be a complete question and derived from the specific content above.`;
    try {
      // Use retry service for follow-up question generation
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model: this.DEFAULT_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 300,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 500,
          multiplier: 2,
          maxDelay: 5000,
        }
      );

      const c = retryResult.result;
      const text = c.choices[0]?.message?.content || '';
      const lines = text.split('\n').map((l) => l.replace(/^\s*[-*•]?\s*\d*\.?\s*/, '').trim()).filter((l) => l.length > 5 && l.length < 200);
      return lines.slice(0, 4);
    } catch (err: any) {
      logger.warn('Failed to generate follow-up questions fallback', { error: err?.message });
      return [];
    }
  }

  /**
   * Build conversation messages for OpenAI API
   */
  private static buildMessages(
    question: string,
    ragContext?: string,
    additionalContext?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    enableDocumentSearch?: boolean,
    enableWebSearch?: boolean,
    timeFilter?: { timeRange?: string; startDate?: string; endDate?: string; topic?: string; country?: string },
    topicName?: string,
    topicDescription?: string,
    topicScopeConfig?: Record<string, any> | null,
    fewShotExamples?: string,
    conversationState?: string
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt with RAG context and few-shot examples
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(ragContext, additionalContext, enableDocumentSearch, enableWebSearch, timeFilter, topicName, topicDescription, topicScopeConfig, fewShotExamples, conversationState),
    });

    // Add conversation history if provided (strip FOLLOW_UP_QUESTIONS from assistant content to save tokens and give the model room to emit its own)
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        const content = msg.role === 'assistant'
          ? (msg.content || '').replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim()
          : (msg.content || '').trim();
        messages.push({ role: msg.role, content });
      }
    }

    // Add current question
    messages.push({
      role: 'user',
      content: question,
    });

    return messages;
  }

  /**
   * Answer a question using OpenAI API with RAG (non-streaming)
   */
  static async answerQuestion(
    request: QuestionRequest,
    userId?: string
  ): Promise<QuestionResponse> {
    // Track latency for AI question answering
    return await LatencyTrackerService.trackOperation(
      OperationType.AI_QUESTION_ANSWERING,
      async () => {
        return await this.answerQuestionInternal(request, userId);
      },
      {
        userId,
        metadata: {
          questionLength: request.question.length,
          enableSearch: request.enableSearch,
          enableDocumentSearch: request.enableDocumentSearch,
          enableWebSearch: request.enableWebSearch,
        },
      }
    );
  }

  /**
   * Internal method for answering questions
   */
  private static async answerQuestionInternal(
    request: QuestionRequest,
    userId?: string
  ): Promise<QuestionResponse> {
    try {
      // Validate input
      if (!request.question || request.question.trim().length === 0) {
        throw new ValidationError('Question is required');
      }

      if (request.question.length > 2000) {
        throw new ValidationError('Question is too long (max 2000 characters)');
      }

      const model = request.model || this.DEFAULT_MODEL;
      const temperature = request.temperature ?? this.DEFAULT_TEMPERATURE;
      const maxTokens = request.maxTokens || this.DEFAULT_MAX_TOKENS;

      // Fetch topic details if topicId is provided (for Research Topic Mode)
      // This can be done in parallel with RAG context retrieval if userId is available
      let topicName: string | undefined;
      let topicDescription: string | undefined;
      let topicScopeConfig: Record<string, any> | null | undefined;
      
      const topicFetchPromise = request.topicId && userId
        ? (async () => {
            try {
              const { TopicService } = await import('./topic.service');
              const topic = await TopicService.getTopic(request.topicId!, userId);
              if (topic) {
                return {
                  topicName: topic.name,
                  topicDescription: topic.description ?? undefined,
                  topicScopeConfig: topic.scope_config ?? null,
                };
              }
            } catch (topicError: any) {
              logger.warn('Failed to fetch topic details', {
                topicId: request.topicId,
                error: topicError.message,
              });
            }
            return null;
          })()
        : Promise.resolve(null);

      // Wait for topic fetch to complete before off-topic check
      const topicResult = await topicFetchPromise;
      if (topicResult) {
        topicName = topicResult.topicName;
        topicDescription = topicResult.topicDescription;
        topicScopeConfig = topicResult.topicScopeConfig;
        logger.info('Topic context loaded', { topicId: request.topicId, topicName });
      }

      // Off-topic pre-check: skip RAG and return refusal when enabled and question is off-topic (8.x, 13.1)
      const preCheckEnabled =
        !!topicName &&
        process.env.ENABLE_OFF_TOPIC_PRE_CHECK !== 'false' &&
        topicScopeConfig?.enable_off_topic_pre_check !== false;
      if (preCheckEnabled && topicName) {
        const onTopic = await this.runOffTopicPreCheck(
          request.question,
          topicName,
          topicDescription,
          topicScopeConfig
        );
        if (!onTopic) {
          const refusal = this.getRefusalMessage(topicName);
          const followUp = this.getRefusalFollowUp(topicName);
          let conversationIdForResponse = request.conversationId;
          if (request.conversationId && userId) {
            try {
              const { ConversationService } = await import('./conversation.service');
              const { MessageService } = await import('./message.service');
              let conversation = await ConversationService.getConversation(request.conversationId, userId);
              let cid = request.conversationId;
              if (!conversation) {
                conversation = await ConversationService.createConversation({
                  userId,
                  title: ConversationService.generateTitleFromMessage(request.question),
                  topicId: request.topicId,
                });
                cid = conversation.id;
                conversationIdForResponse = cid;
              }
              await MessageService.saveMessagePair(cid, request.question, refusal, [], {
                followUpQuestions: [followUp],
                isRefusal: true,
              });
            } catch (e: any) {
              logger.warn('Failed to save refusal to conversation', { error: e?.message });
            }
          }
          const response: QuestionResponse = {
            answer: refusal,
            model: model,
            sources: [],
            followUpQuestions: [followUp],
            refusal: true,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          };
          (response as any).conversationId = conversationIdForResponse;
          return response;
        }
      }

      // Retrieve RAG context (documents + web search)
      let ragContext: string | undefined;
      let sources: Source[] | undefined;
      let contextDegraded = false;
      let contextDegradationLevel: DegradationLevel | undefined;
      let contextDegradationMessage: string | undefined;
      let contextPartial = false;

      if (userId) {
        try {
          const ragOptions: RAGOptions = {
            userId,
            topicId: request.topicId,
            documentIds: request.documentIds,
            enableDocumentSearch: request.enableDocumentSearch !== false, // Default to true
            enableWebSearch: request.enableWebSearch !== false, // Default to true (if enableSearch is true)
            maxDocumentChunks: request.maxDocumentChunks || 5,
            maxWebResults: request.maxSearchResults || 5,
            minScore: request.minScore || 0.7, // Higher threshold to ensure relevance
            // Web search filters
            topic: request.topic,
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            country: request.country,
            // Query expansion options
            enableQueryExpansion: request.enableQueryExpansion ?? false,
            expansionStrategy: request.expansionStrategy,
            maxExpansions: request.maxExpansions,
            enableQueryRewriting: request.enableQueryRewriting ?? false, // Default to false
            queryRewritingOptions: request.queryRewritingOptions,
            enableWebResultReranking: request.enableWebResultReranking ?? false, // Default to false
            webResultRerankingConfig: request.webResultRerankingConfig,
            enableQualityScoring: request.enableQualityScoring ?? false, // Default to false
            qualityScoringConfig: request.qualityScoringConfig,
            minQualityScore: request.minQualityScore,
            filterByQuality: request.filterByQuality ?? false, // Default to false
            // Re-ranking options
            enableReranking: request.enableReranking ?? false,
            rerankingStrategy: request.rerankingStrategy,
            rerankingTopK: request.rerankingTopK,
            rerankingMaxResults: request.rerankingMaxResults,
            // Adaptive threshold options
            useAdaptiveThreshold: request.useAdaptiveThreshold ?? true, // Default to true
            minResults: request.minResults,
            maxResults: request.maxResults,
            // Diversity filtering options
            enableDiversityFilter: request.enableDiversityFilter ?? false, // Default to false
            diversityLambda: request.diversityLambda,
            diversityMaxResults: request.diversityMaxResults,
            diversitySimilarityThreshold: undefined, // Use default from config
            // Deduplication options
            enableResultDeduplication: request.enableResultDeduplication ?? false, // Default to false
            deduplicationThreshold: request.deduplicationThreshold,
            deduplicationNearDuplicateThreshold: request.deduplicationNearDuplicateThreshold,
            // Adaptive context selection options
            useAdaptiveContextSelection: request.useAdaptiveContextSelection ?? true, // Default to true (legacy)
            enableAdaptiveContextSelection: request.enableAdaptiveContextSelection ?? true, // Default to true
            adaptiveContextOptions: request.adaptiveContextOptions,
            minChunks: request.minChunks,
            maxChunks: request.maxChunks,
            // Dynamic limits options
            enableDynamicLimits: request.enableDynamicLimits ?? true, // Default to true
            dynamicLimitOptions: request.dynamicLimitOptions,
          };

          // Only enable web search if enableSearch is true
          if (request.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }

          // Retrieve RAG context and prepare formatting options in parallel
          const context = await RAGService.retrieveContext(request.question, ragOptions);
          
          // Format context and extract sources in parallel (they're independent operations)
          const [formattedContext, extractedSources] = await Promise.all([
            RAGService.formatContextForPrompt(context, {
              enableRelevanceOrdering: ragOptions.enableRelevanceOrdering ?? true,
              orderingOptions: ragOptions.orderingOptions,
              enableContextSummarization: ragOptions.enableContextSummarization ?? true,
              summarizationOptions: ragOptions.summarizationOptions,
              enableContextCompression: ragOptions.enableContextCompression ?? true,
              compressionOptions: ragOptions.compressionOptions,
              enableSourcePrioritization: ragOptions.enableSourcePrioritization ?? true,
              prioritizationOptions: ragOptions.prioritizationOptions,
              enableTokenBudgeting: ragOptions.enableTokenBudgeting ?? true,
              tokenBudgetOptions: {
                ...ragOptions.tokenBudgetOptions,
                model: request.model || 'gpt-3.5-turbo',
              },
              query: request.question,
              model: request.model || 'gpt-3.5-turbo',
              userId: userId,
            }),
            Promise.resolve(RAGService.extractSources(context)),
          ]);
          
          ragContext = formattedContext;
          sources = extractedSources;

          // Track degradation from context
          const contextDegraded = context.degraded || false;
          const contextDegradationLevel = context.degradationLevel;
          const contextDegradationMessage = context.degradationMessage;
          const contextPartial = context.partial || false;

          logger.info('RAG context retrieved', {
            userId,
            documentChunks: context.documentContexts.length,
            webResults: context.webSearchResults.length,
            totalSources: sources.length,
            degraded: contextDegraded,
            degradationLevel: contextDegradationLevel,
            partial: contextPartial,
          });
        } catch (ragError: any) {
          // Log RAG error but don't fail the entire request
          logger.warn('RAG retrieval failed, continuing without RAG context', {
            error: ragError.message,
            question: request.question,
            userId,
          });
        }
      } else {
        // Fallback to old search method if no userId (backward compatibility)
        if (request.enableSearch !== false) {
          try {
            const searchRequest: SearchRequest = {
              query: request.question,
              topic: request.topic,
              maxResults: request.maxSearchResults || 5,
            };

            const searchResponse = await SearchService.search(searchRequest);
            
            if (searchResponse.results && searchResponse.results.length > 0) {
              const webResults = searchResponse.results.map(r => ({
                title: r.title,
                url: r.url,
                content: r.content,
              }));

              ragContext = await RAGService.formatContextForPrompt({
                documentContexts: [],
                webSearchResults: webResults,
              }, {
                enableRelevanceOrdering: true,
                enableContextSummarization: request.enableContextSummarization ?? true,
                summarizationOptions: request.summarizationOptions,
                enableContextCompression: request.enableContextCompression ?? true,
                compressionOptions: request.compressionOptions,
                enableSourcePrioritization: request.enableSourcePrioritization ?? true,
                prioritizationOptions: request.prioritizationOptions,
                enableTokenBudgeting: request.enableTokenBudgeting ?? true,
                tokenBudgetOptions: {
                  ...request.tokenBudgetOptions,
                  model: request.model || 'gpt-3.5-turbo',
                },
                query: request.question,
                model: request.model || 'gpt-3.5-turbo',
                userId: userId,
              });

              // Get current date as access date for web sources
              const accessDate = new Date().toISOString();
              
              sources = searchResponse.results.map((r) => ({
                type: 'web' as const,
                title: r.title,
                url: r.url,
                snippet: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
                metadata: {
                  publishedDate: r.publishedDate,
                  publicationDate: r.publishedDate,
                  accessDate, // Access date for web sources
                  author: r.author,
                  url: r.url,
                },
              }));

              logger.info('Search results retrieved (fallback)', {
                query: request.question,
                resultsCount: webResults.length,
              });
            }
          } catch (searchError: any) {
            logger.warn('Search failed, continuing without search results', {
              error: searchError.message,
              question: request.question,
            });
          }
        }
      }

      // Build time filter for prompt
      const timeFilter = request.timeRange || request.startDate || request.endDate || request.topic || request.country
        ? {
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            topic: request.topic,
            country: request.country,
          }
        : undefined;

      // Fetch and process conversation history in parallel with RAG context retrieval
      // This can be done independently since it doesn't depend on RAG results
      const conversationHistoryPromise = (async () => {
        let conversationHistory = request.conversationHistory;
        
        if (request.conversationId && userId && !conversationHistory && request.enableConversationSummarization !== false) {
          try {
            const { MessageService } = await import('./message.service');
            
            const summarizationOptions = {
              model: request.model || 'gpt-3.5-turbo',
              ...request.conversationSummarizationOptions,
            };
            
            conversationHistory = await MessageService.getSummarizedHistory(
              request.conversationId,
              userId,
              summarizationOptions
            );
            
            logger.info('Conversation history summarized', {
              conversationId: request.conversationId,
              historyLength: conversationHistory.length,
            });
          } catch (error: any) {
            logger.warn('Failed to fetch/summarize conversation history, continuing without history', {
              error: error.message,
              conversationId: request.conversationId,
            });
          }
        }

        // Filter conversation history by relevance to current query
        if (conversationHistory && conversationHistory.length > 0 && request.enableHistoryFiltering !== false) {
          try {
            const { HistoryFilterService } = await import('./history-filter.service');
            
            const filterOptions = {
              ...request.historyFilterOptions,
            };
            
            const filterResult = await HistoryFilterService.filterHistory(
              request.question,
              conversationHistory,
              filterOptions
            );
            
            conversationHistory = filterResult.filteredHistory;
            
            logger.info('Conversation history filtered by relevance', {
              originalCount: filterResult.stats.originalCount,
              filteredCount: filterResult.stats.filteredCount,
              removedCount: filterResult.stats.removedCount,
              processingTimeMs: filterResult.stats.processingTimeMs,
              avgRelevanceScore: filterResult.scores.reduce((sum, msg) => sum + msg.relevanceScore, 0) / filterResult.scores.length,
            });
          } catch (error: any) {
            logger.warn('Failed to filter conversation history, using original history', {
              error: error.message,
            });
          }
        }

        return conversationHistory;
      })();

      // Wait for RAG context to be available before processing few-shot examples
      // (few-shot examples depend on whether documents/web results are available)
      // But we can prepare the promise structure

      const messages = this.buildMessages(
        request.question,
        ragContext,
        request.context,
        conversationHistory,
        request.enableDocumentSearch,
        request.enableWebSearch,
        timeFilter,
        topicName,
        topicDescription,
        topicScopeConfig,
        fewShotExamplesText,
        conversationStateText
      );

      logger.info('Sending question to OpenAI with RAG', {
        model,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasRAGContext: !!ragContext,
        sourcesCount: sources?.length || 0,
        historyLength: request.conversationHistory?.length || 0,
      });

      // Call OpenAI API with retry logic and circuit breaker
      let completion;
      try {
        const retryResult = await RetryService.execute(
          async () => {
            return await openai.chat.completions.create({
              model,
              messages,
              temperature,
              max_tokens: maxTokens,
            });
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            multiplier: 2,
            maxDelay: 30000,
            onRetry: (error, attempt, delay) => {
              logger.warn('Retrying OpenAI API call', {
                attempt,
                delay,
                error: error.message,
                model,
                questionLength: request.question.length,
              });
            },
          }
        );
        completion = retryResult.result;
      } catch (openaiError: any) {
        // Track error
        ErrorTrackerService.trackError(ErrorServiceType.AI, openaiError, {
          userId,
          metadata: {
            operation: 'answerQuestion',
            questionLength: request.question.length,
          },
        }).catch(() => {});

        // Handle OpenAI service degradation
        DegradationService.handleServiceError(ServiceType.OPENAI, openaiError);
        
        // If we have partial context, we can still provide a degraded response
        if (ragContext && sources && sources.length > 0) {
          logger.warn('OpenAI API failed but partial response available', {
            error: openaiError.message,
            sourcesCount: sources.length,
          });
          
          // Return a degraded response with available context
          const degradationStatus = DegradationService.getOverallStatus();
          return {
            answer: `I apologize, but I'm experiencing technical difficulties with the AI service. However, I found ${sources.length} relevant source${sources.length > 1 ? 's' : ''} that may help answer your question. Please try again in a moment, or review the sources provided below.\n\n${sources.map((s, i) => `${i + 1}. ${s.title}${s.url ? ` (${s.url})` : ''}`).join('\n')}`,
            model: model,
            sources,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            degraded: true,
            degradationLevel: DegradationLevel.SEVERE,
            degradationMessage: degradationStatus.message || 'AI service is currently unavailable',
            partial: true,
          };
        }
        
        // Re-throw if no fallback available
        throw openaiError;
      }

      const fullResponse = completion.choices[0]?.message?.content || 'No response generated';
      
      // Parse citations from response if enabled
      let parsedCitations: import('./citation-parser.service').CitationParseResult | undefined;
      let citationValidation: import('./citation-validator.service').CitationValidationResult | undefined;
      
      if (request.enableCitationParsing !== false) {
        try {
          const { CitationParserService } = await import('./citation-parser.service');
          
          const parseOptions = {
            removeCitations: false, // Keep citations in answer
            preserveFormat: true,
            ...request.citationParseOptions,
          };
          
          parsedCitations = CitationParserService.parseCitations(fullResponse, parseOptions);
          
          logger.info('Citations parsed from response', {
            totalCitations: parsedCitations.citationCount,
            documentCitations: parsedCitations.documentCitations.length,
            webCitations: parsedCitations.webCitations.length,
            referenceCitations: parsedCitations.referenceCitations.length,
            parsingTimeMs: parsedCitations.parsingTimeMs,
          });

          // Validate citations against sources if sources are available
          if (sources && sources.length > 0 && parsedCitations.citations.length > 0) {
            try {
              const { CitationValidatorService } = await import('./citation-validator.service');
              
              // Convert sources to SourceInfo format
              const sourceInfos: import('./citation-validator.service').SourceInfo[] = sources.map((source, idx) => ({
                type: source.type,
                index: idx + 1,
                title: source.title,
                url: source.url,
                documentId: source.documentId,
                id: source.documentId || source.url,
              }));

              citationValidation = CitationValidatorService.validateCitationsAgainstSources(
                parsedCitations.citations,
                sourceInfos
              );

              logger.info('Citations validated against sources', {
                totalCitations: parsedCitations.citationCount,
                matchedCitations: citationValidation.matchedCitations,
                unmatchedCitations: citationValidation.unmatchedCitations,
                errors: citationValidation.errors.length,
                warnings: citationValidation.warnings.length,
                isValid: citationValidation.isValid,
              });

              // Log validation issues
              if (citationValidation.errors.length > 0) {
                logger.warn('Citation validation errors found', {
                  errorCount: citationValidation.errors.length,
                  errors: citationValidation.errors.slice(0, 5), // Log first 5 errors
                });
              }

              if (citationValidation.warnings.length > 0) {
                logger.debug('Citation validation warnings', {
                  warningCount: citationValidation.warnings.length,
                  warnings: citationValidation.warnings.slice(0, 5), // Log first 5 warnings
                });
              }
            } catch (validationError: any) {
              logger.warn('Failed to validate citations against sources', {
                error: validationError.message,
              });
            }
          }
        }
      }

      // Parse follow-up questions from the response
      let answer = fullResponse;
      let followUpQuestions: string[] | undefined;
      
      // Look for FOLLOW_UP_QUESTIONS section (lenient: Follow-up questions, bullets - * •)
      let followUpMatch = fullResponse.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i);
      if (followUpMatch) {
        answer = fullResponse.substring(0, followUpMatch.index).trim();
        const questionsText = followUpMatch[1];
        followUpQuestions = questionsText
          .split('\n')
          .map(line => line.replace(/^[-*•]\s+/, '').trim())
          .filter(q => q.length > 0)
          .slice(0, 4);
        if (followUpQuestions.length < 4) {
          const altMatch = fullResponse.match(/(?:follow.?up|suggested|related)\s+questions?:?\s*\n((?:[-•*]\s+[^\n]+\n?)+)/i);
          if (altMatch) {
            const altQuestions = altMatch[1]
              .split('\n')
              .map(line => line.replace(/^[-•*]\s+/, '').trim())
              .filter(q => q.length > 0);
            followUpQuestions = [...followUpQuestions, ...altQuestions].slice(0, 4);
          }
        }
      } else {
        // Fallback: 1–4 bullet lines at end (model sometimes varies format on 2nd+ turns / research mode)
        const tail = fullResponse.slice(-700);
        const bulletLines = tail.split(/\n/).filter((l: string) => /^\s*[-*•]\s+.{10,}/.test(l));
        if (bulletLines.length >= 1 && bulletLines.length <= 6) {
          followUpQuestions = bulletLines
            .map((l: string) => l.replace(/^\s*[-*•]\s+/, '').trim())
            .filter((q: string) => q.length > 5 && q.length < 200)
            .slice(0, 4);
          if (followUpQuestions.length >= 1) {
            const idx = tail.indexOf(bulletLines[0]);
            if (idx >= 0) {
              const start = Math.max(0, fullResponse.length - 700 + idx);
              answer = fullResponse.substring(0, start).trim();
            }
          }
        }
      }

      // Mandatory follow-ups: if still none, generate from latest Q&A (research or not)
      if ((!followUpQuestions || followUpQuestions.length === 0) && answer) {
        const generated = await this.generateFollowUpQuestions(request.question, answer, topicName);
        if (generated.length > 0) followUpQuestions = generated;
      }

      // Build inline citation segments if citations are parsed (after answer is extracted)
      let inlineCitations: import('../types/citation').InlineCitationResult | undefined;
      if (parsedCitations && parsedCitations.citations.length > 0 && sources) {
        try {
          const { CitationParserService } = await import('./citation-parser.service');
          
          // Adjust citation positions to be relative to answer (not fullResponse)
          // Citations were parsed from fullResponse, but answer may be shorter
          const answerStartInFullResponse = fullResponse.indexOf(answer);
          const adjustedCitations = parsedCitations.citations
            .filter(citation => {
              // Only include citations that are within the answer text
              if (answerStartInFullResponse >= 0) {
                return citation.position.start >= answerStartInFullResponse &&
                       citation.position.end <= answerStartInFullResponse + answer.length;
              }
              // If answer is at start, use original positions
              return citation.position.start < answer.length && citation.position.end <= answer.length;
            })
            .map(citation => {
              // Adjust positions to be relative to answer
              const adjustedStart = answerStartInFullResponse >= 0
                ? citation.position.start - answerStartInFullResponse
                : citation.position.start;
              const adjustedEnd = answerStartInFullResponse >= 0
                ? citation.position.end - answerStartInFullResponse
                : citation.position.end;
              
              return {
                ...citation,
                position: {
                  start: adjustedStart,
                  end: adjustedEnd,
                },
              };
            });

          // Convert sources to format expected by inline citation builder
          const sourceInfos = sources.map((source, idx) => ({
            type: source.type,
            title: source.title,
            url: source.url,
            documentId: source.documentId,
            index: idx + 1,
          }));

          inlineCitations = CitationParserService.buildInlineCitationSegments(
            answer,
            adjustedCitations,
            sourceInfos
          );

          logger.info('Inline citations built', {
            segmentCount: inlineCitations.segmentCount,
            citationCount: inlineCitations.citationCount,
            originalCitationCount: parsedCitations.citations.length,
            adjustedCitationCount: adjustedCitations.length,
          });
        } catch (error: any) {
          logger.warn('Failed to build inline citations', {
            error: error.message,
          });
        }
      }

      if (!completion.usage) {
        throw new AppError('OpenAI API did not return usage information', 500, 'AI_API_ERROR');
      }

      logger.info('OpenAI response received', {
        model: completion.model,
        tokensUsed: completion.usage.total_tokens,
        hasFollowUpQuestions: !!followUpQuestions,
      });

      // Check overall degradation status
      const degradationStatus = DegradationService.getOverallStatus();
      const isDegraded = degradationStatus.level !== DegradationLevel.NONE || contextDegraded;
      const degradationLevel = contextDegradationLevel || degradationStatus.level;
      const degradationMessage = contextDegradationMessage || (isDegraded ? degradationStatus.message : undefined);
      const isPartial = contextPartial || (isDegraded && degradationStatus.canProvidePartialResults);

      const response: QuestionResponse = {
        answer,
        model: completion.model,
        sources,
        citations: parsedCitations ? {
          total: parsedCitations.citationCount,
          document: parsedCitations.documentCitations.length,
          web: parsedCitations.webCitations.length,
          reference: parsedCitations.referenceCitations.length,
          parsed: parsedCitations.citations,
          validation: citationValidation ? {
            isValid: citationValidation.isValid,
            matched: citationValidation.matchedCitations,
            unmatched: citationValidation.unmatchedCitations,
            errors: citationValidation.errors,
            warnings: citationValidation.warnings,
            suggestions: citationValidation.suggestions,
            missingSources: citationValidation.missingSources,
            invalidUrls: citationValidation.invalidUrls,
            invalidDocumentIds: citationValidation.invalidDocumentIds,
          } : undefined,
          inline: inlineCitations ? {
            segments: inlineCitations.segments,
            citations: inlineCitations.citations,
            sourceMap: Object.fromEntries(inlineCitations.sourceMap),
            citationCount: inlineCitations.citationCount,
            segmentCount: inlineCitations.segmentCount,
          } : undefined,
        } : undefined,
        followUpQuestions: followUpQuestions && followUpQuestions.length > 0 ? followUpQuestions : undefined,
        usage: {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        },
        degraded: isDegraded,
        degradationLevel: isDegraded ? degradationLevel : undefined,
        degradationMessage: degradationMessage,
        partial: isPartial,
      };

      // Collect quality metrics (async, don't block)
      if (userId && answer) {
        // Prepare citations for quality metrics
        const qualityCitations = parsedCitations?.citations?.map(citation => ({
          text: citation.text || '',
          source: citation.source || '',
          accurate: citationValidation?.isValid !== false, // Use validation result if available
        })) || [];

        QualityMetricsService.collectQualityMetrics(
          userId,
          request.question,
          answer,
          {
            queryId: request.conversationId,
            sources: sources || [],
            citations: qualityCitations.length > 0 ? qualityCitations : undefined,
            metadata: {
              model: completion.model || model,
              tokenUsage: completion.usage.total_tokens,
              hasCitations: (parsedCitations?.citations?.length || 0) > 0,
              citationValidation: citationValidation?.isValid,
            },
          }
        ).catch((error: any) => {
          // Don't fail if quality metrics collection fails
          logger.warn('Failed to collect quality metrics', {
            error: error.message,
            userId,
          });
        });
      }

      // Save messages to conversation if conversationId provided and userId available
      if (request.conversationId && userId) {
        try {
          const { ConversationService } = await import('./conversation.service');
          const { MessageService } = await import('./message.service');
          
          // Verify or create conversation
          let conversationId = request.conversationId;
          let conversation = await ConversationService.getConversation(conversationId, userId);
          
          if (!conversation) {
            // Create new conversation with auto-generated title
            const title = ConversationService.generateTitleFromMessage(request.question);
            conversation = await ConversationService.createConversation({
              userId,
              title,
              topicId: request.topicId,
            });
            conversationId = conversation.id;
            logger.info('Created new conversation for message', { conversationId, userId });
          }

          // Save message pair with follow-up questions in metadata
          await MessageService.saveMessagePair(
            conversationId,
            request.question,
            response.answer,
            sources,
            {
              model: completion.model,
              usage: response.usage,
              ragUsed: !!ragContext,
              ...(response.followUpQuestions && response.followUpQuestions.length > 0 && { followUpQuestions: response.followUpQuestions }),
            }
          );

          logger.info('Messages saved to conversation', {
            conversationId,
            userId,
          });

          // Update conversation state if enabled
          if (request.enableStateTracking !== false && conversationHistory) {
            try {
              const { ConversationService } = await import('./conversation.service');
              
              // Get all messages including the new ones
              const { MessageService } = await import('./message.service');
              const allMessages = await MessageService.getAllMessages(conversationId, userId!);
              const allHistory = allMessages.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content || '',
              }));

              // Check if state update is needed (every N messages)
              const stateOptions = {
                updateThreshold: request.stateTrackingOptions?.updateThreshold || 5,
                ...request.stateTrackingOptions,
              };

              const messageCount = allHistory.length;
              const shouldUpdate = messageCount % (stateOptions.updateThreshold || 5) === 0 || messageCount === 1;

              if (shouldUpdate) {
                await ConversationService.updateConversationState(
                  conversationId,
                  userId!,
                  allHistory,
                  stateOptions
                );
                
                logger.info('Conversation state updated', {
                  conversationId,
                  messageCount,
                });
              }
            } catch (stateError: any) {
              logger.warn('Failed to update conversation state', {
                error: stateError.message,
                conversationId,
              });
            }
          }

          // Add conversationId to response
          (response as any).conversationId = conversationId;
        } catch (saveError: any) {
          // Log error but don't fail the request
          logger.warn('Failed to save messages to conversation', {
            error: saveError.message,
            conversationId: request.conversationId,
            userId,
          });
        }
      }

      return response;
    } catch (error: any) {
      // Handle OpenAI-specific errors
      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof OpenAI.APIError) {
        // Track error
        ErrorTrackerService.trackError(ErrorServiceType.AI, error, {
          userId,
          metadata: {
            operation: 'answerQuestion',
            questionLength: request.question.length,
          },
        }).catch(() => {});

        logger.error('OpenAI API error:', {
          status: error.status,
          code: error.code,
          message: error.message,
          type: error.type,
        });

        // Map OpenAI errors to appropriate HTTP status codes
        if (error.status === 401) {
          throw new AppError('Invalid OpenAI API key', 500, 'AI_API_KEY_INVALID');
        }
        if (error.status === 429) {
          throw new AppError('OpenAI API rate limit exceeded. Please try again later.', 429, 'AI_RATE_LIMIT');
        }
        if (error.status === 500 || error.status === 503) {
          throw new AppError('OpenAI API is temporarily unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
        }
        if (error.code === 'context_length_exceeded') {
          throw new ValidationError('Question or context is too long. Please shorten your question.', 'CONTEXT_TOO_LONG');
        }

        throw new AppError(
          `AI service error: ${error.message || 'Unknown error'}`,
          500,
          'AI_API_ERROR'
        );
      }

      logger.error('Unexpected error in AI service:', error);
      throw new AppError('Failed to generate AI response', 500, 'AI_SERVICE_ERROR');
    }
  }

  /**
   * Answer a question using OpenAI API with RAG (streaming)
   * Returns an async generator that yields chunks of the response
   */
  static async *answerQuestionStream(
    request: QuestionRequest,
    userId?: string
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      // Track streaming latency (note: can't use trackOperation for generators)
      const generator = this.answerQuestionStreamInternal(request, userId);
      
      // Wrap generator to track completion
      const trackedGenerator = async function*() {
        try {
          for await (const chunk of generator) {
            yield chunk;
          }
          success = true;
        } catch (err: any) {
          error = err.message;
          throw err;
        } finally {
          const duration = Date.now() - startTime;
          // Store latency metric (using private method via any cast)
          const metric = {
            operationType: OperationType.AI_STREAMING,
            userId,
            duration,
            timestamp: Date.now(),
            success,
            error,
            metadata: {
              questionLength: request.question.length,
            },
          };
          (LatencyTrackerService as any).storeLatencyMetric(metric).catch(() => {});
          (LatencyTrackerService as any).checkAlerts(metric).catch(() => {});
        }
      };

      yield* trackedGenerator();
    } catch (err: any) {
      error = err.message;
      throw err;
    }
  }

  /**
   * Internal method for streaming answers
   */
  private static async *answerQuestionStreamInternal(
    request: QuestionRequest,
    userId?: string
  ): AsyncGenerator<string, void, unknown> {
    try {
      // Validate input
      if (!request.question || request.question.trim().length === 0) {
        throw new ValidationError('Question is required');
      }

      if (request.question.length > 2000) {
        throw new ValidationError('Question is too long (max 2000 characters)');
      }

      const model = request.model || this.DEFAULT_MODEL;
      const temperature = request.temperature ?? this.DEFAULT_TEMPERATURE;
      const maxTokens = request.maxTokens || this.DEFAULT_MAX_TOKENS;

      // Fetch topic details if topicId is provided (for Research Topic Mode)
      let topicName: string | undefined;
      let topicDescription: string | undefined;
      let topicScopeConfig: Record<string, any> | null | undefined;
      if (request.topicId && userId) {
        try {
          const { TopicService } = await import('./topic.service');
          const topic = await TopicService.getTopic(request.topicId, userId);
          if (topic) {
            topicName = topic.name;
            topicDescription = topic.description ?? undefined;
            topicScopeConfig = topic.scope_config ?? null;
            logger.info('Topic context loaded for streaming', { topicId: request.topicId, topicName });
          }
        } catch (topicError: any) {
          logger.warn('Failed to fetch topic details for streaming', {
            topicId: request.topicId,
            error: topicError.message,
          });
        }
      }

      // Retrieve RAG context (documents + web search) before streaming
      let ragContext: string | undefined;

      if (userId) {
        try {
          const ragOptions: RAGOptions = {
            userId,
            topicId: request.topicId,
            documentIds: request.documentIds,
            enableDocumentSearch: request.enableDocumentSearch !== false,
            enableWebSearch: request.enableWebSearch !== false,
            maxDocumentChunks: request.maxDocumentChunks || 5,
            maxWebResults: request.maxSearchResults || 5,
            minScore: request.minScore || 0.7, // Higher threshold to ensure relevance
            // Web search filters
            topic: request.topic,
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            country: request.country,
            // Query expansion options
            enableQueryExpansion: request.enableQueryExpansion ?? false,
            expansionStrategy: request.expansionStrategy,
            maxExpansions: request.maxExpansions,
            enableQueryRewriting: request.enableQueryRewriting ?? false, // Default to false
            queryRewritingOptions: request.queryRewritingOptions,
            enableWebResultReranking: request.enableWebResultReranking ?? false, // Default to false
            webResultRerankingConfig: request.webResultRerankingConfig,
            enableQualityScoring: request.enableQualityScoring ?? false, // Default to false
            qualityScoringConfig: request.qualityScoringConfig,
            minQualityScore: request.minQualityScore,
            filterByQuality: request.filterByQuality ?? false, // Default to false
            // Re-ranking options
            enableReranking: request.enableReranking ?? false,
            rerankingStrategy: request.rerankingStrategy,
            rerankingTopK: request.rerankingTopK,
            rerankingMaxResults: request.rerankingMaxResults,
            // Adaptive threshold options
            useAdaptiveThreshold: request.useAdaptiveThreshold ?? true, // Default to true
            minResults: request.minResults,
            maxResults: request.maxResults,
            // Diversity filtering options
            enableDiversityFilter: request.enableDiversityFilter ?? false, // Default to false
            diversityLambda: request.diversityLambda,
            diversityMaxResults: request.diversityMaxResults,
            diversitySimilarityThreshold: undefined, // Use default from config
            // Deduplication options
            enableResultDeduplication: request.enableResultDeduplication ?? false, // Default to false
            deduplicationThreshold: request.deduplicationThreshold,
            deduplicationNearDuplicateThreshold: request.deduplicationNearDuplicateThreshold,
            // Adaptive context selection options
            useAdaptiveContextSelection: request.useAdaptiveContextSelection ?? true, // Default to true (legacy)
            enableAdaptiveContextSelection: request.enableAdaptiveContextSelection ?? true, // Default to true
            adaptiveContextOptions: request.adaptiveContextOptions,
            minChunks: request.minChunks,
            maxChunks: request.maxChunks,
            // Dynamic limits options
            enableDynamicLimits: request.enableDynamicLimits ?? true, // Default to true
            dynamicLimitOptions: request.dynamicLimitOptions,
            // Relevance ordering options
            enableRelevanceOrdering: request.enableRelevanceOrdering ?? true, // Default to true
            orderingOptions: request.orderingOptions,
            // Context compression options
            enableContextCompression: request.enableContextCompression ?? true, // Default to true
            compressionOptions: request.compressionOptions,
            maxContextTokens: request.maxContextTokens,
            // Context summarization options
            enableContextSummarization: request.enableContextSummarization ?? true, // Default to true
            summarizationOptions: request.summarizationOptions,
            // Source prioritization options
            enableSourcePrioritization: request.enableSourcePrioritization ?? true, // Default to true
            prioritizationOptions: request.prioritizationOptions,
            // Token budgeting options
            enableTokenBudgeting: request.enableTokenBudgeting ?? true, // Default to true
            tokenBudgetOptions: request.tokenBudgetOptions,
          };

          // Only enable web search if enableSearch is true
          if (request.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }

          const context = await RAGService.retrieveContext(request.question, ragOptions);
          ragContext = await RAGService.formatContextForPrompt(context, {
            enableRelevanceOrdering: ragOptions.enableRelevanceOrdering ?? true,
            orderingOptions: ragOptions.orderingOptions,
            enableContextSummarization: ragOptions.enableContextSummarization ?? true,
            summarizationOptions: ragOptions.summarizationOptions,
            enableContextCompression: ragOptions.enableContextCompression ?? true,
            compressionOptions: ragOptions.compressionOptions,
            enableSourcePrioritization: ragOptions.enableSourcePrioritization ?? true,
            prioritizationOptions: ragOptions.prioritizationOptions,
            enableTokenBudgeting: ragOptions.enableTokenBudgeting ?? true,
            tokenBudgetOptions: {
              ...ragOptions.tokenBudgetOptions,
              model: request.model || 'gpt-3.5-turbo',
            },
            query: request.question,
            model: request.model || 'gpt-3.5-turbo',
            userId: userId,
          });

          logger.info('RAG context retrieved for streaming', {
            userId,
            documentChunks: context.documentContexts.length,
            webResults: context.webSearchResults.length,
          });
        } catch (ragError: any) {
          logger.warn('RAG retrieval failed during streaming, continuing without RAG context', {
            error: ragError.message,
            question: request.question,
            userId,
          });
        }
      } else {
        // Fallback to old search method if no userId
        if (request.enableSearch !== false) {
          try {
            const searchRequest: SearchRequest = {
              query: request.question,
              topic: request.topic,
              maxResults: request.maxSearchResults || 5,
              timeRange: request.timeRange,
              startDate: request.startDate,
              endDate: request.endDate,
              country: request.country,
            };

            const searchResponse = await SearchService.search(searchRequest);
            
            if (searchResponse.results && searchResponse.results.length > 0) {
              const webResults = searchResponse.results.map(r => ({
                title: r.title,
                url: r.url,
                content: r.content,
              }));

              ragContext = await RAGService.formatContextForPrompt({
                documentContexts: [],
                webSearchResults: webResults,
              }, {
                enableRelevanceOrdering: true, // Enable ordering for fallback search
                enableContextSummarization: request.enableContextSummarization ?? true,
                summarizationOptions: request.summarizationOptions,
                enableContextCompression: request.enableContextCompression ?? true,
                compressionOptions: request.compressionOptions,
                enableSourcePrioritization: request.enableSourcePrioritization ?? true,
                prioritizationOptions: request.prioritizationOptions,
                enableTokenBudgeting: request.enableTokenBudgeting ?? true,
                tokenBudgetOptions: {
                  ...request.tokenBudgetOptions,
                  model: request.model || 'gpt-3.5-turbo',
                },
                query: request.question,
                model: request.model || 'gpt-3.5-turbo',
                userId: userId,
              });

              logger.info('Search results retrieved for streaming (fallback)', {
                query: request.question,
                resultsCount: webResults.length,
              });
            }
          } catch (searchError: any) {
            logger.warn('Search failed during streaming, continuing without search results', {
              error: searchError.message,
              question: request.question,
            });
          }
        }
      }

      // Build time filter context for prompt
      const timeFilter = request.timeRange || request.startDate || request.endDate || request.topic || request.country
        ? {
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            topic: request.topic,
            country: request.country,
          }
        : undefined;

      // Fetch conversation history if conversationId is provided
      let conversationHistory = request.conversationHistory;
      if (request.conversationId && userId && !conversationHistory) {
        try {
          const { MessageService } = await import('./message.service');
          
          // Use sliding window if enabled, otherwise use summarization
          if (request.enableSlidingWindow !== false) {
            const { SlidingWindowService } = await import('./sliding-window.service');
            
            const slidingWindowOptions = {
              model: request.model || 'gpt-3.5-turbo',
              ...request.slidingWindowOptions,
            };
            
            conversationHistory = await MessageService.getSlidingWindowHistory(
              request.conversationId,
              userId,
              slidingWindowOptions
            );
            
            logger.info('Conversation history processed with sliding window', {
              conversationId: request.conversationId,
              historyLength: conversationHistory.length,
            });
          } else if (request.enableConversationSummarization !== false) {
            const { ConversationSummarizerService } = await import('./conversation-summarizer.service');
            
            const summarizationOptions = {
              model: request.model || 'gpt-3.5-turbo',
              ...request.conversationSummarizationOptions,
            };
            
            conversationHistory = await MessageService.getSummarizedHistory(
              request.conversationId,
              userId,
              summarizationOptions
            );
            
            logger.info('Conversation history summarized', {
              conversationId: request.conversationId,
              historyLength: conversationHistory.length,
            });
          } else {
            // Get raw history without processing
            const messages = await MessageService.getAllMessages(request.conversationId, userId);
            conversationHistory = messages.map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content || '',
            }));
            
            logger.info('Conversation history retrieved (no processing)', {
              conversationId: request.conversationId,
              historyLength: conversationHistory.length,
            });
          }
        } catch (error: any) {
          logger.warn('Failed to fetch conversation history, continuing without history', {
            error: error.message,
            conversationId: request.conversationId,
          });
        }
      }

      // Filter conversation history by relevance to current query
      if (conversationHistory && conversationHistory.length > 0 && request.enableHistoryFiltering !== false) {
        try {
          const { HistoryFilterService } = await import('./history-filter.service');
          
          const filterOptions = {
            ...request.historyFilterOptions,
          };
          
          const filterResult = await HistoryFilterService.filterHistory(
            request.question,
            conversationHistory,
            filterOptions
          );
          
          conversationHistory = filterResult.filteredHistory;
          
          logger.info('Conversation history filtered by relevance', {
            originalCount: filterResult.stats.originalCount,
            filteredCount: filterResult.stats.filteredCount,
            removedCount: filterResult.stats.removedCount,
            processingTimeMs: filterResult.stats.processingTimeMs,
            avgRelevanceScore: filterResult.scores.reduce((sum, msg) => sum + msg.relevanceScore, 0) / filterResult.scores.length,
          });
        } catch (error: any) {
          logger.warn('Failed to filter conversation history, using original history', {
            error: error.message,
          });
        }
      }

      // Wait for conversation history to complete (it was running in parallel)
      let conversationHistory = await conversationHistoryPromise;

      // Build messages with RAG context
      // Select few-shot examples if enabled (depends on RAG context, so must be after RAG)
      let fewShotExamplesText = '';
      if (request.enableFewShotExamples !== false) {
        try {
          const hasDocuments = ragContext?.includes('Relevant Document Excerpts:') || false;
          const hasWebResults = ragContext?.includes('Web Search Results:') || false;

          const fewShotOptions: FewShotSelectionOptions = {
            query: request.question,
            hasDocuments,
            hasWebResults,
            maxExamples: request.fewShotOptions?.maxExamples || 2,
            maxTokens: request.fewShotOptions?.maxTokens || 500,
            model: request.model || 'gpt-3.5-turbo',
            preferCitationStyle: request.fewShotOptions?.preferCitationStyle,
            ...request.fewShotOptions,
          };

          const fewShotSelection = FewShotSelectorService.selectExamples(fewShotOptions);
          
          if (fewShotSelection.examples.length > 0) {
            fewShotExamplesText = FewShotSelectorService.formatExamplesForPrompt(fewShotSelection.examples);
            
            logger.info('Few-shot examples selected', {
              query: request.question.substring(0, 100),
              exampleCount: fewShotSelection.examples.length,
              totalTokens: fewShotSelection.totalTokens,
              reasoning: fewShotSelection.reasoning,
            });
          }
        } catch (error: any) {
          logger.warn('Few-shot example selection failed, continuing without examples', {
            error: error.message,
          });
        }
      }

      const messages = this.buildMessages(
        request.question,
        ragContext,
        request.context,
        conversationHistory,
        request.enableDocumentSearch,
        request.enableWebSearch,
        timeFilter,
        topicName,
        topicDescription,
        topicScopeConfig,
        fewShotExamplesText,
        conversationStateText
      );

      logger.info('Sending streaming question to OpenAI with RAG', {
        model,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasRAGContext: !!ragContext,
        historyLength: request.conversationHistory?.length || 0,
      });

      // Call OpenAI API with streaming
      const stream = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      // Yield chunks as they arrive
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          yield content;
        }
      }

      logger.info('OpenAI streaming response completed', { model });
    } catch (error: any) {
      // Handle OpenAI-specific errors
      if (error instanceof ValidationError) {
        throw error;
      }

      if (error instanceof OpenAI.APIError) {
        logger.error('OpenAI API error (streaming):', {
          status: error.status,
          code: error.code,
          message: error.message,
          type: error.type,
        });

        // Map OpenAI errors to appropriate HTTP status codes
        if (error.status === 401) {
          throw new AppError('Invalid OpenAI API key', 500, 'AI_API_KEY_INVALID');
        }
        if (error.status === 429) {
          throw new AppError('OpenAI API rate limit exceeded. Please try again later.', 429, 'AI_RATE_LIMIT');
        }
        if (error.status === 500 || error.status === 503) {
          throw new AppError('OpenAI API is temporarily unavailable. Please try again later.', 503, 'AI_SERVICE_UNAVAILABLE');
        }
        if (error.code === 'context_length_exceeded') {
          throw new ValidationError('Question or context is too long. Please shorten your question.', 'CONTEXT_TOO_LONG');
        }

        throw new AppError(
          `AI service error: ${error.message || 'Unknown error'}`,
          500,
          'AI_API_ERROR'
        );
      }

      logger.error('Unexpected error in AI service (streaming):', error);
      throw new AppError('Failed to generate AI response', 500, 'AI_SERVICE_ERROR');
    }
  }

  /**
   * Generate a research session summary from a conversation (7.1).
   * Loads messages, filters out refusals, and produces a short report for the topic.
   */
  static async generateResearchSessionSummary(
    conversationId: string,
    userId: string,
    topicName: string
  ): Promise<string> {
    const { MessageService } = await import('./message.service');
    const messages = await MessageService.getMessages(conversationId, userId, { limit: 50 });
    const refusalPattern = /outside|limited to|disable research mode|research (mode|topic)/i;
    const blocks: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'user') {
        blocks.push(`Q: ${(m.content || '').replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim()}`);
      } else if (m.role === 'assistant') {
        const content = (m.content || '').replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim();
        if (content.length < 80 && refusalPattern.test(content)) continue; // skip refusals
        blocks.push(`A: ${content}`);
      }
    }
    const qaText = blocks.join('\n\n');
    if (!qaText || qaText.length < 50) {
      return 'Not enough on-topic Q&A in this conversation to generate a summary.';
    }
    const prompt = `You are a research assistant. Create a short **Research Session Summary** for the topic "${topicName}" based on the following Q&A from a conversation.

Format as markdown with 2-4 short sections (e.g. ## Key findings, ## Main topics covered, ## Takeaways). Keep it concise (about 1-2 paragraphs or 5-10 bullet points total). Do not add information beyond what is in the Q&A.

Q&A:
${qaText.slice(-6000)}

Research Session Summary:`;
    try {
      // Use retry service for research session summary
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model: this.DEFAULT_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            max_tokens: 800,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          multiplier: 2,
          maxDelay: 10000,
        }
      );

      const completion = retryResult.result;
      return completion.choices[0]?.message?.content || 'Summary could not be generated.';
    } catch (err: any) {
      logger.error('Error generating research session summary:', err);
      throw new AppError('Failed to generate research session summary', 500, 'RESEARCH_SUMMARY_ERROR');
    }
  }

  /**
   * Generate 4 dynamic, AI-generated starter questions for a research topic (6.1).
   * Used when in research mode to show "Try:" suggestions in line with the topic.
   * Note: Starter questions themselves are just questions, not answers, so they don't need source citations.
   * However, when these questions are asked and answered, those answers MUST include source citations.
   */
  static async generateSuggestedStarters(topicId: string, userId: string): Promise<string[]> {
    const { TopicService } = await import('./topic.service');
    const topic = await TopicService.getTopic(topicId, userId);
    if (!topic) {
      throw new AppError('Topic not found', 404, 'TOPIC_NOT_FOUND');
    }
    const name = topic.name;
    const desc = (topic.description || '').trim();
    const prompt = `You are a research assistant. Given this research topic:

Name: ${name}
${desc ? `Description: ${desc}` : ''}

Generate exactly 4 short, specific question starters that would help a user explore this topic. Each must be:
- A complete question
- Clearly on-topic and in line with "${name}"
- Suitable as the first or an early message in a research chat
- Specific (not generic like "What is X?")

IMPORTANT: These are questions only. When these questions are answered later, those answers MUST include inline source hyperlinks for every piece of information, as per the citation requirements.

Output only the 4 questions, one per line. No numbering, bullets, or extra text.`;
    try {
      // Use retry service for suggested starters generation
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model: this.DEFAULT_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.6,
            max_tokens: 400,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 500,
          multiplier: 2,
          maxDelay: 5000,
        }
      );

      const completion = retryResult.result;
      const text = completion.choices[0]?.message?.content || '';
      const lines = text.split('\n').map((l) => l.replace(/^\s*[-*•]?\s*\d*\.?\s*/, '').trim()).filter((l) => l.length > 5 && l.length < 200);
      return lines.slice(0, 4);
    } catch (err: any) {
      logger.error('Error generating suggested starters:', err);
      throw new AppError('Failed to generate suggested starters', 500, 'SUGGESTED_STARTERS_ERROR');
    }
  }

  /**
   * Generate a summary of a previous AI response
   */
  static async summarizeResponse(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    const model = this.DEFAULT_MODEL;
    const temperature = this.DEFAULT_TEMPERATURE;

    const prompt = `You are a helpful assistant. Create a concise summary of the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create a short paragraph (3-5 sentences) or bullet points summarizing the key points
- Use the keyword "${keyword}" naturally in the summary
- Do not add new information beyond what's in the original response
- Keep it concise and focused on the main ideas
- Format as plain text (no markdown formatting needed)

Summary:`;

    try {
      // Use retry service for response summarization
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            max_tokens: 300,
          });
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          multiplier: 2,
          maxDelay: 10000,
        }
      );

      const completion = retryResult.result;
      return completion.choices[0]?.message?.content || 'Summary could not be generated.';
    } catch (error: any) {
      logger.error('Error generating summary:', error);
      throw new AppError('Failed to generate summary', 500, 'SUMMARY_ERROR');
    }
  }

  /**
   * Generate a formal essay based on a previous AI response
   */
  static async writeEssay(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    const model = this.DEFAULT_MODEL;
    const temperature = this.DEFAULT_TEMPERATURE;

    const prompt = `You are a professional writer. Create a formal essay based on the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create a professional essay with proper structure
- Use formal tone throughout
- Use the keyword "${keyword}" naturally throughout the essay
- Structure MUST include:
  1. A clear title (use ## Title format)
  2. An introduction paragraph (start naturally, do NOT label it "Introduction:")
  3. Body paragraphs (2-3 paragraphs developing the main ideas - do NOT label them "Body:" or "Main Section:")
  4. A conclusion paragraph (end naturally, do NOT label it "Conclusion:")
- DO NOT use explicit section labels like "Introduction:", "Body:", "Main Section:", "Conclusion:"
- Write as a continuous, flowing essay where sections flow naturally into each other
- Use markdown formatting: ## for title, regular paragraphs for content
- Expand on the ideas from the original response in a structured, academic style
- Make it read naturally while maintaining clear structure

Essay:`;

    try {
      // Use retry service for essay generation
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            max_tokens: 1500,
          });
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          multiplier: 2,
          maxDelay: 30000,
        }
      );

      const completion = retryResult.result;
      return completion.choices[0]?.message?.content || 'Essay could not be generated.';
    } catch (error: any) {
      logger.error('Error generating essay:', error);
      throw new AppError('Failed to generate essay', 500, 'ESSAY_ERROR');
    }
  }

  /**
   * Generate a detailed report based on a previous AI response
   */
  static async generateDetailedReport(
    originalResponse: string,
    keyword: string,
    sources?: Source[]
  ): Promise<string> {
    const model = this.DEFAULT_MODEL;
    const temperature = this.DEFAULT_TEMPERATURE;

    const prompt = `You are a research analyst. Create a comprehensive, structured report based on the following AI response about "${keyword}".

Original Response:
${originalResponse}

${sources && sources.length > 0 ? `Sources used: ${sources.map(s => s.title).join(', ')}` : ''}

Instructions:
- Create an in-depth, comprehensive report with proper structure
- Use formal, professional language
- Use the keyword "${keyword}" naturally throughout
- Structure MUST include:
  1. A clear title (use ## Title format)
  2. An introduction section (start naturally, do NOT label it "Introduction:")
  3. Multiple main sections (3-4 sections with clear topics - do NOT label them "Body:" or "Main Section:")
  4. A conclusion section (end naturally, do NOT label it "Conclusion:")
- DO NOT use explicit section labels like "Introduction:", "Body:", "Main Section:", "Conclusion:", "Executive Summary:"
- Use markdown formatting: ## for title, ### for main section headings, regular paragraphs for content
- Each main section should have a descriptive heading (e.g., "## Key Features" not "## Main Section")
- Write as a continuous, flowing report where sections flow naturally into each other
- Expand significantly on the original response with detailed explanations, implications, and analysis
- Make it comprehensive and research-grade while reading naturally

Report:`;

    try {
      // Use retry service for detailed report generation
      const retryResult = await RetryService.execute(
        async () => {
          return await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            max_tokens: 2500,
          });
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          multiplier: 2,
          maxDelay: 30000,
        }
      );

      const completion = retryResult.result;
      return completion.choices[0]?.message?.content || 'Report could not be generated.';
    } catch (error: any) {
      logger.error('Error generating detailed report:', error);
      throw new AppError('Failed to generate detailed report', 500, 'REPORT_ERROR');
    }
  }
}
