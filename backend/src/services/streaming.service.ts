import OpenAI from 'openai';
import logger from '../config/logger';

/**
 * Streaming Service
 * Handles SSE streaming logic, stream chunk processing, and abort handling
 */
export class StreamingService {
  /**
   * Process OpenAI stream chunk and extract content
   */
  static processStreamChunk(chunk: OpenAI.Chat.Completions.ChatCompletionChunk): string {
    return chunk.choices[0]?.delta?.content || '';
  }

  /**
   * Process stream and collect full response
   * Returns the complete response text
   */
  static async *processStream(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  ): AsyncGenerator<string, string, unknown> {
    let fullResponse = '';

    try {
      for await (const chunk of stream) {
        const content = this.processStreamChunk(chunk);
        if (content) {
          fullResponse += content;
          yield content;
        }
      }

      return fullResponse;
    } catch (error: any) {
      logger.error('Error processing stream', {
        error: error.message,
        partialResponse: fullResponse.substring(0, 200),
      });
      throw error;
    }
  }

  /**
   * Format SSE (Server-Sent Events) message
   */
  static formatSSEMessage(event: string, data: any): string {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return `event: ${event}\ndata: ${dataStr}\n\n`;
  }

  /**
   * Create an abort controller with timeout
   * Returns AbortController that will abort after specified timeout
   */
  static createAbortController(timeoutMs: number = 60000): AbortController {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
      logger.warn('Stream aborted due to timeout', { timeoutMs });
    }, timeoutMs);

    // Clear timeout when signal is aborted manually
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeout);
    });

    return controller;
  }

  /**
   * Handle stream errors and format error messages
   */
  static handleStreamError(error: any): { message: string; code?: string; status?: number } {
    if (error instanceof OpenAI.APIError) {
      return {
        message: error.message || 'OpenAI API error',
        code: error.code ?? undefined,
        status: error.status,
      };
    }

    if (error.name === 'AbortError') {
      return {
        message: 'Stream was aborted',
        code: 'STREAM_ABORTED',
      };
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        message: 'Stream connection timed out',
        code: 'STREAM_TIMEOUT',
      };
    }

    return {
      message: error.message || 'Unknown stream error',
      code: 'STREAM_ERROR',
    };
  }

  /**
   * Validate stream response
   * Checks if stream response is valid and complete
   */
  static validateStreamResponse(response: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!response || response.trim().length === 0) {
      errors.push('Stream response is empty');
    }

    if (response.length < 10) {
      errors.push('Stream response is too short');
    }

    // Check for incomplete response indicators
    if (response.endsWith('...') && response.length < 100) {
      errors.push('Stream response appears to be truncated');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a stream wrapper with error handling and logging
   */
  static async *createManagedStream<T>(
    stream: AsyncIterable<T>,
    options: {
      onChunk?: (chunk: T) => void;
      onError?: (error: any) => void;
      onComplete?: () => void;
      maxChunks?: number;
    } = {}
  ): AsyncGenerator<T, void, unknown> {
    let chunkCount = 0;

    try {
      for await (const chunk of stream) {
        chunkCount++;

        // Call chunk handler if provided
        if (options.onChunk) {
          try {
            options.onChunk(chunk);
          } catch (handlerError: any) {
            logger.warn('Error in chunk handler', { error: handlerError.message });
          }
        }

        // Check max chunks limit
        if (options.maxChunks && chunkCount >= options.maxChunks) {
          logger.warn('Stream exceeded max chunks limit', {
            maxChunks: options.maxChunks,
            chunkCount,
          });
          break;
        }

        yield chunk;
      }

      // Call completion handler if provided
      if (options.onComplete) {
        try {
          options.onComplete();
        } catch (handlerError: any) {
          logger.warn('Error in completion handler', { error: handlerError.message });
        }
      }

      logger.debug('Stream processing completed', { chunkCount });
    } catch (error: any) {
      logger.error('Error in managed stream', {
        error: error.message,
        chunkCount,
      });

      // Call error handler if provided
      if (options.onError) {
        try {
          options.onError(error);
        } catch (handlerError: any) {
          logger.warn('Error in error handler', { error: handlerError.message });
        }
      }

      throw error;
    }
  }

  /**
   * Buffer stream chunks for batching
   * Collects chunks until buffer size or timeout is reached
   */
  static async *bufferStream(
    stream: AsyncIterable<string>,
    options: {
      bufferSize?: number;
      flushIntervalMs?: number;
    } = {}
  ): AsyncGenerator<string, void, unknown> {
    const bufferSize = options.bufferSize || 10;
    const flushIntervalMs = options.flushIntervalMs || 100;

    let buffer: string[] = [];
    let lastFlush = Date.now();

    const flush = () => {
      if (buffer.length > 0) {
        const content = buffer.join('');
        buffer = [];
        lastFlush = Date.now();
        return content;
      }
      return null;
    };

    try {
      for await (const chunk of stream) {
        buffer.push(chunk);

        // Flush if buffer is full or interval has passed
        const shouldFlush = buffer.length >= bufferSize || (Date.now() - lastFlush) >= flushIntervalMs;

        if (shouldFlush) {
          const content = flush();
          if (content) {
            yield content;
          }
        }
      }

      // Flush remaining buffer
      const content = flush();
      if (content) {
        yield content;
      }
    } catch (error: any) {
      logger.error('Error in buffered stream', { error: error.message });
      throw error;
    }
  }

  /**
   * Track stream metrics
   */
  static createStreamMetrics() {
    const startTime = Date.now();
    let chunkCount = 0;
    let totalBytes = 0;
    let firstChunkTime: number | null = null;

    return {
      recordChunk: (content: string) => {
        chunkCount++;
        totalBytes += Buffer.byteLength(content, 'utf8');

        if (firstChunkTime === null) {
          firstChunkTime = Date.now();
        }
      },
      getMetrics: () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const timeToFirstChunk = firstChunkTime ? firstChunkTime - startTime : null;

        return {
          duration,
          timeToFirstChunk,
          chunkCount,
          totalBytes,
          avgChunkSize: chunkCount > 0 ? totalBytes / chunkCount : 0,
          throughput: duration > 0 ? (totalBytes / duration) * 1000 : 0, // bytes per second
        };
      },
    };
  }

  /**
   * Create a stream with automatic retry on error
   */
  static async *retryableStream<T>(
    streamFactory: () => AsyncIterable<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      shouldRetry?: (error: any) => boolean;
    } = {}
  ): AsyncGenerator<T, void, unknown> {
    const maxRetries = options.maxRetries || 2;
    const retryDelay = options.retryDelay || 1000;
    const shouldRetry = options.shouldRetry || ((error: any) => {
      // Retry on network errors, not on client errors
      return error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        (error instanceof OpenAI.APIError && error.status >= 500);
    });

    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const stream = streamFactory();
        yield* stream;
        return; // Success
      } catch (error: any) {
        attempt++;

        if (attempt > maxRetries || !shouldRetry(error)) {
          logger.error('Stream failed after retries', {
            error: error.message,
            attempts: attempt,
          });
          throw error;
        }

        logger.warn('Stream failed, retrying...', {
          error: error.message,
          attempt,
          maxRetries,
          retryDelay,
        });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }
}
