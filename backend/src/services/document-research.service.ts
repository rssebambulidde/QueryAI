/**
 * Document Research Service
 *
 * "Search Within My Document" — extracts key claims and entities from
 * an attached/uploaded document and auto-generates web search queries
 * to verify, expand, or fact-check those claims.
 *
 * Flow:
 *   1. Extract claims/entities from document text via LLM
 *   2. Generate targeted search queries for each claim
 *   3. Run parallel web searches via SearchService
 *   4. Build a structured report mapping document claims → web evidence
 *
 * Called from the AI answer pipeline when `researchMyDocument` is true.
 */

import logger from '../config/logger';
import { SearchService, SearchResult, SearchRequest } from './search.service';
import { ProviderRegistry } from '../providers/provider-registry';
import { SubscriptionService } from './subscription.service';
import { AttachmentExtractorService } from './attachment-extractor.service';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface DocumentClaim {
  /** Short label for the claim (≤20 words) */
  claim: string;
  /** The exact quote or region from the document */
  excerpt: string;
  /** Category: statistic, date, fact, opinion, entity, etc. */
  category: 'statistic' | 'date' | 'fact' | 'opinion' | 'entity' | 'other';
}

export interface ClaimResearchResult {
  claim: DocumentClaim;
  /** Web search queries generated for this claim */
  queries: string[];
  /** Web results aggregated across queries */
  webResults: SearchResult[];
  /** LLM-generated summary comparing document claim to web evidence */
  verdict: string;
  /** Confidence: supported, contradicted, unverifiable, partially_supported */
  confidence: 'supported' | 'contradicted' | 'unverifiable' | 'partially_supported';
}

export interface DocumentResearchResult {
  /** All extracted claims */
  claims: DocumentClaim[];
  /** Research results per claim */
  results: ClaimResearchResult[];
  /** Overall formatted context for the LLM prompt */
  formattedContext: string;
  /** Sources collected across all claim searches */
  allSources: SearchResult[];
}

// ═══════════════════════════════════════════════════════════════════════
// Service
// ═══════════════════════════════════════════════════════════════════════

export class DocumentResearchService {
  /** Max results per individual search */
  private static readonly RESULTS_PER_SEARCH = 3;
  /** Max document text to send to claim extraction (chars) */
  private static readonly MAX_DOC_CHARS = 30_000;

  /** Adaptive claim count based on document length */
  static getMaxClaims(docLength: number): number {
    if (docLength < 2_000) return 4;
    if (docLength <= 8_000) return 6;
    if (docLength <= 20_000) return 8;
    return 10;
  }

  /** Adaptive search budget: 2 searches per claim, capped at 16 */
  static getMaxSearches(maxClaims: number): number {
    return Math.min(maxClaims * 2, 16);
  }

  // ─────────────────────────────────────────────────────────────────────
  // 1. Extract claims from document text
  // ─────────────────────────────────────────────────────────────────────

  static async extractClaims(
    documentText: string,
    userQuestion?: string,
  ): Promise<DocumentClaim[]> {
    // Use question-aware smart truncation when a question is provided
    let truncated: string;
    if (documentText.length > this.MAX_DOC_CHARS) {
      if (userQuestion) {
        truncated = AttachmentExtractorService.smartTruncate(documentText, userQuestion, this.MAX_DOC_CHARS);
      } else {
        truncated = documentText.slice(0, this.MAX_DOC_CHARS) + '\n[…truncated]';
      }
    } else {
      truncated = documentText;
    }

    const maxClaims = this.getMaxClaims(truncated.length);

    const questionInstruction = userQuestion
      ? `\n- The user's question is: "${userQuestion}"\n- PRIORITISE claims that are most relevant to answering this question. Extract relevant claims FIRST (~60%), then include additional noteworthy verifiable claims (~40%).\n- Order claims by relevance to the user's question (most relevant first).`
      : '';

    const systemPrompt = `You are a claim-extraction expert. Given a document, extract the most important verifiable claims, stated facts, statistics, dates, and named entities.

RULES:
- Extract up to ${maxClaims} claims.
- Each claim should be independently verifiable via web search.
- Prefer concrete, specific claims over vague statements.
- Include the exact excerpt from the document.${questionInstruction}

Respond with ONLY a JSON array:
[
  {
    "claim": "short summary of the claim (≤20 words)",
    "excerpt": "exact quote from the document",
    "category": "statistic|date|fact|opinion|entity|other"
  }
]`;

    try {
      const { provider, model } = ProviderRegistry.getForMode('research');
      const result = await provider.chatCompletion({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: truncated },
        ],
        temperature: 0.2,
        maxTokens: 2000,
        responseFormat: 'json',
      });

      const parsed = JSON.parse(result.content);
      const claims: DocumentClaim[] = (Array.isArray(parsed) ? parsed : parsed.claims ?? [])
        .slice(0, maxClaims)
        .map((c: any) => ({
          claim: String(c.claim || '').slice(0, 200),
          excerpt: String(c.excerpt || '').slice(0, 500),
          category: ['statistic', 'date', 'fact', 'opinion', 'entity', 'other'].includes(c.category)
            ? c.category
            : 'other',
        }));

      logger.info('Extracted claims from document', { count: claims.length, maxClaims, docLength: truncated.length });
      return claims;
    } catch (err: any) {
      logger.error('Failed to extract claims from document', { error: err.message });
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2. Generate web search queries for each claim
  // ─────────────────────────────────────────────────────────────────────

  static generateSearchQueries(claims: DocumentClaim[], maxSearches?: number): Map<DocumentClaim, string[]> {
    const searchBudget = maxSearches ?? this.getMaxSearches(claims.length);
    const map = new Map<DocumentClaim, string[]>();
    let totalQueries = 0;

    for (const claim of claims) {
      if (totalQueries >= searchBudget) break;

      const queries: string[] = [];

      // Primary query: the claim itself
      queries.push(claim.claim);

      // Secondary query varies by category
      if (totalQueries + 2 <= searchBudget) {
        switch (claim.category) {
          case 'statistic':
            queries.push(`${claim.claim} source data evidence`);
            break;
          case 'date':
            queries.push(`${claim.claim} timeline verify`);
            break;
          case 'fact':
            queries.push(`is it true that ${claim.claim}`);
            break;
          case 'opinion':
            queries.push(`${claim.claim} expert analysis debate`);
            break;
          case 'entity':
            queries.push(`${claim.claim} latest news information`);
            break;
          default:
            queries.push(`${claim.claim} information`);
        }
      }

      totalQueries += queries.length;
      map.set(claim, queries);
    }

    return map;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3. Run web searches for all generated queries
  // ─────────────────────────────────────────────────────────────────────

  static async searchClaims(
    queryMap: Map<DocumentClaim, string[]>,
    searchOptions?: { timeRange?: string; country?: string },
  ): Promise<Map<DocumentClaim, SearchResult[]>> {
    const resultMap = new Map<DocumentClaim, SearchResult[]>();

    // Build flat list of search promises
    const tasks: Array<{ claim: DocumentClaim; query: string }> = [];
    for (const [claim, queries] of queryMap) {
      for (const query of queries) {
        // Truncate overly long queries to stay within SearchService limits
        const safeQuery = query.length > 400 ? query.slice(0, 400) : query;
        tasks.push({ claim, query: safeQuery });
      }
    }

    // Run searches in parallel (batched to avoid overwhelming Tavily)
    const BATCH_SIZE = 4;
    const allResults: Array<{ claim: DocumentClaim; results: SearchResult[] }> = [];

    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async ({ claim, query }) => {
          const searchReq: SearchRequest = {
            query,
            maxResults: this.RESULTS_PER_SEARCH,
            timeRange: (searchOptions?.timeRange as any) || undefined,
            country: searchOptions?.country,
          };
          const response = await SearchService.search(searchReq);
          return { claim, results: response.results };
        }),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allResults.push(result.value);
        }
      }
    }

    // Aggregate results per claim
    for (const { claim, results } of allResults) {
      const existing = resultMap.get(claim) || [];
      // Deduplicate by URL
      const seen = new Set(existing.map((r) => r.url));
      for (const r of results) {
        if (!seen.has(r.url)) {
          existing.push(r);
          seen.add(r.url);
        }
      }
      resultMap.set(claim, existing);
    }

    return resultMap;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. Synthesise verdicts for each claim against web evidence
  // ─────────────────────────────────────────────────────────────────────

  static async synthesiseVerdicts(
    claims: DocumentClaim[],
    webResultsMap: Map<DocumentClaim, SearchResult[]>,
  ): Promise<ClaimResearchResult[]> {
    const results: ClaimResearchResult[] = [];

    // Build a single LLM call for all claims (cheaper + faster than per-claim)
    const claimsWithEvidence = claims.map((claim, idx) => {
      const webResults = webResultsMap.get(claim) || [];
      return {
        idx,
        claim,
        evidence: webResults
          .slice(0, 5)
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.content?.slice(0, 300)}`)
          .join('\n\n'),
        webResults,
      };
    });

    const systemPrompt = `You are a fact-checking analyst. For each claim extracted from a user's document, compare it with the web search evidence provided and produce a verdict.

For each claim, provide:
- "verdict": A 1-2 sentence summary comparing the document's claim with web sources.
- "confidence": One of "supported", "contradicted", "partially_supported", "unverifiable"

Respond with ONLY a JSON array matching the order of claims:
[
  { "verdict": "...", "confidence": "supported|contradicted|partially_supported|unverifiable" }
]`;

    const userContent = claimsWithEvidence.map((c) => {
      return `CLAIM ${c.idx + 1}: "${c.claim.claim}" (${c.claim.category})
Document excerpt: "${c.claim.excerpt}"

Web evidence:
${c.evidence || '(no web results found)'}`;
    }).join('\n\n---\n\n');

    try {
      const { provider, model } = ProviderRegistry.getForMode('research');
      const result = await provider.chatCompletion({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        maxTokens: 3000,
        responseFormat: 'json',
      });

      const parsed = JSON.parse(result.content);
      const verdicts: Array<{ verdict: string; confidence: string }> = Array.isArray(parsed) ? parsed : parsed.verdicts ?? [];

      for (let i = 0; i < claimsWithEvidence.length; i++) {
        const c = claimsWithEvidence[i];
        const v = verdicts[i] || { verdict: 'Could not determine.', confidence: 'unverifiable' };
        const queries = Array.from(
          (this.generateSearchQueries([c.claim]).get(c.claim) || []),
        );

        results.push({
          claim: c.claim,
          queries,
          webResults: c.webResults,
          verdict: String(v.verdict || 'Could not determine.'),
          confidence: (['supported', 'contradicted', 'partially_supported', 'unverifiable'].includes(v.confidence)
            ? v.confidence
            : 'unverifiable') as ClaimResearchResult['confidence'],
        });
      }
    } catch (err: any) {
      logger.error('Failed to synthesise verdicts', { error: err.message });
      // Fallback: mark all as unverifiable
      for (const c of claimsWithEvidence) {
        results.push({
          claim: c.claim,
          queries: [],
          webResults: c.webResults,
          verdict: 'Verdict generation failed.',
          confidence: 'unverifiable',
        });
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 5. Format research results as context for the answer LLM
  // ─────────────────────────────────────────────────────────────────────

  static formatAsContext(results: ClaimResearchResult[]): string {
    if (results.length === 0) return '';

    const lines: string[] = ['## Document Research Results\n'];

    for (const r of results) {
      const icon = r.confidence === 'supported' ? '✅'
        : r.confidence === 'contradicted' ? '❌'
        : r.confidence === 'partially_supported' ? '⚠️'
        : '❓';

      lines.push(`### ${icon} ${r.claim.claim}`);
      lines.push(`**Category:** ${r.claim.category}`);
      lines.push(`**Document says:** "${r.claim.excerpt}"`);
      lines.push(`**Web verdict:** ${r.verdict}`);

      if (r.webResults.length > 0) {
        lines.push('**Sources:**');
        for (const src of r.webResults.slice(0, 3)) {
          lines.push(`- [${src.title}](${src.url})`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────
  // 6. Collect all unique sources for SSE emission
  // ─────────────────────────────────────────────────────────────────────

  static collectSources(results: ClaimResearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const sources: SearchResult[] = [];
    for (const r of results) {
      for (const s of r.webResults) {
        if (!seen.has(s.url)) {
          seen.add(s.url);
          sources.push(s);
        }
      }
    }
    return sources;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Main entry point — orchestrate full document research pipeline
  // ─────────────────────────────────────────────────────────────────────

  static async *research(
    documentText: string,
    userQuestion?: string,
    options?: { timeRange?: string; country?: string },
  ): AsyncGenerator<
    | { type: 'status'; message: string }
    | { type: 'claims'; claims: DocumentClaim[] }
    | { type: 'result'; data: DocumentResearchResult },
    void,
    unknown
  > {
    try {
      yield { type: 'status', message: 'Extracting key claims from your document…' };

      // Step 1: Extract claims
      const claims = await this.extractClaims(documentText, userQuestion);
      if (claims.length === 0) {
        logger.warn('Document research: no claims extracted');
        yield {
          type: 'result',
          data: { claims: [], results: [], formattedContext: '', allSources: [] },
        };
        return;
      }

      yield { type: 'claims', claims };
      yield { type: 'status', message: `Found ${claims.length} claims. Searching the web for evidence…` };

      // Step 2: Generate queries
      const queryMap = this.generateSearchQueries(claims);

      // Step 3: Search web
      let webResultsMap: Map<DocumentClaim, SearchResult[]>;
      try {
        webResultsMap = await this.searchClaims(queryMap, options);
      } catch (searchErr: any) {
        logger.error('Document research: web search phase failed', { error: searchErr.message });
        yield { type: 'status', message: 'Web search encountered an error. Providing partial results…' };
        webResultsMap = new Map();
      }

      yield { type: 'status', message: 'Analysing web evidence against document claims…' };

      // Step 4: Synthesise verdicts
      const results = await this.synthesiseVerdicts(claims, webResultsMap);

      // Step 5: Format
      const formattedContext = this.formatAsContext(results);
      const allSources = this.collectSources(results);

      yield {
        type: 'result',
        data: { claims, results, formattedContext, allSources },
      };
    } catch (err: any) {
      logger.error('Document research pipeline failed', { error: err.message, stack: err.stack });
      // Yield empty result so the caller can still proceed with a normal answer
      yield {
        type: 'result',
        data: { claims: [], results: [], formattedContext: '', allSources: [] },
      };
    }
  }
}
