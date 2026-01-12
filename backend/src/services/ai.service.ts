import { openai } from '../config/openai';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import OpenAI from 'openai';
import { SearchService, SearchRequest } from './search.service';

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
  topic?: string;
  maxSearchResults?: number;
}

export interface Source {
  title: string;
  url: string;
  snippet?: string;
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
   * Build system prompt with context and search results
   */
  private static buildSystemPrompt(context?: string, searchResults?: Array<{ title: string; url: string; content: string }>): string {
    const basePrompt = `You are a helpful AI assistant that provides accurate, informative, and well-structured answers to user questions.

Guidelines:
- Provide clear, concise, and accurate answers
- If you don't know something, admit it rather than guessing
- Use proper formatting (bullet points, paragraphs) when appropriate
- Cite sources when context or search results are provided
- Be friendly and professional
- When using search results, cite them with [Source 1], [Source 2], etc.`;

    let fullContext = '';

    // Add search results if available
    if (searchResults && searchResults.length > 0) {
      fullContext += 'Search Results:\n';
      searchResults.forEach((result, index) => {
        fullContext += `[Source ${index + 1}] ${result.title}\n`;
        fullContext += `URL: ${result.url}\n`;
        fullContext += `Content: ${result.content}\n\n`;
      });
    }

    // Add additional context if provided
    if (context) {
      fullContext += `Additional Context:\n${context}\n`;
    }

    if (fullContext) {
      return `${basePrompt}

${fullContext}

Use the provided context and search results to enhance your answers. If the information is relevant to the question, incorporate it into your response. Always cite sources using [Source N] format when referencing search results.`;
    }

    return basePrompt;
  }

  /**
   * Build conversation messages for OpenAI API
   */
  private static buildMessages(
    question: string,
    context?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    searchResults?: Array<{ title: string; url: string; content: string }>
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(context, searchResults),
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
   * Answer a question using OpenAI API (non-streaming)
   */
  static async answerQuestion(request: QuestionRequest): Promise<QuestionResponse> {
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

      // Perform search if enabled
      let searchResults: Array<{ title: string; url: string; content: string }> | undefined;
      let sources: Source[] | undefined;

      if (request.enableSearch !== false) { // Default to true if not specified
        try {
          const searchRequest: SearchRequest = {
            query: request.question,
            topic: request.topic,
            maxResults: request.maxSearchResults || 5,
          };

          const searchResponse = await SearchService.search(searchRequest);
          
          if (searchResponse.results && searchResponse.results.length > 0) {
            searchResults = searchResponse.results.map(r => ({
              title: r.title,
              url: r.url,
              content: r.content,
            }));

            sources = searchResponse.results.map((r, index) => ({
              title: r.title,
              url: r.url,
              snippet: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
            }));

            logger.info('Search results retrieved', {
              query: request.question,
              resultsCount: searchResults.length,
              topic: request.topic,
            });
          }
        } catch (searchError: any) {
          // Log search error but don't fail the entire request
          logger.warn('Search failed, continuing without search results', {
            error: searchError.message,
            question: request.question,
          });
        }
      }

      // Build messages with search results
      const messages = this.buildMessages(
        request.question,
        request.context,
        request.conversationHistory,
        searchResults
      );

      logger.info('Sending question to OpenAI', {
        model,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasSearchResults: !!searchResults && searchResults.length > 0,
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
   * Answer a question using OpenAI API (streaming)
   * Returns an async generator that yields chunks of the response
   */
  static async *answerQuestionStream(request: QuestionRequest): AsyncGenerator<string, void, unknown> {
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

      // Perform search if enabled (for streaming, we do search before streaming)
      let searchResults: Array<{ title: string; url: string; content: string }> | undefined;

      if (request.enableSearch !== false) { // Default to true if not specified
        try {
          const searchRequest: SearchRequest = {
            query: request.question,
            topic: request.topic,
            maxResults: request.maxSearchResults || 5,
          };

          const searchResponse = await SearchService.search(searchRequest);
          
          if (searchResponse.results && searchResponse.results.length > 0) {
            searchResults = searchResponse.results.map(r => ({
              title: r.title,
              url: r.url,
              content: r.content,
            }));

            logger.info('Search results retrieved for streaming', {
              query: request.question,
              resultsCount: searchResults.length,
              topic: request.topic,
            });
          }
        } catch (searchError: any) {
          // Log search error but don't fail the entire request
          logger.warn('Search failed during streaming, continuing without search results', {
            error: searchError.message,
            question: request.question,
          });
        }
      }

      // Build messages with search results
      const messages = this.buildMessages(
        request.question,
        request.context,
        request.conversationHistory,
        searchResults
      );

      logger.info('Sending streaming question to OpenAI', {
        model,
        questionLength: request.question.length,
        hasContext: !!request.context,
        hasSearchResults: !!searchResults && searchResults.length > 0,
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
