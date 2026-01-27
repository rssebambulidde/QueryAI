/**
 * Keyword Search Service
 * Provides keyword-based search using BM25 algorithm
 * Integrates with document storage and indexing
 */

import { BM25Index, IndexedDocument, getBM25Index } from './bm25-index.service';
import { ChunkService } from './chunk.service';
import { DocumentService } from './document.service';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { Database } from '../types/database';

export interface KeywordSearchResult {
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  content: string;
  score: number;
  documentName?: string;
}

export interface KeywordSearchOptions {
  userId: string;
  topicId?: string;
  documentIds?: string[];
  topK?: number;
  minScore?: number;
}

/**
 * Keyword Search Service
 * Handles keyword-based document retrieval using BM25
 */
export class KeywordSearchService {
  private static index: BM25Index | null = null;

  /**
   * Get or create BM25 index
   */
  private static getIndex(): BM25Index {
    if (!this.index) {
      this.index = getBM25Index();
    }
    return this.index;
  }

  /**
   * Index a document's chunks
   */
  static async indexDocument(
    documentId: string,
    userId: string,
    topicId?: string
  ): Promise<void> {
    try {
      // Get document chunks from database
      const chunks = await ChunkService.getChunksByDocument(documentId, userId);
      
      if (!chunks || chunks.length === 0) {
        logger.warn('No chunks found for document', { documentId });
        return;
      }

      // Get document metadata
      const document = await DocumentService.getDocument(documentId, userId);
      if (!document) {
        throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
      }

      // Convert chunks to indexed documents
      const indexedDocs: IndexedDocument[] = chunks.map((chunk) => ({
        id: chunk.id,
        documentId: documentId,
        content: chunk.content || '',
        userId,
        topicId: topicId || document.topic_id || undefined,
        chunkIndex: chunk.chunk_index,
        metadata: {
          startChar: chunk.start_char,
          endChar: chunk.end_char,
          tokenCount: chunk.token_count,
        },
      }));

      // Add to index
      const index = this.getIndex();
      index.addDocuments(indexedDocs);

      logger.info('Document indexed for keyword search', {
        documentId,
        chunkCount: indexedDocs.length,
      });
    } catch (error: any) {
      logger.error('Failed to index document for keyword search', {
        documentId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Index multiple documents
   */
  static async indexDocuments(
    documentIds: string[],
    userId: string
  ): Promise<{ indexed: number; failed: number }> {
    let indexed = 0;
    let failed = 0;

    for (const documentId of documentIds) {
      try {
        await this.indexDocument(documentId, userId);
        indexed++;
      } catch (error: any) {
        logger.warn('Failed to index document', {
          documentId,
          error: error.message,
        });
        failed++;
      }
    }

    logger.info('Bulk indexing completed', {
      total: documentIds.length,
      indexed,
      failed,
    });

    return { indexed, failed };
  }

  /**
   * Remove document from index
   */
  static async removeDocumentFromIndex(documentId: string): Promise<void> {
    const index = this.getIndex();
    index.removeDocumentChunks(documentId);
    
    logger.info('Document removed from keyword index', { documentId });
  }

  /**
   * Search documents using keyword search
   */
  static async search(
    query: string,
    options: KeywordSearchOptions
  ): Promise<KeywordSearchResult[]> {
    try {
      const index = this.getIndex();
      
      // Perform BM25 search
      const results = index.search(query, {
        userId: options.userId,
        topicId: options.topicId,
        documentIds: options.documentIds,
        topK: options.topK || 10,
        minScore: options.minScore || 0,
      });

      if (results.length === 0) {
        return [];
      }

      // Fetch document names for results
      const keywordResults: KeywordSearchResult[] = [];
      const documentIds = new Set(results.map(r => r.document.documentId));
      const documentMap = new Map<string, Database.Document>();

      // Fetch all documents in one batch
      for (const docId of documentIds) {
        try {
          const doc = await DocumentService.getDocument(docId, options.userId);
          if (doc) {
            documentMap.set(docId, doc);
          }
        } catch (error: any) {
          logger.warn('Failed to fetch document for keyword search result', {
            documentId: docId,
            error: error.message,
          });
        }
      }

      // Build results
      for (const { document: indexedDoc, score } of results) {
        const doc = documentMap.get(indexedDoc.documentId);
        
        keywordResults.push({
          documentId: indexedDoc.documentId,
          chunkId: indexedDoc.id,
          chunkIndex: indexedDoc.chunkIndex || 0,
          content: indexedDoc.content,
          score,
          documentName: doc?.filename || 'Unknown Document',
        });
      }

      logger.info('Keyword search completed', {
        query: query.substring(0, 100),
        resultsCount: keywordResults.length,
        userId: options.userId,
      });

      return keywordResults;
    } catch (error: any) {
      logger.error('Keyword search failed', {
        query: query.substring(0, 100),
        error: error.message,
      });
      throw new AppError('Keyword search failed', 500, 'KEYWORD_SEARCH_ERROR');
    }
  }

  /**
   * Get index statistics
   */
  static getIndexStats(): {
    totalDocuments: number;
    totalTerms: number;
    averageDocumentLength: number;
  } {
    const index = this.getIndex();
    return index.getStats();
  }

  /**
   * Clear the entire index (use with caution)
   */
  static clearIndex(): void {
    const index = this.getIndex();
    index.clear();
    logger.warn('Keyword search index cleared');
  }
}
