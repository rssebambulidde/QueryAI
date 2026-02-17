import logger from '../config/logger';
import OpenAI from 'openai';
import { CitationValidatorService } from './citation-validator.service';
import { AnswerQualityService } from './answer-quality.service';
import { ConflictResolutionService } from './conflict-resolution.service';

/**
 * Prompt Builder Service
 * Handles system prompt construction, context formatting, and message building for AI requests
 */
export class PromptBuilderService {
  /**
   * Derive a short scope line from topic.scope_config for the Research Topic Mode prompt.
   * Supports: { keywords: string[], subtopics: string[] }
   */
  static deriveScopeFromConfig(scopeConfig?: Record<string, any> | null): string {
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

  /** FOLLOW_UP_QUESTIONS block: mandatory on every response (research or not), dynamic from latest Q&A. */
  static getFollowUpBlock(topicName?: string): string {
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
   * Build system prompt with RAG context (documents + web search)
   */
  static buildSystemPrompt(
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

    // Load enhanced guidelines (sync)
    let citationGuidelines = '';
    try {
      citationGuidelines = CitationValidatorService.formatCitationGuidelines();
    } catch (e: unknown) {
      logger.warn('Failed to load citation guidelines, using basic instructions', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    let qualityGuidelines = '';
    try {
      qualityGuidelines = AnswerQualityService.formatQualityGuidelines();
    } catch (e: unknown) {
      logger.warn('Failed to load answer quality guidelines, using basic instructions', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    let conflictResolutionGuidelines = '';
    try {
      conflictResolutionGuidelines = ConflictResolutionService.formatConflictResolutionGuidelines();
    } catch (e: unknown) {
      logger.warn('Failed to load conflict resolution guidelines, using basic instructions', {
        error: e instanceof Error ? e.message : String(e),
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

  /**
   * Build conversation messages for OpenAI API
   */
  static buildMessages(
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
}
