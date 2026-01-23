import { openai } from '../config/openai';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import OpenAI from 'openai';
import { SearchService, SearchRequest } from './search.service';
import { RAGService, RAGOptions } from './rag.service';

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
}

export interface QuestionResponse {
  answer: string;
  model: string;
  sources?: Source[];
  followUpQuestions?: string[]; // AI-generated follow-up questions
  refusal?: boolean; // true when response is an off-topic refusal (e.g. from pre-check) (11.1)
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * AI Service
 * Handles AI question-answering using OpenAI API
 */
export class AIService {
  // Default model configuration
  private static readonly DEFAULT_MODEL = 'gpt-3.5-turbo';
  private static readonly DEFAULT_TEMPERATURE = 0.7;
  private static readonly DEFAULT_MAX_TOKENS = 1000;

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
    const scopeLine = this.deriveScopeFromConfig(topicScopeConfig);
    const desc = topicDescription || 'general';
    const prompt = `Topic: ${topicName}. Description: ${desc}.${scopeLine}

Question: ${question}

Is this question clearly within the topic? Answer only YES or NO.`;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 10,
      });
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
    topicScopeConfig?: Record<string, any> | null
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

    const basePrompt = `You are a helpful AI assistant that provides accurate, informative, and well-structured answers to user questions using Retrieval-Augmented Generation (RAG).

${modeInstruction}${timeFilterInstruction}${topicScopeInstruction}

Guidelines:
- Provide clear, concise, and accurate answers
- Use information from the provided document excerpts and/or web search results based on the mode
- If you don't know something based on the provided sources, admit it rather than guessing
- Use proper formatting (bullet points, paragraphs) when appropriate
- ALWAYS cite sources when referencing information. Use inline citations:
  - For document excerpts: [Document 1], [Document 2], [Document 3], etc. (MANDATORY - cite every fact from documents)
  - For web sources: [Web Source 1](URL), [Web Source 2](URL), etc. - ALWAYS include the URL in parentheses after the citation
- When you reference information from a document, immediately follow it with the citation like this: "According to [Document 1], the process involves..." or "The policy states [Document 2] that..."
- When you reference information from web sources, use this format: "According to [Web Source 1](https://example.com), the situation involves..." or "As reported by [Web Source 2](https://example.com/article)..."
- Format your responses with clear structure: Use paragraphs for main points, bullet points for lists, and bold text for key terms when appropriate
- Provide concise but comprehensive summaries that capture the essential information
- Be friendly and professional`;

    let fullContext = '';

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

    if (fullContext) {
      return `${basePrompt}

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

2. INLINE SOURCE ATTRIBUTION (CRITICAL):
   - Each paragraph MUST contain exactly ONE clickable source link embedded inline
   - For web sources: Use format [source title](URL) where the link is clickable
   - For documents: Use format [Document Name](document://documentId) or just mention the document name as a link
   - The source link should appear naturally within the paragraph text, not at the end
   - Example: "SQL is a standard language used to manage relational databases, allowing users to query and modify structured data efficiently. [official documentation](https://example.com/docs)"
   - Another example: "Relational systems such as MySQL and PostgreSQL rely on SQL to define schemas and enforce data integrity. [Database Guide](document://doc123)"

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

FOLLOW-UP QUESTIONS (CRITICAL - REQUIRED):
After your complete answer, you MUST include a section with exactly 4 intelligent, contextually relevant follow-up questions.
Format: Add a line break, then "FOLLOW_UP_QUESTIONS:" followed by exactly 4 questions, one per line, each starting with "- "
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

    // If no context and document-only mode, provide clear instruction
    if (enableDocumentSearch && !enableWebSearch) {
      return `${basePrompt}

No document excerpts were found for this query. You must inform the user that the information is not available in their documents.`;
    }

    return basePrompt;
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
    topicScopeConfig?: Record<string, any> | null
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt with RAG context
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(ragContext, additionalContext, enableDocumentSearch, enableWebSearch, timeFilter, topicName, topicDescription, topicScopeConfig),
    });

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      // Limit history to last 10 messages to avoid token limits
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
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
            logger.info('Topic context loaded', { topicId: request.topicId, topicName });
          }
        } catch (topicError: any) {
          logger.warn('Failed to fetch topic details', {
            topicId: request.topicId,
            error: topicError.message,
          });
        }
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
          };

          // Only enable web search if enableSearch is true
          if (request.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }

          const context = await RAGService.retrieveContext(request.question, ragOptions);
          
          // Format context for prompt
          ragContext = RAGService.formatContextForPrompt(context);
          
          // Extract sources
          sources = RAGService.extractSources(context);

          logger.info('RAG context retrieved', {
            userId,
            documentChunks: context.documentContexts.length,
            webResults: context.webSearchResults.length,
            totalSources: sources.length,
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

              ragContext = RAGService.formatContextForPrompt({
                documentContexts: [],
                webSearchResults: webResults,
              });

              sources = searchResponse.results.map((r) => ({
                type: 'web' as const,
                title: r.title,
                url: r.url,
                snippet: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
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

      // Build messages with RAG context
      const messages = this.buildMessages(
        request.question,
        ragContext,
        request.context,
        request.conversationHistory,
        request.enableDocumentSearch,
        request.enableWebSearch,
        timeFilter,
        topicName,
        topicDescription,
        topicScopeConfig
      );

      logger.info('Sending question to OpenAI with RAG', {
        model,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasRAGContext: !!ragContext,
        sourcesCount: sources?.length || 0,
        historyLength: request.conversationHistory?.length || 0,
      });

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const fullResponse = completion.choices[0]?.message?.content || 'No response generated';
      
      // Parse follow-up questions from the response
      let answer = fullResponse;
      let followUpQuestions: string[] | undefined;
      
      // Look for FOLLOW_UP_QUESTIONS section
      const followUpMatch = fullResponse.match(/FOLLOW_UP_QUESTIONS:\s*\n((?:-\s+[^\n]+\n?)+)/i);
      if (followUpMatch) {
        // Extract the answer (everything before FOLLOW_UP_QUESTIONS)
        answer = fullResponse.substring(0, followUpMatch.index).trim();
        
        // Parse the questions
        const questionsText = followUpMatch[1];
        followUpQuestions = questionsText
          .split('\n')
          .map(line => line.replace(/^-\s+/, '').trim())
          .filter(q => q.length > 0)
          .slice(0, 4); // Ensure max 4 questions
        
        // If we didn't get 4 questions, try alternative formats
        if (followUpQuestions.length < 4) {
          // Try to find questions in other formats
          const altMatch = fullResponse.match(/(?:follow.?up|suggested|related)\s+questions?:?\s*\n((?:[-•*]\s+[^\n]+\n?)+)/i);
          if (altMatch) {
            const altQuestions = altMatch[1]
              .split('\n')
              .map(line => line.replace(/^[-•*]\s+/, '').trim())
              .filter(q => q.length > 0);
            followUpQuestions = [...followUpQuestions, ...altQuestions].slice(0, 4);
          }
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

      const response = {
        answer,
        model: completion.model,
        sources,
        followUpQuestions: followUpQuestions && followUpQuestions.length > 0 ? followUpQuestions : undefined,
        usage: {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        },
      };

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
          };

          // Only enable web search if enableSearch is true
          if (request.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }

          const context = await RAGService.retrieveContext(request.question, ragOptions);
          ragContext = RAGService.formatContextForPrompt(context);

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

              ragContext = RAGService.formatContextForPrompt({
                documentContexts: [],
                webSearchResults: webResults,
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

      // Build messages with RAG context
      const messages = this.buildMessages(
        request.question,
        ragContext,
        request.context,
        request.conversationHistory,
        request.enableDocumentSearch,
        request.enableWebSearch,
        timeFilter,
        topicName,
        topicDescription,
        topicScopeConfig
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
      const completion = await openai.chat.completions.create({
        model: this.DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 800,
      });
      return completion.choices[0]?.message?.content || 'Summary could not be generated.';
    } catch (err: any) {
      logger.error('Error generating research session summary:', err);
      throw new AppError('Failed to generate research session summary', 500, 'RESEARCH_SUMMARY_ERROR');
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
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 300,
      });

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
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 1500,
      });

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
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 2500,
      });

      return completion.choices[0]?.message?.content || 'Report could not be generated.';
    } catch (error: any) {
      logger.error('Error generating detailed report:', error);
      throw new AppError('Failed to generate detailed report', 500, 'REPORT_ERROR');
    }
  }
}
