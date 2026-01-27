import { BM25Index, IndexedDocument, resetBM25Index } from '../services/bm25-index.service';

describe('BM25Index', () => {
  beforeEach(() => {
    resetBM25Index();
  });

  describe('addDocument', () => {
    it('should add document to index', () => {
      const index = new BM25Index();
      const doc: IndexedDocument = {
        id: 'doc1',
        documentId: 'document1',
        content: 'This is a test document with some content.',
        userId: 'user1',
      };

      index.addDocument(doc);
      const stats = index.getStats();
      expect(stats.totalDocuments).toBe(1);
    });

    it('should handle multiple documents', () => {
      const index = new BM25Index();
      const docs: IndexedDocument[] = [
        {
          id: 'doc1',
          documentId: 'document1',
          content: 'First document about cats and dogs.',
          userId: 'user1',
        },
        {
          id: 'doc2',
          documentId: 'document2',
          content: 'Second document about dogs and birds.',
          userId: 'user1',
        },
      ];

      index.addDocuments(docs);
      const stats = index.getStats();
      expect(stats.totalDocuments).toBe(2);
    });

    it('should handle empty content', () => {
      const index = new BM25Index();
      const doc: IndexedDocument = {
        id: 'doc1',
        documentId: 'document1',
        content: '',
        userId: 'user1',
      };

      index.addDocument(doc);
      const stats = index.getStats();
      expect(stats.totalDocuments).toBe(0); // Empty documents are not indexed
    });
  });

  describe('search', () => {
    it('should return relevant documents', () => {
      const index = new BM25Index();
      index.addDocuments([
        {
          id: 'doc1',
          documentId: 'document1',
          content: 'The quick brown fox jumps over the lazy dog.',
          userId: 'user1',
        },
        {
          id: 'doc2',
          documentId: 'document2',
          content: 'A dog is a loyal companion to humans.',
          userId: 'user1',
        },
        {
          id: 'doc3',
          documentId: 'document3',
          content: 'Cats are independent animals.',
          userId: 'user1',
        },
      ]);

      const results = index.search('dog', { userId: 'user1' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      // Documents about dogs should rank higher
      expect(results.some(r => r.document.id === 'doc1' || r.document.id === 'doc2')).toBe(true);
    });

    it('should filter by userId', () => {
      const index = new BM25Index();
      index.addDocuments([
        {
          id: 'doc1',
          documentId: 'document1',
          content: 'User 1 document about dogs.',
          userId: 'user1',
        },
        {
          id: 'doc2',
          documentId: 'document2',
          content: 'User 2 document about dogs.',
          userId: 'user2',
        },
      ]);

      const results = index.search('dogs', { userId: 'user1' });
      
      expect(results.length).toBe(1);
      expect(results[0].document.userId).toBe('user1');
    });

    it('should filter by topicId', () => {
      const index = new BM25Index();
      index.addDocuments([
        {
          id: 'doc1',
          documentId: 'document1',
          content: 'Topic 1 document about cats and dogs.',
          userId: 'user1',
          topicId: 'topic1',
        },
        {
          id: 'doc2',
          documentId: 'document2',
          content: 'Topic 2 document about cats and birds.',
          userId: 'user1',
          topicId: 'topic2',
        },
      ]);

      const results = index.search('cats', { userId: 'user1', topicId: 'topic1' });
      
      // Should find the document with topic1 that contains 'cats'
      expect(results.length).toBeGreaterThanOrEqual(1);
      if (results.length > 0) {
        expect(results[0].document.topicId).toBe('topic1');
        expect(results[0].score).toBeGreaterThan(0);
      }
    });

    it('should filter by documentIds', () => {
      const index = new BM25Index();
      index.addDocuments([
        {
          id: 'chunk1',
          documentId: 'document1',
          content: 'First document about birds and animals.',
          userId: 'user1',
        },
        {
          id: 'chunk2',
          documentId: 'document2',
          content: 'Second document about birds and nature.',
          userId: 'user1',
        },
      ]);

      const results = index.search('birds', {
        userId: 'user1',
        documentIds: ['document1'],
      });
      
      // Should find chunks from document1 that contain 'birds'
      expect(results.length).toBeGreaterThanOrEqual(1);
      if (results.length > 0) {
        expect(results[0].document.documentId).toBe('document1');
        expect(results[0].score).toBeGreaterThan(0);
      }
    });

    it('should respect topK limit', () => {
      const index = new BM25Index();
      index.addDocuments([
        {
          id: 'doc1',
          documentId: 'document1',
          content: 'Document about dogs.',
          userId: 'user1',
        },
        {
          id: 'doc2',
          documentId: 'document2',
          content: 'Another document about dogs.',
          userId: 'user1',
        },
        {
          id: 'doc3',
          documentId: 'document3',
          content: 'Third document about dogs.',
          userId: 'user1',
        },
      ]);

      const results = index.search('dogs', { userId: 'user1', topK: 2 });
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should respect minScore', () => {
      const index = new BM25Index();
      index.addDocuments([
        {
          id: 'doc1',
          documentId: 'document1',
          content: 'Document about dogs.',
          userId: 'user1',
        },
        {
          id: 'doc2',
          documentId: 'document2',
          content: 'Document about cats.',
          userId: 'user1',
        },
      ]);

      const results = index.search('dogs', {
        userId: 'user1',
        minScore: 10, // Very high threshold
      });
      
      // Should filter out low-scoring results
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(10);
      });
    });

    it('should return empty array for empty query', () => {
      const index = new BM25Index();
      index.addDocument({
        id: 'doc1',
        documentId: 'document1',
        content: 'Test content.',
        userId: 'user1',
      });

      const results = index.search('', { userId: 'user1' });
      expect(results).toEqual([]);
    });

    it('should return empty array for no matching documents', () => {
      const index = new BM25Index();
      index.addDocument({
        id: 'doc1',
        documentId: 'document1',
        content: 'Document about cats.',
        userId: 'user1',
      });

      const results = index.search('elephants', { userId: 'user1' });
      expect(results.length).toBe(0);
    });
  });

  describe('removeDocument', () => {
    it('should remove document from index', () => {
      const index = new BM25Index();
      const doc: IndexedDocument = {
        id: 'doc1',
        documentId: 'document1',
        content: 'Test document.',
        userId: 'user1',
      };

      index.addDocument(doc);
      expect(index.getStats().totalDocuments).toBe(1);

      index.removeDocument('doc1');
      expect(index.getStats().totalDocuments).toBe(0);
    });

    it('should remove all chunks for a document', () => {
      const index = new BM25Index();
      index.addDocuments([
        {
          id: 'chunk1',
          documentId: 'document1',
          content: 'First chunk.',
          userId: 'user1',
        },
        {
          id: 'chunk2',
          documentId: 'document1',
          content: 'Second chunk.',
          userId: 'user1',
        },
        {
          id: 'chunk3',
          documentId: 'document2',
          content: 'Other document chunk.',
          userId: 'user1',
        },
      ]);

      expect(index.getStats().totalDocuments).toBe(3);

      index.removeDocumentChunks('document1');
      expect(index.getStats().totalDocuments).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return index statistics', () => {
      const index = new BM25Index();
      index.addDocuments([
        {
          id: 'doc1',
          documentId: 'document1',
          content: 'First document with multiple words.',
          userId: 'user1',
        },
        {
          id: 'doc2',
          documentId: 'document2',
          content: 'Second document with different words.',
          userId: 'user1',
        },
      ]);

      const stats = index.getStats();
      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalTerms).toBeGreaterThan(0);
      expect(stats.averageDocumentLength).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear entire index', () => {
      const index = new BM25Index();
      index.addDocument({
        id: 'doc1',
        documentId: 'document1',
        content: 'Test document.',
        userId: 'user1',
      });

      index.clear();
      const stats = index.getStats();
      expect(stats.totalDocuments).toBe(0);
      expect(stats.totalTerms).toBe(0);
    });
  });
});
