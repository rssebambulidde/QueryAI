/**
 * Keyword Search Service
 * Provides keyword-based search using BM25 algorithm
 * Integrates with document storage and indexing
 */

import { BM25Index, IndexedDocument, getBM25Index, setGlobalBM25Index } from './bm25-index.service';
import type { BM25SerializedIndex } from './bm25-index.service';
import { RedisCacheService } from './redis-cache.service';
import { ChunkService } from './chunk.service';
import { DocumentService } from './document.service';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { RetrievalConfig } from '../config/thresholds.config';
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
  ancestorTopicIds?: string[];
  documentIds?: string[];
  topK?: number;
  minScore?: number;
}

/**
 * Keyword Search Service
 * Handles keyword-based document retrieval using BM25
 */
export class KeywordSearchService {

  // ── Redis persistence constants ────────────────────────────────────────
  private static readonly BM25_CACHE_KEY = 'bm25:index:global';
  private static readonly BM25_CACHE_PREFIX = 'bm25';
  private static readonly BM25_TTL = 86_400; // 24 hours
  /** Guard so we only attempt one Redis restore per process lifetime. */
  private static redisRestoreAttempted = false;

  /**
   * Get BM25 index (delegates to global singleton so resetBM25Index() works in tests)
   */
  private static getIndex(): BM25Index {
    return getBM25Index();
  }

  // ── Redis persistence helpers ──────────────────────────────────────────

  /**
   * Persist current in-memory BM25 index to Redis.
   * Fire-and-forget — never throws.
   */
  static async persistToRedis(): Promise<void> {
    try {
      const index = this.getIndex();
      const stats = index.getStats();
      if (stats.totalDocuments === 0) return; // nothing worth caching

      const serialized = index.toJSON();
      const json = JSON.stringify(serialized);

      const stored = await RedisCacheService.set(
        this.BM25_CACHE_KEY,
        serialized,
        { prefix: this.BM25_CACHE_PREFIX, ttl: this.BM25_TTL },
      );

      if (stored) {
        logger.info('BM25 index persisted to Redis', {
          totalDocuments: stats.totalDocuments,
          totalTerms: stats.totalTerms,
          sizeBytes: json.length,
        });
      }
    } catch (err: any) {
      logger.warn('Failed to persist BM25 index to Redis', { error: err.message });
    }
  }

  /**
   * Attempt to restore the BM25 index from Redis.
   * Returns `true` if a cached index was loaded, `false` otherwise.
   * Only runs once per process (idempotent guard).
   */
  static async restoreFromRedis(): Promise<boolean> {
    if (this.redisRestoreAttempted) return false;
    this.redisRestoreAttempted = true;

    try {
      const data = await RedisCacheService.get<BM25SerializedIndex>(
        this.BM25_CACHE_KEY,
        { prefix: this.BM25_CACHE_PREFIX },
      );

      if (!data || typeof data !== 'object' || data.v !== 1) {
        logger.debug('No cached BM25 index found in Redis');
        return false;
      }

      const index = new BM25Index();
      index.fromJSON(data);
      setGlobalBM25Index(index);

      const stats = index.getStats();
      logger.info('BM25 index restored from Redis', {
        totalDocuments: stats.totalDocuments,
        totalTerms: stats.totalTerms,
      });
      return true;
    } catch (err: any) {
      logger.warn('Failed to restore BM25 index from Redis', { error: err.message });
      return false;
    }
  }

  /**
   * Invalidate the cached BM25 index in Redis.
   * Called when documents are added/removed so stale data isn't served.
   */
  static async invalidateRedisCache(): Promise<void> {
    try {
      await RedisCacheService.delete(this.BM25_CACHE_KEY, { prefix: this.BM25_CACHE_PREFIX });
      logger.debug('BM25 Redis cache invalidated');
    } catch (err: any) {
      logger.warn('Failed to invalidate BM25 Redis cache', { error: err.message });
    }
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

      // Persist updated index to Redis (fire-and-forget)
      this.persistToRedis().catch(() => {});
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

    // Persist updated index to Redis (fire-and-forget)
    this.persistToRedis().catch(() => {});
  }

  /**
   * Search documents using keyword search
   */
  static async search(
    query: string,
    options: KeywordSearchOptions
  ): Promise<KeywordSearchResult[]> {
    try {
      // On first search, attempt to restore index from Redis
      if (this.getIndex().getStats().totalDocuments === 0) {
        await this.restoreFromRedis();
      }

      const index = this.getIndex();
      
      // Perform BM25 search
      const results = index.search(query, {
        userId: options.userId,
        topicId: options.topicId,
        ancestorTopicIds: options.ancestorTopicIds,
        documentIds: options.documentIds,
        topK: options.topK || RetrievalConfig.defaults.topK,
        minScore: options.minScore ?? 0,
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
