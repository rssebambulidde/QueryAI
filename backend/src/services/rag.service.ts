import { EmbeddingService } from './embedding.service';
import { PineconeService, SearchResult } from './pinecone.service';
import { SearchService, SearchRequest } from './search.service';
import { DocumentService } from './document.service';
import { ChunkService } from './chunk.service';
import logger from '../config/logger';
import { AppError } from '../types/error';

export interface DocumentContext {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface RAGContext {
  documentContexts: DocumentContext[];
  webSearchResults: Array<{
    title: string;
    url: string;
    content: string;
  }>;
}

export interface RAGOptions {
  userId: string;
  topicId?: string;
  documentIds?: string[];
  enableDocumentSearch?: boolean;
  enableWebSearch?: boolean;
  maxDocumentChunks?: number;
  maxWebResults?: number;
  minScore?: number;
  // Web search filters
  topic?: string; // Topic/keyword for web search
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  startDate?: string;
  endDate?: string;
  country?: string;
}

/**
 * RAG Service
 * Retrieval-Augmented Generation: Combines document embeddings with web search
 */
export class RAGService {
  /**
   * Retrieve relevant document chunks from Pinecone
   */
  static async retrieveDocumentContext(
    query: string,
    options: RAGOptions
  ): Promise<DocumentContext[]> {
    if (!options.enableDocumentSearch) {
      return [];
    }

    try {
      // Generate embedding for the query
      logger.info('Generating query embedding for document retrieval', {
        userId: options.userId,
        queryLength: query.length,
      });

      const queryEmbedding = await EmbeddingService.generateEmbedding(query);

      // Check if Pinecone is configured
      const { isPineconeConfigured } = await import('../config/pinecone');
      if (!isPineconeConfigured()) {
        logger.warn('Pinecone is not configured - document search unavailable', {
          userId: options.userId,
          message: 'PINECONE_API_KEY environment variable is not set. Document search requires Pinecone to be configured.',
        });
        return [];
      }

      // Search Pinecone for similar document chunks
      // Use higher default threshold (0.7) to ensure relevance
      const minScore = options.minScore || 0.7;
      
      logger.info('Searching Pinecone for document chunks', {
        userId: options.userId,
        query: query.substring(0, 100),
        topK: options.maxDocumentChunks || 5,
        minScore,
        topicId: options.topicId,
        documentIds: options.documentIds,
      });

      let searchResults: any[] = [];
      try {
        searchResults = await PineconeService.search(queryEmbedding, {
          userId: options.userId,
          topK: options.maxDocumentChunks || 5,
          topicId: options.topicId,
          documentIds: options.documentIds,
          minScore,
        });
      } catch (searchError: any) {
        // If Pinecone search fails, log and return empty
        if (searchError.code === 'PINECONE_NOT_CONFIGURED') {
          logger.warn('Pinecone not configured, skipping document search', {
            userId: options.userId,
          });
          return [];
        }
        // Re-throw other errors
        throw searchError;
      }

      // Filter results by relevance - only include documents with meaningful similarity
      // If no results with current threshold, try slightly lower (0.6) but not too low
      if (searchResults.length === 0 && minScore > 0.6) {
        logger.info('No results with minScore, trying slightly lower threshold', {
          userId: options.userId,
          originalMinScore: minScore,
        });
        
        // Try with slightly lower threshold (0.6) if no results, but not too low
        searchResults = await PineconeService.search(queryEmbedding, {
          userId: options.userId,
          topK: options.maxDocumentChunks || 5,
          topicId: options.topicId,
          documentIds: options.documentIds,
          minScore: 0.6,
        });
      }
      
      // Additional filtering: Remove results with very low scores
      searchResults = searchResults.filter((result: any) => {
        const score = result.score || result.metadata?.score || 0;
        return score >= 0.6; // Hard minimum threshold to avoid irrelevant documents
      });

      if (searchResults.length === 0) {
        logger.info('No relevant document chunks found', {
          userId: options.userId,
          query: query.substring(0, 100),
        });
        return [];
      }

      // Fetch document metadata for each result
      const documentContexts: DocumentContext[] = [];

      for (const result of searchResults) {
        try {
          // Get document metadata
          const document = await DocumentService.getDocument(
            result.documentId,
            options.userId
          );

          if (!document) {
            logger.warn('Document not found for chunk', {
              documentId: result.documentId,
              chunkId: result.chunkId,
            });
            continue;
          }

          documentContexts.push({
            documentId: result.documentId,
            documentName: document.filename,
            chunkIndex: result.chunkIndex,
            content: result.content,
            score: result.score,
          });
        } catch (error: any) {
          logger.warn('Failed to fetch document metadata', {
            documentId: result.documentId,
            error: error.message,
          });
          // Still include the chunk even if document fetch fails
          documentContexts.push({
            documentId: result.documentId,
            documentName: 'Unknown Document',
            chunkIndex: result.chunkIndex,
            content: result.content,
            score: result.score,
          });
        }
      }

      logger.info('Document context retrieved', {
        userId: options.userId,
        chunkCount: documentContexts.length,
      });

      return documentContexts;
    } catch (error: any) {
      logger.error('Failed to retrieve document context', {
        userId: options.userId,
        error: error.message,
      });
      // Don't throw - return empty array so web search can still work
      return [];
    }
  }

  /**
   * Retrieve web search results from Tavily
   */
  static async retrieveWebSearch(
    query: string,
    options: RAGOptions
  ): Promise<Array<{ title: string; url: string; content: string }>> {
    if (!options.enableWebSearch) {
      return [];
    }

    try {
      const searchRequest: SearchRequest = {
        query,
        topic: options.topic || undefined, // Use topic filter from options
        maxResults: options.maxWebResults || 5,
        timeRange: options.timeRange,
        startDate: options.startDate,
        endDate: options.endDate,
        country: options.country,
      };

      logger.info('Performing web search with filters', {
        query: query.substring(0, 100),
        topic: options.topic,
        timeRange: options.timeRange,
        country: options.country,
        startDate: options.startDate,
        endDate: options.endDate,
      });

      const searchResponse = await SearchService.search(searchRequest);

      if (!searchResponse.results || searchResponse.results.length === 0) {
        logger.info('No web search results found', {
          query: query.substring(0, 100),
        });
        return [];
      }

      const results = searchResponse.results.map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
      }));

      logger.info('Web search results retrieved', {
        resultsCount: results.length,
      });

      return results;
    } catch (error: any) {
      logger.warn('Web search failed, continuing without web results', {
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Retrieve RAG context (documents + web search)
   */
  static async retrieveContext(
    query: string,
    options: RAGOptions
  ): Promise<RAGContext> {
    logger.info('Retrieving RAG context', {
      userId: options.userId,
      query: query.substring(0, 100),
      enableDocumentSearch: options.enableDocumentSearch,
      enableWebSearch: options.enableWebSearch,
    });

    // Retrieve both document context and web search in parallel
    const [documentContexts, webSearchResults] = await Promise.all([
      this.retrieveDocumentContext(query, options),
      this.retrieveWebSearch(query, options),
    ]);

    logger.info('RAG context retrieved', {
      userId: options.userId,
      documentChunks: documentContexts.length,
      webResults: webSearchResults.length,
    });

    return {
      documentContexts,
      webSearchResults,
    };
  }

  /**
   * Format RAG context for AI prompt
   */
  static formatContextForPrompt(context: RAGContext): string {
    let formattedContext = '';

    // Add document context
    if (context.documentContexts.length > 0) {
      formattedContext += 'Relevant Document Excerpts:\n\n';
      context.documentContexts.forEach((doc, index) => {
        formattedContext += `[Document ${index + 1}] ${doc.documentName}\n`;
        formattedContext += `Relevance Score: ${doc.score.toFixed(2)}\n`;
        formattedContext += `Content: ${doc.content}\n\n`;
      });
    }

    // Add web search results
    if (context.webSearchResults.length > 0) {
      formattedContext += 'Web Search Results:\n\n';
      context.webSearchResults.forEach((result, index) => {
        const n = index + 1;
        formattedContext += `[Web Source ${n}] ${result.title}\n`;
        formattedContext += `URL: ${result.url}\n`;
        formattedContext += `Content: ${result.content}\n\n`;
        formattedContext += `CITING: You MUST use [Web Source ${n}](${result.url}) inline when using this source—this exact format is required for clickable links.\n\n`;
      });
    }

    return formattedContext;
  }

  /**
   * Extract sources from RAG context for response
   */
  static extractSources(context: RAGContext): Array<{
    type: 'document' | 'web';
    title: string;
    url?: string;
    documentId?: string;
    snippet?: string;
    score?: number;
  }> {
    const sources: Array<{
      type: 'document' | 'web';
      title: string;
      url?: string;
      documentId?: string;
      snippet?: string;
      score?: number;
    }> = [];

    // Add document sources - only include documents with meaningful relevance scores (>= 0.6)
    context.documentContexts
      .filter((doc) => doc.score >= 0.6) // Only include documents with good relevance
      .forEach((doc, index) => {
        sources.push({
          type: 'document',
          title: doc.documentName,
          documentId: doc.documentId,
          snippet: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''),
          score: doc.score,
        });
      });

    // Add web sources
    context.webSearchResults.forEach((result, index) => {
      sources.push({
        type: 'web',
        title: result.title,
        url: result.url,
        snippet: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''),
      });
    });

    return sources;
  }
}
