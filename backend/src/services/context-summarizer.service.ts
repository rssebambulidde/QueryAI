/**
 * Context Summarization Service
 * Uses LLM to summarize long contexts while preserving key information and citations
 * Optimized for contexts that are too long, with emphasis on citation preservation
 */

import { openai } from '../config/openai';
import { TokenCountService } from './token-count.service';
import logger from '../config/logger';
import { RAGContext, DocumentContext } from './rag.service';

/**
 * Summarization configuration
 */
export interface SummarizationConfig {
  enabled: boolean; // Enable context summarization
  summarizationThreshold: number; // Summarize if context exceeds this (default: 12000 tokens)
  maxSummaryTokens: number; // Maximum tokens per summary (default: 400)
  model: string; // Model for summarization (default: 'gpt-3.5-turbo')
  temperature: number; // Temperature for summarization (default: 0.3)
  preserveCitations: boolean; // Preserve citations in summaries (default: true)
  preserveKeyInfo: boolean; // Preserve key information (default: true)
  maxSummarizationTimeMs: number; // Maximum summarization time (default: 3000ms)
  preserveMetadata: boolean; // Preserve document names, URLs, titles (default: true)
  queryAware: boolean; // Use query context for better summarization (default: true)
}

/**
 * Summarized context
 */
export interface SummarizedContext {
  documentContexts: DocumentContext[];
  webSearchResults: Array<{
    title: string;
    url: string;
    content: string;
    publishedDate?: string;
    author?: string;
  }>;
  summarizationStats?: {
    originalTokens: number;
    summarizedTokens: number;
    compressionRatio: number;
    itemsSummarized: number;
    processingTimeMs: number;
  };
}

/**
 * Summarization options
 */
export interface SummarizationOptions {
  config?: Partial<SummarizationConfig>;
  query?: string; // Query context for better summarization
  model?: string; // Model name for token counting
}

/**
 * Default summarization configuration
 */
export const DEFAULT_SUMMARIZATION_CONFIG: SummarizationConfig = {
  enabled: true,
  summarizationThreshold: 12000, // Summarize if exceeds 12000 tokens
  maxSummaryTokens: 400, // Max tokens per summary
  model: 'gpt-3.5-turbo',
  temperature: 0.3, // Lower temperature for consistent summaries
  preserveCitations: true,
  preserveKeyInfo: true,
  maxSummarizationTimeMs: 3000, // 3 seconds max
  preserveMetadata: true,
  queryAware: true,
};

/**
 * Context Summarization Service
 */
export class ContextSummarizerService {
  private static config: SummarizationConfig = DEFAULT_SUMMARIZATION_CONFIG;

  /**
   * Set summarization configuration
   */
  static setConfig(config: Partial<SummarizationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Context summarization configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  static getConfig(): SummarizationConfig {
    return { ...this.config };
  }

  /**
   * Count tokens in context
   */
  private static countContextTokens(
    context: RAGContext,
    model: string = 'gpt-3.5-turbo'
  ): number {
    const encodingType = TokenCountService.getEncodingForModel(model);
    let totalTokens = 0;

    // Count document context tokens
    for (const doc of context.documentContexts) {
      const docText = `[Document] ${doc.documentName}\n${doc.content}`;
      totalTokens += TokenCountService.countTokens(docText, encodingType);
    }

    // Count web results tokens
    for (const result of context.webSearchResults) {
      const resultText = `[Web Source] ${result.title}\nURL: ${result.url}\n${result.content}`;
      totalTokens += TokenCountService.countTokens(resultText, encodingType);
    }

    return totalTokens;
  }

  /**
   * Summarize a document context using LLM
   */
  private static async summarizeDocument(
    doc: DocumentContext,
    query: string | undefined,
    config: SummarizationConfig,
    model: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Build prompt for summarization
      let prompt = `Summarize the following document excerpt while preserving key information, facts, numbers, dates, and important details.\n\n`;
      
      if (config.preserveCitations) {
        prompt += `IMPORTANT: Preserve all citations, references, and source information. Include the document name: "${doc.documentName}".\n\n`;
      }
      
      if (query && config.queryAware) {
        prompt += `Focus on information relevant to this query: "${query}"\n\n`;
      }
      
      prompt += `Document: ${doc.documentName}\n`;
      prompt += `Content:\n${doc.content}\n\n`;
      prompt += `Provide a concise summary that preserves:\n`;
      prompt += `- Key facts and numbers\n`;
      prompt += `- Important dates and names\n`;
      prompt += `- Main points and conclusions\n`;
      if (config.preserveCitations) {
        prompt += `- Source: ${doc.documentName}\n`;
      }
      prompt += `\nSummary:`;

      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries while preserving all important information, facts, and citations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: config.maxSummaryTokens,
        temperature: config.temperature,
      });

      const summary = response.choices[0]?.message?.content || doc.content;
      const processingTime = Date.now() - startTime;

      if (processingTime > config.maxSummarizationTimeMs) {
        logger.warn('Document summarization exceeded target time', {
          processingTimeMs: processingTime,
          targetTime: config.maxSummarizationTimeMs,
        });
      }

      return summary;
    } catch (error: any) {
      logger.error('Failed to summarize document', {
        documentId: doc.documentId,
        error: error.message,
      });
      // Return original content if summarization fails
      return doc.content;
    }
  }

  /**
   * Summarize a web result using LLM
   */
  private static async summarizeWebResult(
    result: { title: string; url: string; content: string; publishedDate?: string; author?: string },
    query: string | undefined,
    config: SummarizationConfig,
    model: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Build prompt for summarization
      let prompt = `Summarize the following web article while preserving key information, facts, numbers, dates, and important details.\n\n`;
      
      if (config.preserveCitations) {
        prompt += `IMPORTANT: Preserve all citations and source information. Include the source URL: "${result.url}" and title: "${result.title}".\n\n`;
      }
      
      if (query && config.queryAware) {
        prompt += `Focus on information relevant to this query: "${query}"\n\n`;
      }
      
      prompt += `Title: ${result.title}\n`;
      prompt += `URL: ${result.url}\n`;
      if (result.publishedDate) {
        prompt += `Published: ${result.publishedDate}\n`;
      }
      if (result.author) {
        prompt += `Author: ${result.author}\n`;
      }
      prompt += `Content:\n${result.content}\n\n`;
      prompt += `Provide a concise summary that preserves:\n`;
      prompt += `- Key facts and numbers\n`;
      prompt += `- Important dates and names\n`;
      prompt += `- Main points and conclusions\n`;
      if (config.preserveCitations) {
        prompt += `- Source: [${result.title}](${result.url})\n`;
      }
      prompt += `\nSummary:`;

      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates concise summaries while preserving all important information, facts, and citations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: config.maxSummaryTokens,
        temperature: config.temperature,
      });

      const summary = response.choices[0]?.message?.content || result.content;
      const processingTime = Date.now() - startTime;

      if (processingTime > config.maxSummarizationTimeMs) {
        logger.warn('Web result summarization exceeded target time', {
          processingTimeMs: processingTime,
          targetTime: config.maxSummarizationTimeMs,
        });
      }

      return summary;
    } catch (error: any) {
      logger.error('Failed to summarize web result', {
        url: result.url,
        error: error.message,
      });
      // Return original content if summarization fails
      return result.content;
    }
  }

  /**
   * Summarize context when it's too long
   * Preserves key information and citations
   */
  static async summarizeContext(
    context: RAGContext,
    options: SummarizationOptions = {}
  ): Promise<{
    context: SummarizedContext;
    wasSummarized: boolean;
  }> {
    const startTime = Date.now();
    const config: SummarizationConfig = { ...this.config, ...options.config };
    const model = options.model || 'gpt-3.5-turbo';

    if (!config.enabled) {
      return {
        context: {
          documentContexts: context.documentContexts,
          webSearchResults: context.webSearchResults,
        },
        wasSummarized: false,
      };
    }

    // Count tokens in context
    const originalTokens = this.countContextTokens(context, model);

    // Check if summarization is needed
    if (originalTokens <= config.summarizationThreshold) {
      logger.debug('Context does not exceed summarization threshold', {
        tokens: originalTokens,
        threshold: config.summarizationThreshold,
      });
      return {
        context: {
          documentContexts: context.documentContexts,
          webSearchResults: context.webSearchResults,
        },
        wasSummarized: false,
      };
    }

    logger.info('Summarizing context', {
      originalTokens,
      threshold: config.summarizationThreshold,
      documentCount: context.documentContexts.length,
      webResultCount: context.webSearchResults.length,
    });

    // Summarize document contexts
    const summarizedDocuments: DocumentContext[] = [];
    let itemsSummarized = 0;

    for (const doc of context.documentContexts) {
      // Check time limit
      if (Date.now() - startTime > config.maxSummarizationTimeMs) {
        logger.warn('Summarization time limit approaching, using original content for remaining items');
        // Add remaining documents without summarization
        summarizedDocuments.push(doc);
        continue;
      }

      const summary = await this.summarizeDocument(doc, options.query, config, model);
      summarizedDocuments.push({
        ...doc,
        content: summary,
      });
      itemsSummarized++;
    }

    // Summarize web results
    const summarizedWebResults: Array<{
      title: string;
      url: string;
      content: string;
      publishedDate?: string;
      author?: string;
    }> = [];

    for (const result of context.webSearchResults) {
      // Check time limit
      if (Date.now() - startTime > config.maxSummarizationTimeMs) {
        logger.warn('Summarization time limit approaching, using original content for remaining items');
        // Add remaining web results without summarization
        summarizedWebResults.push(result);
        continue;
      }

      const summary = await this.summarizeWebResult(result, options.query, config, model);
      summarizedWebResults.push({
        ...result,
        content: summary,
      });
      itemsSummarized++;
    }

    // Count tokens after summarization
    const summarizedContext: SummarizedContext = {
      documentContexts: summarizedDocuments,
      webSearchResults: summarizedWebResults,
    };
    const summarizedTokens = this.countContextTokens(summarizedContext, model);
    const compressionRatio = originalTokens > 0 ? summarizedTokens / originalTokens : 1.0;
    const processingTimeMs = Date.now() - startTime;

    summarizedContext.summarizationStats = {
      originalTokens,
      summarizedTokens,
      compressionRatio,
      itemsSummarized,
      processingTimeMs,
    };

    logger.info('Context summarized', {
      originalTokens,
      summarizedTokens,
      compressionRatio: compressionRatio.toFixed(2),
      itemsSummarized,
      processingTimeMs,
    });

    if (processingTimeMs > config.maxSummarizationTimeMs) {
      logger.warn('Summarization exceeded target time', {
        processingTimeMs,
        targetTime: config.maxSummarizationTimeMs,
      });
    }

    return {
      context: summarizedContext,
      wasSummarized: true,
    };
  }

  /**
   * Quick summarization (faster, less detailed)
   * Useful when time is critical
   */
  static async quickSummarizeContext(
    context: RAGContext,
    options: SummarizationOptions = {}
  ): Promise<{
    context: SummarizedContext;
    wasSummarized: boolean;
  }> {
    // Use faster configuration
    const quickConfig: Partial<SummarizationConfig> = {
      maxSummaryTokens: 200, // Shorter summaries
      temperature: 0.2, // Lower temperature for faster generation
      maxSummarizationTimeMs: 2000, // 2 seconds max
      ...options.config,
    };

    return this.summarizeContext(context, {
      ...options,
      config: quickConfig,
    });
  }
}
