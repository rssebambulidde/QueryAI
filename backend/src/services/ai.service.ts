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
  private static buildSystemPrompt(
    ragContext?: string,
    additionalContext?: string
  ): string {
    const basePrompt = `You are a helpful AI assistant that provides accurate, informative, and well-structured answers to user questions using Retrieval-Augmented Generation (RAG).

Guidelines:
- Provide clear, concise, and accurate answers
- Use information from the provided document excerpts and web search results
- If you don't know something, admit it rather than guessing
- Use proper formatting (bullet points, paragraphs) when appropriate
- Cite sources when referencing information:
  - Document excerpts: [Document 1], [Document 2], etc.
  - Web sources: [Web Source 1], [Web Source 2], etc.
- Prioritize document excerpts when they directly answer the question
- Combine document knowledge with web search results for comprehensive answers
- Be friendly and professional`;

    let fullContext = '';

    // Add RAG context (documents + web search)
    if (ragContext) {
      fullContext += ragContext;
    }

    // Add additional context if provided
    if (additionalContext) {
      fullContext += `Additional Context:\n${additionalContext}\n`;
    }

    if (fullContext) {
      return `${basePrompt}

${fullContext}

Use the provided document excerpts and web search results to enhance your answers. When the information is relevant to the question, incorporate it into your response. Always cite sources using the format specified above.`;
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
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt with RAG context
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(ragContext, additionalContext),
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
            minScore: request.minScore || 0.7,
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

      // Build messages with RAG context
      const messages = this.buildMessages(
        request.question,
        ragContext,
        request.context,
        request.conversationHistory
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

      const answer = completion.choices[0]?.message?.content || 'No response generated';

      if (!completion.usage) {
        throw new AppError('OpenAI API did not return usage information', 500, 'AI_API_ERROR');
      }

      logger.info('OpenAI response received', {
        model: completion.model,
        tokensUsed: completion.usage.total_tokens,
      });

      return {
        answer,
        model: completion.model,
        sources,
        usage: {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        },
      };
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
            minScore: request.minScore || 0.7,
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

      // Build messages with RAG context
      const messages = this.buildMessages(
        request.question,
        ragContext,
        request.context,
        request.conversationHistory
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
}
