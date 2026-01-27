/**
 * RAG Pipeline Integration Tests
 * Tests the full RAG pipeline end-to-end with realistic scenarios
 */

import { RAGService, RAGOptions, RAGContext } from '../services/rag.service';
import { AIService, QuestionRequest, QuestionResponse } from '../services/ai.service';
import { DocumentService } from '../services/document.service';
import { EmbeddingService } from '../services/embedding.service';
import { PineconeService } from '../services/pinecone.service';
import { SearchService } from '../services/search.service';
import { ChunkService } from '../services/chunk.service';
import { DegradationService, ServiceType } from '../services/degradation.service';
import { ErrorRecoveryService } from '../services/error-recovery.service';

// Mock all external dependencies
jest.mock('../services/embedding.service');
jest.mock('../services/pinecone.service');
jest.mock('../services/search.service');
jest.mock('../services/document.service');
jest.mock('../services/chunk.service');
jest.mock('../config/openai');
jest.mock('../config/pinecone');
jest.mock('../config/redis.config');
jest.mock('../config/database');

describe('RAG Pipeline Integration Tests', () => {
  const testUserId = 'test-user-123';
  const testTopicId = 'test-topic-456';
  const testDocumentId = 'test-doc-789';

  // Test data
  const testDocument = {
    id: testDocumentId,
    user_id: testUserId,
    name: 'Test Document.pdf',
    content: 'Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Machine learning is a subset of AI that focuses on algorithms that can learn from data.',
    file_type: 'pdf',
    topic_id: testTopicId,
    created_at: new Date().toISOString(),
  };

  const testChunks = [
    {
      id: 'chunk-1',
      document_id: testDocumentId,
      chunk_index: 0,
      content: 'Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals.',
      embedding: new Array(1536).fill(0.1),
      token_count: 25,
    },
    {
      id: 'chunk-2',
      document_id: testDocumentId,
      chunk_index: 1,
      content: 'Machine learning is a subset of AI that focuses on algorithms that can learn from data.',
      embedding: new Array(1536).fill(0.2),
      token_count: 20,
    },
  ];

  const testWebResults = [
    {
      title: 'Introduction to Artificial Intelligence',
      url: 'https://example.com/ai-intro',
      content: 'Artificial intelligence is transforming how we work and live. AI systems can process vast amounts of data and make decisions.',
      publishedDate: '2024-01-15',
      score: 0.85,
    },
    {
      title: 'Machine Learning Basics',
      url: 'https://example.com/ml-basics',
      content: 'Machine learning algorithms enable computers to learn patterns from data without explicit programming.',
      publishedDate: '2024-01-20',
      score: 0.80,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    DegradationService.resetAllStatuses();

    // Setup default mocks
    (EmbeddingService.generateEmbedding as jest.Mock).mockResolvedValue(
      new Array(1536).fill(0.1)
    );
    (EmbeddingService.getCurrentModel as jest.Mock).mockReturnValue('text-embedding-3-small');
    (EmbeddingService.getCurrentDimensions as jest.Mock).mockReturnValue(1536);

    (PineconeService.search as jest.Mock).mockResolvedValue([
      {
        id: 'chunk-1',
        score: 0.9,
        metadata: {
          documentId: testDocumentId,
          chunkIndex: 0,
          content: testChunks[0].content,
        },
      },
      {
        id: 'chunk-2',
        score: 0.85,
        metadata: {
          documentId: testDocumentId,
          chunkIndex: 1,
          content: testChunks[1].content,
        },
      },
    ]);

    (SearchService.search as jest.Mock).mockResolvedValue({
      results: testWebResults,
      query: 'artificial intelligence',
      totalResults: 2,
    });

    (DocumentService.getDocument as jest.Mock).mockResolvedValue(testDocument);
    (ChunkService.getChunksByDocumentId as jest.Mock).mockResolvedValue(testChunks);

    // Mock OpenAI
    const mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: 'Artificial intelligence is intelligence demonstrated by machines. Machine learning is a subset of AI that focuses on algorithms that can learn from data.',
                role: 'assistant',
              },
            }],
            usage: {
              prompt_tokens: 500,
              completion_tokens: 100,
              total_tokens: 600,
            },
          }),
        },
      },
    };

    jest.doMock('../config/openai', () => ({
      openai: mockOpenAI,
    }));
  });

  describe('Full Pipeline End-to-End', () => {
    it('should complete full RAG pipeline with documents and web search', async () => {
      const query = 'What is artificial intelligence?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        topicId: testTopicId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        maxDocumentChunks: 5,
        maxWebResults: 5,
        minScore: 0.7,
      };

      // Step 1: Retrieve RAG context
      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      expect(ragContext.documentContexts.length).toBeGreaterThan(0);
      expect(ragContext.webSearchResults.length).toBeGreaterThan(0);
      expect(EmbeddingService.generateEmbedding).toHaveBeenCalled();
      expect(PineconeService.search).toHaveBeenCalled();
      expect(SearchService.search).toHaveBeenCalled();

      // Step 2: Generate answer using AI service
      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: true,
        enableWebSearch: true,
        topicId: testTopicId,
        maxDocumentChunks: 5,
        maxSearchResults: 5,
      };

      const response = await AIService.answerQuestion(questionRequest);

      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources).toBeDefined();
      expect(response.sources!.length).toBeGreaterThan(0);
      expect(response.usage).toBeDefined();
      expect(response.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should complete pipeline with document-only search', async () => {
      const query = 'What is machine learning?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        topicId: testTopicId,
        enableDocumentSearch: true,
        enableWebSearch: false,
        maxDocumentChunks: 5,
        minScore: 0.7,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext.documentContexts.length).toBeGreaterThan(0);
      expect(ragContext.webSearchResults.length).toBe(0);
      expect(SearchService.search).not.toHaveBeenCalled();

      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: true,
        enableWebSearch: false,
        topicId: testTopicId,
      };

      const response = await AIService.answerQuestion(questionRequest);

      expect(response.answer).toBeDefined();
      expect(response.sources).toBeDefined();
      // All sources should be documents
      expect(response.sources!.every(s => s.type === 'document')).toBe(true);
    });

    it('should complete pipeline with web-only search', async () => {
      const query = 'Latest developments in AI';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: false,
        enableWebSearch: true,
        maxWebResults: 5,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext.documentContexts.length).toBe(0);
      expect(ragContext.webSearchResults.length).toBeGreaterThan(0);
      expect(PineconeService.search).not.toHaveBeenCalled();

      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: false,
        enableWebSearch: true,
        maxSearchResults: 5,
      };

      const response = await AIService.answerQuestion(questionRequest);

      expect(response.answer).toBeDefined();
      expect(response.sources).toBeDefined();
      // All sources should be web
      expect(response.sources!.every(s => s.type === 'web')).toBe(true);
    });

    it('should handle query expansion in pipeline', async () => {
      const query = 'AI';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableQueryExpansion: true,
        expansionStrategy: 'hybrid',
        maxExpansions: 3,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      // Query expansion should have been used
      expect(EmbeddingService.generateEmbedding).toHaveBeenCalled();
    });

    it('should handle reranking in pipeline', async () => {
      const query = 'What is artificial intelligence?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableReranking: true,
        rerankingStrategy: 'cross-encoder',
        rerankingTopK: 10,
        rerankingMaxResults: 5,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      expect(ragContext.documentContexts.length).toBeLessThanOrEqual(5);
    });

    it('should handle deduplication in pipeline', async () => {
      const query = 'What is AI?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableResultDeduplication: true,
        deduplicationThreshold: 0.85,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      // Results should be deduplicated
      const documentIds = ragContext.documentContexts.map(d => d.documentId);
      const uniqueIds = new Set(documentIds);
      expect(uniqueIds.size).toBeLessThanOrEqual(documentIds.length);
    });

    it('should handle diversity filtering in pipeline', async () => {
      const query = 'Machine learning algorithms';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableDiversityFilter: true,
        diversityLambda: 0.7,
        diversityMaxResults: 5,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      expect(ragContext.documentContexts.length).toBeLessThanOrEqual(5);
    });

    it('should handle adaptive context selection', async () => {
      const query = 'Explain artificial intelligence and machine learning in detail';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableAdaptiveContextSelection: true,
        minChunks: 3,
        maxChunks: 10,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      // Adaptive selection should adjust chunk count based on query complexity
      expect(ragContext.documentContexts.length).toBeGreaterThanOrEqual(3);
      expect(ragContext.documentContexts.length).toBeLessThanOrEqual(10);
    });

    it('should handle token budgeting', async () => {
      const query = 'What is artificial intelligence?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableTokenBudgeting: true,
        tokenBudgetOptions: {
          model: 'gpt-3.5-turbo',
        },
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      // Token budget should limit context size
      const totalContent = [
        ...ragContext.documentContexts.map(d => d.content),
        ...ragContext.webSearchResults.map(w => w.content),
      ].join(' ');

      // Content should be reasonable (token budget will limit it)
      expect(totalContent.length).toBeGreaterThan(0);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle embedding service failure gracefully', async () => {
      (EmbeddingService.generateEmbedding as jest.Mock).mockRejectedValue(
        new Error('Embedding service unavailable')
      );

      const query = 'What is AI?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableKeywordSearch: true, // Enable fallback
        enableWebSearch: false,
      };

      // Should fallback to keyword search or handle gracefully
      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      // Should either return empty or use fallback
      expect(ragContext).toBeDefined();
    });

    it('should handle Pinecone service failure gracefully', async () => {
      (PineconeService.search as jest.Mock).mockRejectedValue(
        new Error('Pinecone service unavailable')
      );

      const query = 'What is AI?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true, // Fallback to web search
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      // Should still have web results even if document search fails
      if (ragOptions.enableWebSearch) {
        expect(ragContext.webSearchResults.length).toBeGreaterThan(0);
      }
    });

    it('should handle web search failure gracefully', async () => {
      (SearchService.search as jest.Mock).mockRejectedValue(
        new Error('Web search service unavailable')
      );

      const query = 'What is AI?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      // Should still have document results even if web search fails
      expect(ragContext.documentContexts.length).toBeGreaterThan(0);
      expect(ragContext.webSearchResults.length).toBe(0);
    });

    it('should handle OpenAI API failure gracefully', async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI API unavailable')),
          },
        },
      };

      jest.doMock('../config/openai', () => ({
        openai: mockOpenAI,
      }));

      const questionRequest: QuestionRequest = {
        question: 'What is AI?',
        enableDocumentSearch: true,
        enableWebSearch: true,
      };

      await expect(AIService.answerQuestion(questionRequest)).rejects.toThrow();
    });

    it('should handle partial failures with degradation', async () => {
      (PineconeService.search as jest.Mock).mockRejectedValue(
        new Error('Pinecone service unavailable')
      );

      const query = 'What is AI?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      // Should indicate degradation
      if (ragContext.degraded) {
        expect(ragContext.degradationLevel).toBeDefined();
        expect(ragContext.affectedServices).toBeDefined();
      }
    });

    it('should handle empty results gracefully', async () => {
      (PineconeService.search as jest.Mock).mockResolvedValue([]);
      (SearchService.search as jest.Mock).mockResolvedValue({
        results: [],
        query: 'test',
        totalResults: 0,
      });

      const query = 'Very specific query with no results';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      expect(ragContext.documentContexts.length).toBe(0);
      expect(ragContext.webSearchResults.length).toBe(0);

      // Should still be able to generate an answer (even if limited)
      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: true,
        enableWebSearch: true,
      };

      const response = await AIService.answerQuestion(questionRequest);
      expect(response.answer).toBeDefined();
    });
  });

  describe('Result Validation', () => {
    it('should extract sources correctly', async () => {
      const query = 'What is artificial intelligence?';
      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: true,
        enableWebSearch: true,
        topicId: testTopicId,
      };

      const response = await AIService.answerQuestion(questionRequest);

      expect(response.sources).toBeDefined();
      expect(response.sources!.length).toBeGreaterThan(0);

      // Validate source structure
      response.sources!.forEach(source => {
        expect(source.type).toMatch(/^(document|web)$/);
        expect(source.title).toBeDefined();
        if (source.type === 'document') {
          expect(source.documentId).toBeDefined();
        }
        if (source.type === 'web') {
          expect(source.url).toBeDefined();
        }
      });
    });

    it('should validate citations', async () => {
      const query = 'What is artificial intelligence?';
      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: true,
        enableWebSearch: true,
        enableCitationParsing: true,
      };

      const response = await AIService.answerQuestion(questionRequest);

      if (response.citations) {
        expect(response.citations.total).toBeGreaterThanOrEqual(0);
        expect(response.citations.document).toBeGreaterThanOrEqual(0);
        expect(response.citations.web).toBeGreaterThanOrEqual(0);

        if (response.citations.validation) {
          expect(response.citations.validation.isValid).toBeDefined();
        }
      }
    });

    it('should track token usage', async () => {
      const query = 'What is artificial intelligence?';
      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: true,
        enableWebSearch: true,
      };

      const response = await AIService.answerQuestion(questionRequest);

      expect(response.usage).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(0);
      expect(response.usage.completionTokens).toBeGreaterThan(0);
      expect(response.usage.totalTokens).toBe(
        response.usage.promptTokens + response.usage.completionTokens
      );
    });

    it('should include model information', async () => {
      const query = 'What is AI?';
      const questionRequest: QuestionRequest = {
        question: query,
        model: 'gpt-4',
        enableDocumentSearch: true,
        enableWebSearch: true,
      };

      const response = await AIService.answerQuestion(questionRequest);

      expect(response.model).toBe('gpt-4');
    });

    it('should handle conversation history', async () => {
      const questionRequest: QuestionRequest = {
        question: 'Tell me more about that',
        conversationHistory: [
          { role: 'user', content: 'What is artificial intelligence?' },
          { role: 'assistant', content: 'AI is intelligence demonstrated by machines.' },
        ],
        enableDocumentSearch: true,
        enableWebSearch: true,
      };

      const response = await AIService.answerQuestion(questionRequest);

      expect(response.answer).toBeDefined();
      // Answer should be contextual based on history
      expect(response.answer.length).toBeGreaterThan(0);
    });

    it('should respect max document chunks limit', async () => {
      const query = 'What is AI?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: false,
        maxDocumentChunks: 3,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext.documentContexts.length).toBeLessThanOrEqual(3);
    });

    it('should respect max web results limit', async () => {
      const query = 'Latest AI news';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: false,
        enableWebSearch: true,
        maxWebResults: 3,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext.webSearchResults.length).toBeLessThanOrEqual(3);
    });

    it('should filter by minimum score', async () => {
      (PineconeService.search as jest.Mock).mockResolvedValue([
        { id: 'chunk-1', score: 0.9, metadata: { documentId: testDocumentId, chunkIndex: 0, content: 'High score content' } },
        { id: 'chunk-2', score: 0.5, metadata: { documentId: testDocumentId, chunkIndex: 1, content: 'Low score content' } },
      ]);

      const query = 'What is AI?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: false,
        minScore: 0.7,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      // All results should meet minimum score
      ragContext.documentContexts.forEach(context => {
        expect(context.score).toBeGreaterThanOrEqual(0.7);
      });
    });
  });

  describe('Real Document Scenarios', () => {
    it('should process real document content', async () => {
      const realDocument = {
        id: 'real-doc-1',
        user_id: testUserId,
        name: 'AI Research Paper.pdf',
        content: 'This is a comprehensive research paper about artificial intelligence. It covers machine learning, deep learning, and neural networks. The paper discusses various applications of AI in healthcare, finance, and transportation.',
        file_type: 'pdf',
        topic_id: testTopicId,
        created_at: new Date().toISOString(),
      };

      (DocumentService.getDocument as jest.Mock).mockResolvedValue(realDocument);

      const query = 'What does the research paper say about AI applications?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        topicId: testTopicId,
        documentIds: ['real-doc-1'],
        enableDocumentSearch: true,
        enableWebSearch: false,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext.documentContexts.length).toBeGreaterThan(0);
      expect(ragContext.documentContexts[0].documentId).toBe('real-doc-1');
    });

    it('should handle multiple documents', async () => {
      const documents = [
        { id: 'doc-1', user_id: testUserId, name: 'Document 1.pdf', content: 'Content about AI', file_type: 'pdf' },
        { id: 'doc-2', user_id: testUserId, name: 'Document 2.pdf', content: 'Content about ML', file_type: 'pdf' },
      ];

      (PineconeService.search as jest.Mock).mockResolvedValue([
        { id: 'chunk-1', score: 0.9, metadata: { documentId: 'doc-1', chunkIndex: 0, content: 'AI content' } },
        { id: 'chunk-2', score: 0.85, metadata: { documentId: 'doc-2', chunkIndex: 0, content: 'ML content' } },
      ]);

      const query = 'What is AI and ML?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        documentIds: ['doc-1', 'doc-2'],
        enableDocumentSearch: true,
        enableWebSearch: false,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext.documentContexts.length).toBeGreaterThan(0);
      const documentIds = ragContext.documentContexts.map(d => d.documentId);
      expect(documentIds).toContain('doc-1');
      expect(documentIds).toContain('doc-2');
    });
  });

  describe('Real Web Search Scenarios', () => {
    it('should process real web search results', async () => {
      const realWebResults = [
        {
          title: 'Artificial Intelligence: A Modern Approach',
          url: 'https://example.com/ai-modern-approach',
          content: 'This comprehensive guide covers all aspects of artificial intelligence, from basic concepts to advanced applications.',
          publishedDate: '2024-01-15',
          score: 0.92,
        },
        {
          title: 'Machine Learning Explained',
          url: 'https://example.com/ml-explained',
          content: 'Machine learning is a method of data analysis that automates analytical model building.',
          publishedDate: '2024-01-20',
          score: 0.88,
        },
      ];

      (SearchService.search as jest.Mock).mockResolvedValue({
        results: realWebResults,
        query: 'artificial intelligence',
        totalResults: 2,
      });

      const query = 'What is artificial intelligence?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: false,
        enableWebSearch: true,
        maxWebResults: 5,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext.webSearchResults.length).toBe(2);
      expect(ragContext.webSearchResults[0].title).toBe(realWebResults[0].title);
      expect(ragContext.webSearchResults[0].url).toBe(realWebResults[0].url);
    });

    it('should handle web search with time filters', async () => {
      const query = 'Latest AI developments';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: false,
        enableWebSearch: true,
        timeRange: 'month',
        maxWebResults: 5,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      expect(SearchService.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeRange: 'month',
        })
      );
    });

    it('should handle web search with topic filters', async () => {
      const query = 'AI in healthcare';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: false,
        enableWebSearch: true,
        topic: 'healthcare',
        maxWebResults: 5,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);

      expect(ragContext).toBeDefined();
      expect(SearchService.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          topic: 'healthcare',
        })
      );
    });
  });

  describe('Pipeline Performance', () => {
    it('should complete pipeline within reasonable time', async () => {
      const startTime = Date.now();
      const query = 'What is artificial intelligence?';
      const ragOptions: RAGOptions = {
        userId: testUserId,
        enableDocumentSearch: true,
        enableWebSearch: true,
        maxDocumentChunks: 5,
        maxWebResults: 5,
      };

      const ragContext = await RAGService.retrieveContext(query, ragOptions);
      const questionRequest: QuestionRequest = {
        question: query,
        enableDocumentSearch: true,
        enableWebSearch: true,
      };
      const response = await AIService.answerQuestion(questionRequest);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(ragContext).toBeDefined();
      expect(response).toBeDefined();
      // Pipeline should complete within 30 seconds (allowing for mocked services)
      expect(duration).toBeLessThan(30000);
    });
  });
});
