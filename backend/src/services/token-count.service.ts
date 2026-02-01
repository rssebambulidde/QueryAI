import { encoding_for_model, get_encoding, type TiktokenEncoding, type Tiktoken } from 'tiktoken';
import logger from '../config/logger';

/**
 * Supported encoding types for token counting
 */
export type EncodingType = 'cl100k_base' | 'p50k_base' | 'r50k_base' | 'gpt2' | 'auto';

/**
 * Model-to-encoding mapping
 * Maps OpenAI model names to their encoding types
 */
const MODEL_ENCODING_MAP: Record<string, EncodingType> = {
  // GPT-4 and GPT-3.5 models use cl100k_base
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4-turbo-preview': 'cl100k_base',
  'gpt-4-0125-preview': 'cl100k_base',
  'gpt-4-1106-preview': 'cl100k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'gpt-3.5-turbo-16k': 'cl100k_base',
  'text-embedding-3-small': 'cl100k_base',
  'text-embedding-3-large': 'cl100k_base',
  'text-embedding-ada-002': 'cl100k_base',
  // GPT-3 models use p50k_base
  'text-davinci-003': 'p50k_base',
  'text-davinci-002': 'p50k_base',
  'text-davinci-001': 'p50k_base',
  'text-curie-001': 'p50k_base',
  'text-babbage-001': 'p50k_base',
  'text-ada-001': 'p50k_base',
  // Code models use p50k_base
  'code-davinci-002': 'p50k_base',
  'code-davinci-001': 'p50k_base',
  'code-cushman-002': 'p50k_base',
  'code-cushman-001': 'p50k_base',
};

/**
 * Default encoding type (cl100k_base for GPT-3.5/4 models)
 */
const DEFAULT_ENCODING: EncodingType = 'cl100k_base';

/**
 * Cache for encoding instances to avoid re-initialization
 */
const encodingCache = new Map<EncodingType, Tiktoken>();

/**
 * Token Counting Service
 * Provides accurate token counting using tiktoken library
 */
export class TokenCountService {
  /**
   * Get encoding instance for the specified encoding type
   * Uses caching to avoid re-initialization
   */
  private static getEncoding(encodingType: EncodingType = DEFAULT_ENCODING): Tiktoken {
    // Handle 'auto' by using default encoding
    const actualEncodingType = encodingType === 'auto' ? DEFAULT_ENCODING : encodingType;
    
    if (encodingCache.has(actualEncodingType)) {
      return encodingCache.get(actualEncodingType)!;
    }

    let encoding: Tiktoken;
    try {
      // actualEncodingType is guaranteed to not be 'auto' at this point
      encoding = get_encoding(actualEncodingType as TiktokenEncoding);
      encodingCache.set(actualEncodingType, encoding);
      return encoding;
    } catch (error: any) {
      logger.warn('Failed to get encoding, falling back to default', {
        encodingType: actualEncodingType,
        error: error.message,
      });
      // Fallback to default encoding
      const defaultEncoding = get_encoding(DEFAULT_ENCODING as TiktokenEncoding);
      encodingCache.set(DEFAULT_ENCODING, defaultEncoding);
      return defaultEncoding;
    }
  }

  /**
   * Get encoding type for a specific OpenAI model
   */
  static getEncodingForModel(model: string): EncodingType {
    // Check if model is in the mapping
    if (model in MODEL_ENCODING_MAP) {
      return MODEL_ENCODING_MAP[model];
    }

    // Try to infer from model name
    if (model.includes('gpt-4') || model.includes('gpt-3.5') || model.includes('embedding')) {
      return 'cl100k_base';
    }

    if (model.includes('davinci') || model.includes('curie') || model.includes('babbage') || model.includes('ada')) {
      return 'p50k_base';
    }

    // Default to cl100k_base for modern models
    return DEFAULT_ENCODING;
  }

  /**
   * Count tokens in text using tiktoken
   * This provides exact token counts matching OpenAI's tokenizer
   *
   * @param text - Text to count tokens for
   * @param encodingType - Encoding type to use (default: 'cl100k_base')
   * @returns Exact token count
   */
  static countTokens(text: string, encodingType: EncodingType = DEFAULT_ENCODING): number {
    if (!text || text.length === 0) {
      return 0;
    }

    try {
      const encoding = this.getEncoding(encodingType);
      const tokens = encoding.encode(text);
      return tokens.length;
    } catch (error: any) {
      logger.error('Failed to count tokens with tiktoken', {
        encodingType,
        error: error.message,
        textLength: text.length,
      });
      // Fallback to character-based estimation if tiktoken fails
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Count tokens for a specific OpenAI model
   * Automatically selects the correct encoding for the model
   *
   * @param text - Text to count tokens for
   * @param model - OpenAI model name (e.g., 'gpt-3.5-turbo')
   * @returns Exact token count
   */
  static countTokensForModel(text: string, model: string): number {
    const encodingType = this.getEncodingForModel(model);
    return this.countTokens(text, encodingType);
  }

  /**
   * Count tokens in multiple texts
   * More efficient than calling countTokens multiple times
   *
   * @param texts - Array of texts to count tokens for
   * @param encodingType - Encoding type to use
   * @returns Array of token counts
   */
  static countTokensBatch(
    texts: string[],
    encodingType: EncodingType = DEFAULT_ENCODING
  ): number[] {
    if (texts.length === 0) {
      return [];
    }

    try {
      const encoding = this.getEncoding(encodingType);
      return texts.map((text) => {
        if (!text || text.length === 0) {
          return 0;
        }
        const tokens = encoding.encode(text);
        return tokens.length;
      });
    } catch (error: any) {
      logger.error('Failed to count tokens in batch', {
        encodingType,
        error: error.message,
        batchSize: texts.length,
      });
      // Fallback to character-based estimation
      return texts.map((text) => Math.ceil((text?.length || 0) / 4));
    }
  }

  /**
   * Get encoding instance for a model (for advanced usage)
   * Useful when you need to encode/decode tokens directly
   *
   * @param model - OpenAI model name
   * @returns Tiktoken encoding instance
   */
  static getEncodingForModelInstance(model: string): Tiktoken {
    try {
      return encoding_for_model(model as any);
    } catch (error: any) {
      logger.warn('Failed to get encoding for model, using default', {
        model,
        error: error.message,
      });
      return this.getEncoding(DEFAULT_ENCODING);
    }
  }

  /**
   * Clear encoding cache
   * Useful for testing or memory management
   */
  static clearCache(): void {
    encodingCache.clear();
    logger.debug('Token encoding cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; encodings: EncodingType[] } {
    return {
      size: encodingCache.size,
      encodings: Array.from(encodingCache.keys()),
    };
  }
}
