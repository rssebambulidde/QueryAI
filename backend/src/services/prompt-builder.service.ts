import logger from '../config/logger';
import type { ChatMessage } from '../providers/llm-provider.interface';
import { CitationValidatorService } from './citation-validator.service';
import { AnswerQualityService } from './answer-quality.service';
import { ConflictResolutionService } from './conflict-resolution.service';
import { JSON_OUTPUT_INSTRUCTIONS } from '../schemas/ai-response.schema';

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

  /**
   * @deprecated Follow-up questions are now enforced by the structured JSON
   * output schema rather than a text-based FOLLOW_UP_QUESTIONS block.
   * Kept for backward compatibility with non-structured callers.
   */
  static getFollowUpBlock(): string {
    return `End every non-refusal response with exactly:
FOLLOW_UP_QUESTIONS:
followed by 4 bullet questions ("- ") derived from this specific exchange.`;
  }

  /**
   * Output format block: instructs the model to produce JSON structured output.
   * The schema is enforced structurally for gpt-4o-mini, but the text instructions
   * are needed for gpt-3.5-turbo's json_object mode and are helpful for all models.
   */
  static getOutputFormatBlock(): string {
    return JSON_OUTPUT_INSTRUCTIONS;
  }

  /**
   * Build a simple conversational system prompt for General Chat mode.
   * No citation rules, no source formatting, no JSON structured output.
   * Returns plain text response.
   */
  static buildChatPrompt(
    conversationState?: string
  ): string {
    let prompt = `You are a helpful AI assistant. Be concise, accurate, and conversational.

Guidelines:
- Answer questions directly using your general knowledge
- Admit uncertainty rather than guessing
- Structure your response with clear markdown formatting:
  - Use **bold** for key terms and important concepts
  - Use numbered lists (1. 2. 3.) or bullet points (- ) for multiple items
  - Separate distinct ideas into short paragraphs with blank lines between them
  - Use ### headings to organise longer answers into sections
  - Use tables when comparing items or presenting structured data
- Be professional but friendly
- Keep paragraphs short (2-4 sentences each)`;

    if (conversationState) {
      prompt += `\n\n## Conversation Context\n${conversationState}`;
    }

    return prompt;
  }

  /**
   * Build conversation messages for General Chat mode (no RAG, no structured JSON).
   */
  static buildChatMessages(
    question: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    conversationState?: string
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    messages.push({
      role: 'system',
      content: this.buildChatPrompt(conversationState),
    });

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        let content = (msg.content || '').trim();
        if (msg.role === 'assistant') {
          content = content.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim();
          if (content.startsWith('{') && content.includes('"answer"')) {
            try {
              const parsed = JSON.parse(content);
              if (typeof parsed.answer === 'string') content = parsed.answer;
            } catch { /* keep as-is */ }
          }
        }
        messages.push({ role: msg.role, content });
      }
    }

    messages.push({ role: 'user', content: question });

    return messages;
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
    // v2: Web-only mode — topics and document search retired
    const modeInstruction = `IMPORTANT: You are in WEB-ONLY mode. You MUST ONLY use information from the provided web search results.`;

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

    // v2: Topic scope retired — no Research Topic Mode
    const topicScopeInstruction = '';


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

    const basePrompt = `You are a helpful AI assistant. Answer using the provided sources (documents and/or web results).
${modeInstruction}${timeFilterInstruction}${topicScopeInstruction}

CITATION RULE: Every factual claim must include an inline markdown link.
- Web sources: [Web Source N](exact-url-from-context)
- Documents: [Document N] or [Document Name](document://id)
Place citations inline right after the claim, not clustered at the end. Only cite sources provided in the context. If you cannot cite a source for a claim, omit the claim.

${citationGuidelines}

${qualityGuidelines}

${conflictResolutionGuidelines}

General guidelines:
- Admit uncertainty rather than guessing
- Use paragraphs for main points, bold for key terms
- Be concise, accurate, and professional`;

    let fullContext = '';

    // Add conversation state if available
    if (conversationState) {
      fullContext += `\n\n## Conversation Context\nUse the following conversation context to understand entity references and maintain consistency.\n${conversationState}\n`;
    }

    // Add RAG context (documents + web search)
    if (ragContext) {
      fullContext += ragContext;
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

Use the provided sources to answer the question.

Write 3-5 short paragraphs in the "answer" field. Each paragraph: one idea, 2-4 sentences, at least one inline citation, separated by blank lines. Distribute sources across paragraphs. Use **bold** for key terms. No standalone "Sources" section.

${this.getOutputFormatBlock()}`;
    }

    return `${basePrompt}

${this.getOutputFormatBlock()}`;
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
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Add system prompt with RAG context and few-shot examples
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(ragContext, additionalContext, enableDocumentSearch, enableWebSearch, timeFilter, topicName, topicDescription, topicScopeConfig, fewShotExamples, conversationState),
    });

    // Add conversation history if provided
    // Strip legacy FOLLOW_UP_QUESTIONS blocks and JSON metadata from prior
    // assistant messages to save tokens.
    if (conversationHistory && conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        let content = (msg.content || '').trim();
        if (msg.role === 'assistant') {
          // Strip legacy text-based follow-up block
          content = content.replace(/FOLLOW_UP_QUESTIONS:[\s\S]*$/i, '').trim();
          // If the content looks like a structured JSON response, extract just the answer
          if (content.startsWith('{') && content.includes('"answer"')) {
            try {
              const parsed = JSON.parse(content);
              if (typeof parsed.answer === 'string') {
                content = parsed.answer;
              }
            } catch {
              // Not valid JSON - keep content as-is
            }
          }
        }
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
