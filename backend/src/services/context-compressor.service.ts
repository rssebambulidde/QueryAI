/**
 * Context Compression Service
 * Compresses RAG context using LLM-based summarization and extraction
 * Preserves key information while reducing token count
 */

import { openai } from '../config/openai';
import { TokenCountService } from './token-count.service';
import logger from '../config/logger';
import { RAGContext, DocumentContext } from './rag.service';

export type CompressionStrategy = 'summarization' | 'extraction' | 'truncation' | 'hybrid';

export interface CompressionConfig {
  enabled: boolean; // Enable context compression
  maxContextTokens: number; // Maximum tokens for context (default: 8000)
  compressionThreshold: number; // Compress if context exceeds this (default: 10000)
  strategy: CompressionStrategy; // Compression strategy
  preserveKeyInfo: boolean; // Preserve key information (default: true)
  maxCompressionTimeMs: number; // Maximum compression time (default: 2000ms)
  // Summarization settings
  summarizationModel: string; // Model for summarization (default: 'gpt-3.5-turbo')
  summarizationMaxTokens: number; // Max tokens for summarization output
  summarizationTemperature: number; // Temperature for summarization
  // Extraction settings
  extractKeyPoints: boolean; // Extract key points instead of full summarization
  maxKeyPoints: number; // Maximum key points to extract
  // Truncation settings
  truncationStrategy: 'start' | 'end' | 'middle' | 'smart'; // Where to truncate
  preserveHeaders: boolean; // Preserve headers/titles when truncating
}

export interface CompressedContext {
  documentContexts: DocumentContext[];
  webSearchResults: Array<{
    title: string;
    url: string;
    content: string;
  }>;
  compressionStats?: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    strategy: CompressionStrategy;
    processingTimeMs: number;
  };
}

export interface CompressionOptions {
  config?: Partial<CompressionConfig>;
  query?: string; // Query context for better compression
  model?: string; // Model name for token counting
}

/**
 * Default compression configuration
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  enabled: true,
  maxContextTokens: 8000, // Target: 8000 tokens
  compressionThreshold: 10000, // Compress if exceeds 10000 tokens
  strategy: 'hybrid', // Use hybrid strategy by default
  preserveKeyInfo: true,
  maxCompressionTimeMs: 2000, // 2 seconds max
  summarizationModel: 'gpt-3.5-turbo',
  summarizationMaxTokens: 500, // Max tokens per summary
  summarizationTemperature: 0.3, // Lower temperature for more consistent summaries
  extractKeyPoints: true,
  maxKeyPoints: 5,
  truncationStrategy: 'smart',
  preserveHeaders: true,
};

/**
 * Context Compression Service
 */
export class ContextCompressorService {
  private static config: CompressionConfig = DEFAULT_COMPRESSION_CONFIG;

  /**
   * Set compression configuration
   */
  static setConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Context compression configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  static getConfig(): CompressionConfig {
    return { ...this.config };
  }

  /**
   * Count tokens in context
   */
  private static countContextTokens(
    context: RAGContext,
    model: string = 'gpt-3.5-turbo'
  ): number {
    let totalTokens = 0;

    // Count document context tokens
    for (const doc of context.documentContexts) {
      const docText = `${doc.documentName}\n${doc.content}`;
      totalTokens += TokenCountService.countTokensForModel(docText, model);
    }

    // Count web result tokens
    for (const result of context.webSearchResults) {
      const resultText = `${result.title}\n${result.url}\n${result.content}`;
      totalTokens += TokenCountService.countTokensForModel(resultText, model);
    }

    return totalTokens;
  }

  /**
   * Truncate text intelligently
   */
  private static truncateText(
    text: string,
    maxTokens: number,
    strategy: 'start' | 'end' | 'middle' | 'smart',
    model: string = 'gpt-3.5-turbo'
  ): string {
    const currentTokens = TokenCountService.countTokensForModel(text, model);
    
    if (currentTokens <= maxTokens) {
      return text;
    }

    const targetChars = Math.floor((maxTokens / currentTokens) * text.length * 0.9); // 90% to be safe

    if (strategy === 'start') {
      // Keep end
      return '...' + text.slice(-targetChars);
    } else if (strategy === 'end') {
      // Keep start
      return text.slice(0, targetChars) + '...';
    } else if (strategy === 'middle') {
      // Keep start and end
      const startChars = Math.floor(targetChars / 2);
      const endChars = targetChars - startChars;
      return text.slice(0, startChars) + '...' + text.slice(-endChars);
    } else {
      // Smart: try to preserve sentences
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let result = '';
      let tokens = 0;

      // Start from beginning, add sentences until we hit limit
      for (const sentence of sentences) {
        const sentenceTokens = TokenCountService.countTokensForModel(sentence, model);
        if (tokens + sentenceTokens > maxTokens) {
          break;
        }
        result += sentence;
        tokens += sentenceTokens;
      }

      if (result.length < text.length) {
        result += '...';
      }

      return result;
    }
  }

  /**
   * Summarize content using LLM
   */
  private static async summarizeContent(
    content: string,
    query: string | undefined,
    config: CompressionConfig,
    model: string = 'gpt-3.5-turbo'
  ): Promise<string> {
    if (!openai) {
      logger.warn('OpenAI not configured, using truncation instead of summarization');
      return this.truncateText(content, config.summarizationMaxTokens * 4, 'smart', model);
    }

    try {
      const prompt = query
        ? `Summarize the following content in relation to the query "${query}". Preserve all key facts, numbers, dates, and important details. Keep the summary concise but comprehensive.\n\nContent:\n${content}`
        : `Summarize the following content. Preserve all key facts, numbers, dates, and important details. Keep the summary concise but comprehensive.\n\nContent:\n${content}`;

      const response = await openai.chat.completions.create({
        model: config.summarizationModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries while preserving all important information, facts, numbers, and key details.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: config.summarizationMaxTokens,
        temperature: config.summarizationTemperature,
      });

      const summary = response.choices[0]?.message?.content || content;
      return summary.trim();
    } catch (error: any) {
      logger.warn('LLM summarization failed, using truncation', {
        error: error.message,
      });
      // Fallback to truncation
      return this.truncateText(content, config.summarizationMaxTokens * 4, 'smart', model);
    }
  }

  /**
   * Extract key points from content
   */
  private static async extractKeyPoints(
    content: string,
    query: string | undefined,
    config: CompressionConfig,
    model: string = 'gpt-3.5-turbo'
  ): Promise<string> {
    if (!openai) {
      logger.warn('OpenAI not configured, using truncation instead of extraction');
      return this.truncateText(content, config.summarizationMaxTokens * 4, 'smart', model);
    }

    try {
      const prompt = query
        ? `Extract the ${config.maxKeyPoints} most important key points from the following content in relation to the query "${query}". Format as a bulleted list. Preserve facts, numbers, and dates.\n\nContent:\n${content}`
        : `Extract the ${config.maxKeyPoints} most important key points from the following content. Format as a bulleted list. Preserve facts, numbers, and dates.\n\nContent:\n${content}`;

      const response = await openai.chat.completions.create({
        model: config.summarizationModel,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts key points while preserving all important information, facts, numbers, and dates.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: config.summarizationMaxTokens,
        temperature: config.summarizationTemperature,
      });

      const keyPoints = response.choices[0]?.message?.content || content;
      return keyPoints.trim();
    } catch (error: any) {
      logger.warn('LLM extraction failed, using truncation', {
        error: error.message,
      });
      // Fallback to truncation
      return this.truncateText(content, config.summarizationMaxTokens * 4, 'smart', model);
    }
  }

  /**
   * Compress document context
   */
  private static async compressDocumentContext(
    context: DocumentContext,
    query: string | undefined,
    config: CompressionConfig,
    targetTokens: number,
    model: string
  ): Promise<DocumentContext> {
    const currentTokens = TokenCountService.countTokensForModel(context.content, model);
    
    if (currentTokens <= targetTokens) {
      return context; // No compression needed
    }

    let compressedContent: string;

    if (config.strategy === 'summarization') {
      compressedContent = await this.summarizeContent(context.content, query, config, model);
    } else if (config.strategy === 'extraction') {
      compressedContent = await this.extractKeyPoints(context.content, query, config, model);
    } else if (config.strategy === 'truncation') {
      compressedContent = this.truncateText(
        context.content,
        targetTokens,
        config.truncationStrategy,
        model
      );
    } else {
      // Hybrid: try summarization first, fallback to truncation if too slow
      try {
        compressedContent = await this.summarizeContent(context.content, query, config, model);
        // Verify it's actually shorter
        const compressedTokens = TokenCountService.countTokensForModel(compressedContent, model);
        if (compressedTokens >= currentTokens * 0.9) {
          // Summarization didn't help much, use truncation
          compressedContent = this.truncateText(
            context.content,
            targetTokens,
            config.truncationStrategy,
            model
          );
        }
      } catch (e) {
        // Fallback to truncation
        compressedContent = this.truncateText(
          context.content,
          targetTokens,
          config.truncationStrategy,
          model
        );
      }
    }

    return {
      ...context,
      content: compressedContent,
    };
  }

  /**
   * Compress web result
   */
  private static async compressWebResult(
    result: { title: string; url: string; content: string },
    query: string | undefined,
    config: CompressionConfig,
    targetTokens: number,
    model: string
  ): Promise<{ title: string; url: string; content: string }> {
    const currentTokens = TokenCountService.countTokensForModel(result.content, model);
    
    if (currentTokens <= targetTokens) {
      return result; // No compression needed
    }

    let compressedContent: string;

    if (config.strategy === 'summarization') {
      compressedContent = await this.summarizeContent(result.content, query, config, model);
    } else if (config.strategy === 'extraction') {
      compressedContent = await this.extractKeyPoints(result.content, query, config, model);
    } else if (config.strategy === 'truncation') {
      compressedContent = this.truncateText(
        result.content,
        targetTokens,
        config.truncationStrategy,
        model
      );
    } else {
      // Hybrid: try summarization first
      try {
        compressedContent = await this.summarizeContent(result.content, query, config, model);
        const compressedTokens = TokenCountService.countTokensForModel(compressedContent, model);
        if (compressedTokens >= currentTokens * 0.9) {
          compressedContent = this.truncateText(
            result.content,
            targetTokens,
            config.truncationStrategy,
            model
          );
        }
      } catch (e) {
        compressedContent = this.truncateText(
          result.content,
          targetTokens,
          config.truncationStrategy,
          model
        );
      }
    }

    return {
      ...result,
      content: compressedContent,
    };
  }

  /**
   * Compress RAG context
   */
  static async compressContext(
    context: RAGContext,
    options: CompressionOptions = {}
  ): Promise<{
    context: CompressedContext;
    wasCompressed: boolean;
  }> {
    const startTime = Date.now();
    const config = { ...this.config, ...options.config };
    const model = options.model || 'gpt-3.5-turbo';

    if (!config.enabled) {
      return {
        context: {
          documentContexts: context.documentContexts,
          webSearchResults: context.webSearchResults,
        },
        wasCompressed: false,
      };
    }

    // Count tokens in original context
    const originalTokens = this.countContextTokens(context, model);

    // Check if compression is needed
    if (originalTokens <= config.compressionThreshold) {
      return {
        context: {
          documentContexts: context.documentContexts,
          webSearchResults: context.webSearchResults,
        },
        wasCompressed: false,
      };
    }

    logger.info('Context compression needed', {
      originalTokens,
      threshold: config.compressionThreshold,
      targetTokens: config.maxContextTokens,
      strategy: config.strategy,
    });

    // Calculate target tokens per item
    const totalItems = context.documentContexts.length + context.webSearchResults.length;
    const targetTokensPerItem = totalItems > 0
      ? Math.floor(config.maxContextTokens / totalItems)
      : config.maxContextTokens;

    // Compress document contexts
    const compressedDocuments: DocumentContext[] = [];
    for (const doc of context.documentContexts) {
      // Check time limit
      if (Date.now() - startTime > config.maxCompressionTimeMs) {
        logger.warn('Compression time limit reached, using original content', {
          processed: compressedDocuments.length,
          total: context.documentContexts.length,
        });
        // Add remaining documents as-is
        compressedDocuments.push(...context.documentContexts.slice(compressedDocuments.length));
        break;
      }

      const compressed = await this.compressDocumentContext(
        doc,
        options.query,
        config,
        targetTokensPerItem,
        model
      );
      compressedDocuments.push(compressed);
    }

    // Compress web results
    const compressedWebResults: Array<{ title: string; url: string; content: string }> = [];
    for (const result of context.webSearchResults) {
      // Check time limit
      if (Date.now() - startTime > config.maxCompressionTimeMs) {
        logger.warn('Compression time limit reached, using original content', {
          processed: compressedWebResults.length,
          total: context.webSearchResults.length,
        });
        // Add remaining results as-is
        compressedWebResults.push(...context.webSearchResults.slice(compressedWebResults.length));
        break;
      }

      const compressed = await this.compressWebResult(
        result,
        options.query,
        config,
        targetTokensPerItem,
        model
      );
      compressedWebResults.push(compressed);
    }

    // Count tokens in compressed context
    const compressedContext: RAGContext = {
      documentContexts: compressedDocuments,
      webSearchResults: compressedWebResults,
    };
    const compressedTokens = this.countContextTokens(compressedContext, model);
    const compressionRatio = originalTokens > 0 ? compressedTokens / originalTokens : 1.0;
    const processingTimeMs = Date.now() - startTime;

    logger.info('Context compression completed', {
      originalTokens,
      compressedTokens,
      compressionRatio: compressionRatio.toFixed(2),
      strategy: config.strategy,
      processingTimeMs,
    });

    return {
      context: {
        documentContexts: compressedDocuments,
        webSearchResults: compressedWebResults,
        compressionStats: {
          originalTokens,
          compressedTokens,
          compressionRatio,
          strategy: config.strategy,
          processingTimeMs,
        },
      },
      wasCompressed: true,
    };
  }

  /**
   * Quick compress (truncation only, fastest)
   */
  static quickCompress(
    context: RAGContext,
    maxTokens: number,
    model: string = 'gpt-3.5-turbo'
  ): CompressedContext {
    const totalItems = context.documentContexts.length + context.webSearchResults.length;
    const targetTokensPerItem = totalItems > 0 ? Math.floor(maxTokens / totalItems) : maxTokens;

    const compressedDocuments = context.documentContexts.map(doc => ({
      ...doc,
      content: this.truncateText(doc.content, targetTokensPerItem, 'smart', model),
    }));

    const compressedWebResults = context.webSearchResults.map(result => ({
      ...result,
      content: this.truncateText(result.content, targetTokensPerItem, 'smart', model),
    }));

    return {
      documentContexts: compressedDocuments,
      webSearchResults: compressedWebResults,
    };
  }
}
