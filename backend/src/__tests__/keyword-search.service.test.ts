import { KeywordSearchService } from '../services/keyword-search.service';
import { ChunkService } from '../services/chunk.service';
import { DocumentService } from '../services/document.service';

// Mock dependencies
jest.mock('../services/chunk.service');
jest.mock('../services/document.service');

describe('KeywordSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('indexDocument', () => {
    it('should index document chunks', async () => {
      const mockChunks = [
        {
          id: 'chunk1',
          document_id: 'doc1',
          chunk_index: 0,
          content: 'First chunk content.',
          start_char: 0,
          end_char: 20,
          token_count: 5,
        },
        {
          id: 'chunk2',
          document_id: 'doc1',
          chunk_index: 1,
          content: 'Second chunk content.',
          start_char: 21,
          end_char: 45,
          token_count: 5,
        },
      ];

      const mockDocument = {
        id: 'doc1',
        user_id: 'user1',
        topic_id: 'topic1',
        filename: 'test.pdf',
      };

      (ChunkService.getChunksByDocument as jest.Mock).mockResolvedValue(mockChunks);
      (DocumentService.getDocument as jest.Mock).mockResolvedValue(mockDocument);

      await KeywordSearchService.indexDocument('doc1', 'user1', 'topic1');

      // Verify chunks were fetched
      expect(ChunkService.getChunksByDocument).toHaveBeenCalledWith('doc1', 'user1');
      
      // Verify document was fetched
      expect(DocumentService.getDocument).toHaveBeenCalledWith('doc1', 'user1');
    });

    it('should handle missing chunks gracefully', async () => {
      (ChunkService.getChunksByDocument as jest.Mock).mockResolvedValue([]);

      await KeywordSearchService.indexDocument('doc1', 'user1');

      // Should not throw error
      expect(ChunkService.getChunksByDocument).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should perform keyword search', async () => {
      // First, index some documents
      const mockChunks = [
        {
          id: 'chunk1',
          document_id: 'doc1',
          chunk_index: 0,
          content: 'Document about artificial intelligence and machine learning.',
          start_char: 0,
          end_char: 60,
          token_count: 10,
        },
      ];

      const mockDocument = {
        id: 'doc1',
        user_id: 'user1',
        filename: 'ai-doc.pdf',
      };

      (ChunkService.getChunksByDocument as jest.Mock).mockResolvedValue(mockChunks);
      (DocumentService.getDocument as jest.Mock).mockResolvedValue(mockDocument);

      // Index the document
      await KeywordSearchService.indexDocument('doc1', 'user1');

      // Perform search
      const results = await KeywordSearchService.search('artificial intelligence', {
        userId: 'user1',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('artificial intelligence');
    });

    it('should filter by userId', async () => {
      const mockChunks = [
        {
          id: 'chunk1',
          document_id: 'doc1',
          chunk_index: 0,
          content: 'User 1 document.',
          start_char: 0,
          end_char: 20,
          token_count: 3,
        },
      ];

      const mockDocument = {
        id: 'doc1',
        user_id: 'user1',
        filename: 'doc1.pdf',
      };

      (ChunkService.getChunksByDocument as jest.Mock).mockResolvedValue(mockChunks);
      (DocumentService.getDocument as jest.Mock).mockResolvedValue(mockDocument);

      await KeywordSearchService.indexDocument('doc1', 'user1');

      const results = await KeywordSearchService.search('document', {
        userId: 'user1',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.documentId === 'doc1')).toBe(true);
    });

    it('should respect topK limit', async () => {
      const mockChunks = Array.from({ length: 10 }, (_, i) => ({
        id: `chunk${i}`,
        document_id: 'doc1',
        chunk_index: i,
        content: `Chunk ${i} about dogs.`,
        start_char: i * 20,
        end_char: (i + 1) * 20,
        token_count: 5,
      }));

      const mockDocument = {
        id: 'doc1',
        user_id: 'user1',
        filename: 'doc1.pdf',
      };

      (ChunkService.getChunksByDocument as jest.Mock).mockResolvedValue(mockChunks);
      (DocumentService.getDocument as jest.Mock).mockResolvedValue(mockDocument);

      await KeywordSearchService.indexDocument('doc1', 'user1');

      const results = await KeywordSearchService.search('dogs', {
        userId: 'user1',
        topK: 5,
      });

      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getIndexStats', () => {
    it('should return index statistics', () => {
      const stats = KeywordSearchService.getIndexStats();
      
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('totalTerms');
      expect(stats).toHaveProperty('averageDocumentLength');
    });
  });

  describe('removeDocumentFromIndex', () => {
    it('should remove document from index', async () => {
      const mockChunks = [
        {
          id: 'chunk1',
          document_id: 'doc1',
          chunk_index: 0,
          content: 'Test content.',
          start_char: 0,
          end_char: 15,
          token_count: 3,
        },
      ];

      const mockDocument = {
        id: 'doc1',
        user_id: 'user1',
        filename: 'doc1.pdf',
      };

      (ChunkService.getChunksByDocument as jest.Mock).mockResolvedValue(mockChunks);
      (DocumentService.getDocument as jest.Mock).mockResolvedValue(mockDocument);

      await KeywordSearchService.indexDocument('doc1', 'user1');
      
      let stats = KeywordSearchService.getIndexStats();
      expect(stats.totalDocuments).toBeGreaterThan(0);

      await KeywordSearchService.removeDocumentFromIndex('doc1');
      
      stats = KeywordSearchService.getIndexStats();
      expect(stats.totalDocuments).toBe(0);
    });
  });
});
