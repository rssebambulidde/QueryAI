/**
 * BM25 Index Service
 * Implements Okapi BM25 algorithm for keyword-based document retrieval
 * 
 * BM25 is a ranking function used to estimate the relevance of documents
 * to a given search query. It's based on the probabilistic ranking framework.
 */

import logger from '../config/logger';

/**
 * BM25 parameters (standard values)
 */
const BM25_K1 = 1.2; // Term frequency saturation parameter
const BM25_B = 0.75; // Length normalization parameter

/**
 * Document in the index
 */
export interface IndexedDocument {
  id: string; // Document/chunk ID
  documentId: string; // Parent document ID
  content: string; // Document content
  userId: string; // User who owns the document
  topicId?: string; // Optional topic ID
  chunkIndex?: number; // Chunk index within document
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * BM25 Index for keyword search
 */
export class BM25Index {
  private documents: Map<string, IndexedDocument> = new Map();
  private termDocumentFrequency: Map<string, Set<string>> = new Map(); // term -> set of document IDs
  private documentTermFrequency: Map<string, Map<string, number>> = new Map(); // docId -> term -> frequency
  private documentLengths: Map<string, number> = new Map(); // docId -> length in words
  private averageDocumentLength: number = 0;
  private totalDocuments: number = 0;

  /**
   * Tokenize text into terms (words)
   */
  private tokenize(text: string): string[] {
    // Convert to lowercase and split by word boundaries
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(term => term.length > 0); // Remove empty strings
  }

  /**
   * Add document to index
   */
  addDocument(doc: IndexedDocument): void {
    const docId = doc.id;
    
    // Tokenize document content
    const terms = this.tokenize(doc.content);
    
    if (terms.length === 0) {
      logger.warn('Document has no terms after tokenization', { docId });
      return;
    }

    // Store document
    this.documents.set(docId, doc);
    
    // Calculate term frequencies for this document
    const termFreq = new Map<string, number>();
    for (const term of terms) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }
    this.documentTermFrequency.set(docId, termFreq);
    
    // Update document length
    this.documentLengths.set(docId, terms.length);
    
    // Update term-document frequency
    for (const term of termFreq.keys()) {
      if (!this.termDocumentFrequency.has(term)) {
        this.termDocumentFrequency.set(term, new Set());
      }
      this.termDocumentFrequency.get(term)!.add(docId);
    }
    
    // Update average document length
    // Calculate after adding this document
    this.totalDocuments++;
    const totalLength = Array.from(this.documentLengths.values()).reduce((sum, len) => sum + len, 0);
    this.averageDocumentLength = this.totalDocuments > 0 ? totalLength / this.totalDocuments : 0;
    
    // Ensure average document length is at least 1 to avoid division by zero in BM25 calculation
    if (this.averageDocumentLength === 0 && this.totalDocuments > 0) {
      this.averageDocumentLength = 1;
    }
  }

  /**
   * Add multiple documents to index
   */
  addDocuments(docs: IndexedDocument[]): void {
    for (const doc of docs) {
      this.addDocument(doc);
    }
    
    logger.info('Documents added to BM25 index', {
      count: docs.length,
      totalDocuments: this.totalDocuments,
    });
  }

  /**
   * Remove document from index
   */
  removeDocument(docId: string): void {
    const doc = this.documents.get(docId);
    if (!doc) {
      return;
    }

    // Remove from documents
    this.documents.delete(docId);
    
    // Remove term frequencies
    const termFreq = this.documentTermFrequency.get(docId);
    if (termFreq) {
      for (const term of termFreq.keys()) {
        const docSet = this.termDocumentFrequency.get(term);
        if (docSet) {
          docSet.delete(docId);
          if (docSet.size === 0) {
            this.termDocumentFrequency.delete(term);
          }
        }
      }
      this.documentTermFrequency.delete(docId);
    }
    
    // Remove document length
    const docLength = this.documentLengths.get(docId);
    this.documentLengths.delete(docId);
    
    // Update average document length
    this.totalDocuments--;
    if (this.totalDocuments > 0) {
      const totalLength = Array.from(this.documentLengths.values()).reduce((sum, len) => sum + len, 0);
      this.averageDocumentLength = totalLength / this.totalDocuments;
    } else {
      this.averageDocumentLength = 0;
    }
  }

  /**
   * Remove all documents for a document
   */
  removeDocumentChunks(documentId: string): void {
    const docIdsToRemove: string[] = [];
    
    for (const [docId, doc] of this.documents.entries()) {
      if (doc.documentId === documentId) {
        docIdsToRemove.push(docId);
      }
    }
    
    for (const docId of docIdsToRemove) {
      this.removeDocument(docId);
    }
    
    logger.info('Removed document chunks from BM25 index', {
      documentId,
      count: docIdsToRemove.length,
    });
  }

  /**
   * Calculate inverse document frequency (IDF) for a term
   */
  private calculateIDF(term: string): number {
    const docSet = this.termDocumentFrequency.get(term);
    if (!docSet || docSet.size === 0) {
      return 0;
    }
    
    const documentsContainingTerm = docSet.size;
    
    // Use a variant of IDF that ensures positive values
    // Standard: IDF = log((N - df + 0.5) / (df + 0.5))
    // Alternative (always positive): IDF = log(1 + (N - df) / df)
    // We use the standard formula but ensure minimum positive value for common terms
    if (documentsContainingTerm >= this.totalDocuments) {
      // Term appears in all documents - use small positive IDF
      return 0.1; // Small positive value to still contribute to score
    }
    
    const numerator = this.totalDocuments - documentsContainingTerm + 0.5;
    const denominator = documentsContainingTerm + 0.5;
    
    if (numerator <= 0 || denominator <= 0) {
      return 0.1; // Return small positive value
    }
    
    const ratio = numerator / denominator;
    if (ratio <= 0) {
      return 0.1;
    }
    
    const idf = Math.log(ratio);
    
    // Ensure non-negative IDF
    return Math.max(0.1, idf);
  }

  /**
   * Calculate BM25 score for a document given query terms
   */
  private calculateBM25Score(docId: string, queryTerms: string[]): number {
    const docLength = this.documentLengths.get(docId) || 0;
    if (docLength === 0) {
      return 0;
    }

    const termFreq = this.documentTermFrequency.get(docId);
    if (!termFreq) {
      return 0;
    }

    let score = 0;
    
    for (const term of queryTerms) {
      const termFrequency = termFreq.get(term) || 0;
      if (termFrequency === 0) {
        continue; // Term not in document
      }
      
      const idf = this.calculateIDF(term);
      // Allow negative IDF (terms appearing in many documents get lower weight)
      // But skip if IDF is exactly 0 (term not in any document)
      if (idf === 0) {
        continue;
      }
      
      // BM25 formula:
      // score = IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (|d| / avgdl)))
      // where:
      // - tf = term frequency in document
      // - |d| = document length
      // - avgdl = average document length
      // - k1 = term frequency saturation parameter (default: 1.2)
      // - b = length normalization parameter (default: 0.75)
      
      // Calculate length normalization
      // If average document length is 0, use document length itself
      const avgDocLength = this.averageDocumentLength > 0 ? this.averageDocumentLength : docLength;
      const lengthNormalization = 1 - BM25_B + BM25_B * (docLength / avgDocLength);
      const numerator = termFrequency * (BM25_K1 + 1);
      const denominator = termFrequency + BM25_K1 * lengthNormalization;
      
      // Calculate contribution (can be negative if IDF is negative)
      const contribution = idf * (numerator / denominator);
      score += contribution;
    }
    
    return score;
  }

  /**
   * Search documents using BM25 algorithm
   */
  search(
    query: string,
    options: {
      userId?: string;
      topicId?: string;
      documentIds?: string[];
      topK?: number;
      minScore?: number;
    } = {}
  ): Array<{ document: IndexedDocument; score: number }> {
    if (this.totalDocuments === 0) {
      return [];
    }

    // Tokenize query
    const queryTerms = this.tokenize(query);
    if (queryTerms.length === 0) {
      return [];
    }

    // Calculate scores for all documents
    const scores: Array<{ docId: string; score: number }> = [];
    
    for (const docId of this.documents.keys()) {
      const doc = this.documents.get(docId)!;
      
      // Apply filters
      if (options.userId && doc.userId !== options.userId) {
        continue;
      }
      
      // Filter by topicId: if provided, document must have matching topicId
      if (options.topicId !== undefined) {
        if (doc.topicId !== options.topicId) {
          continue;
        }
      }
      
      // Filter by documentIds: if provided, document must be in the list
      if (options.documentIds && options.documentIds.length > 0) {
        if (!options.documentIds.includes(doc.documentId)) {
          continue;
        }
      }
      
      // Calculate BM25 score
      const score = this.calculateBM25Score(docId, queryTerms);
      
      // Include documents with score > 0 (BM25 can produce very small positive scores)
      if (score > 0) {
        scores.push({ docId, score });
      }
    }

    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);

    // Apply minScore filter
    const minScore = options.minScore || 0;
    const filteredScores = scores.filter(s => s.score >= minScore);

    // Get top K results
    const topK = options.topK || 10;
    const topResults = filteredScores.slice(0, topK);

    // Return results with documents
    return topResults.map(({ docId, score }) => ({
      document: this.documents.get(docId)!,
      score,
    }));
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalDocuments: number;
    totalTerms: number;
    averageDocumentLength: number;
  } {
    return {
      totalDocuments: this.totalDocuments,
      totalTerms: this.termDocumentFrequency.size,
      averageDocumentLength: this.averageDocumentLength,
    };
  }

  /**
   * Clear the entire index
   */
  clear(): void {
    this.documents.clear();
    this.termDocumentFrequency.clear();
    this.documentTermFrequency.clear();
    this.documentLengths.clear();
    this.averageDocumentLength = 0;
    this.totalDocuments = 0;
    
    logger.info('BM25 index cleared');
  }
}

/**
 * Global BM25 index instance
 * In production, you might want to use a persistent store or multiple indexes per user
 */
let globalBM25Index: BM25Index | null = null;

/**
 * Get or create global BM25 index
 */
export function getBM25Index(): BM25Index {
  if (!globalBM25Index) {
    globalBM25Index = new BM25Index();
  }
  return globalBM25Index;
}

/**
 * Reset global BM25 index (useful for testing)
 */
export function resetBM25Index(): void {
  globalBM25Index = null;
}
