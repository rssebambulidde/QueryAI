import { openai } from '../config/openai';
import logger from '../config/logger';
import { AppError, ValidationError } from '../types/error';
import OpenAI from 'openai';

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
}

export interface QuestionResponse {
  answer: string;
  model: string;
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
   * Build system prompt with context
   */
  private static buildSystemPrompt(context?: string): string {
    const basePrompt = `You are a helpful AI assistant that provides accurate, informative, and well-structured answers to user questions.

Guidelines:
- Provide clear, concise, and accurate answers
- If you don't know something, admit it rather than guessing
- Use proper formatting (bullet points, paragraphs) when appropriate
- Cite sources when context is provided
- Be friendly and professional`;

    if (context) {
      return `${basePrompt}

Additional Context:
${context}

Use the provided context to enhance your answers. If the context is relevant to the question, incorporate it into your response.`;
    }

    return basePrompt;
  }

  /**
   * Build conversation messages for OpenAI API
   */
  private static buildMessages(
    question: string,
    context?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(context),
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

      // Build messages
      const messages = this.buildMessages(
        request.question,
        request.context,
        request.conversationHistory
      );

      logger.info('Sending question to OpenAI', {
        model,
        questionLength: request.question.length,
        hasContext: !!request.context,
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

      // Build messages
      const messages = this.buildMessages(
        request.question,
        request.context,
        request.conversationHistory
      );

      logger.info('Sending streaming question to OpenAI', {
        model,
        questionLength: request.question.length,
        hasContext: !!request.context,
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
