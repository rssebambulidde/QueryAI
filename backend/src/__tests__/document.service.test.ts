import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DocumentService, CreateDocumentInput, UpdateDocumentInput } from '../services/document.service';
import { AppError, ValidationError } from '../types/error';

// Mock Supabase
jest.mock('../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            desc: jest.fn(),
            limit: jest.fn(),
          })),
        })),
        order: jest.fn(() => ({
          desc: jest.fn(),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(),
          })),
        })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(),
      })),
    })),
  },
}));

import { supabaseAdmin } from '../config/database';

describe('DocumentService', () => {
  const mockUserId = 'user-123';
  const mockDocumentId = 'doc-456';
  const mockTopicId = 'topic-789';

  const mockDocument = {
    id: mockDocumentId,
    user_id: mockUserId,
    topic_id: mockTopicId,
    filename: 'test.pdf',
    file_path: '/path/to/test.pdf',
    file_type: 'pdf',
    file_size: 1024,
    status: 'stored',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDocument', () => {
    it('should create a new document', async () => {
      const input: CreateDocumentInput = {
        user_id: mockUserId,
        filename: 'test.pdf',
        file_path: '/path/to/test.pdf',
        file_type: 'pdf',
        file_size: 1024,
      };

      (supabaseAdmin.from as any).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          })),
        })),
      });

      const document = await DocumentService.createDocument(input);

      expect(document).toBeDefined();
      expect(document.id).toBe(mockDocumentId);
      expect(document.filename).toBe('test.pdf');
    });

    it('should create document with topic_id', async () => {
      const input: CreateDocumentInput = {
        user_id: mockUserId,
        topic_id: mockTopicId,
        filename: 'test.pdf',
        file_path: '/path/to/test.pdf',
        file_type: 'pdf',
        file_size: 1024,
      };

      (supabaseAdmin.from as any).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { ...mockDocument, topic_id: mockTopicId },
              error: null,
            }),
          })),
        })),
      });

      const document = await DocumentService.createDocument(input);

      expect(document.topic_id).toBe(mockTopicId);
    });

    it('should handle database errors', async () => {
      const input: CreateDocumentInput = {
        user_id: mockUserId,
        filename: 'test.pdf',
        file_path: '/path/to/test.pdf',
        file_type: 'pdf',
        file_size: 1024,
      };

      (supabaseAdmin.from as any).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          })),
        })),
      });

      await expect(DocumentService.createDocument(input)).rejects.toThrow(AppError);
    });
  });

  describe('getDocument', () => {
    it('should get document by ID', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          })),
        })),
      });

      const document = await DocumentService.getDocument(mockDocumentId, mockUserId);

      expect(document).toBeDefined();
      expect(document?.id).toBe(mockDocumentId);
    });

    it('should return null if document not found', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          })),
        })),
      });

      const document = await DocumentService.getDocument('non-existent', mockUserId);

      expect(document).toBeNull();
    });
  });

  describe('updateDocument', () => {
    it('should update document', async () => {
      const updates: UpdateDocumentInput = {
        status: 'processed',
        extracted_text: 'Extracted text content',
      };

      (supabaseAdmin.from as any)
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockDocument,
                error: null,
              }),
            })),
          })),
        })
        .mockReturnValueOnce({
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockDocument, ...updates },
                  error: null,
                }),
              })),
            })),
          })),
        });

      const document = await DocumentService.updateDocument(
        mockDocumentId,
        mockUserId,
        updates
      );

      expect(document).toBeDefined();
      expect(document.status).toBe('processed');
    });

    it('should throw ValidationError if document not found', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          })),
        })),
      });

      await expect(
        DocumentService.updateDocument(mockDocumentId, mockUserId, { status: 'processed' })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getDocumentsBatch', () => {
    it('should get multiple documents by IDs', async () => {
      const documentIds = ['doc-1', 'doc-2', 'doc-3'];
      const mockDocuments = documentIds.map((id) => ({
        ...mockDocument,
        id,
      }));

      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          in: jest.fn().mockResolvedValue({
            data: mockDocuments,
            error: null,
          }),
        })),
      });

      const documents = await DocumentService.getDocumentsBatch(documentIds, mockUserId);

      expect(documents).toBeInstanceOf(Map);
      expect(documents.size).toBe(documentIds.length);
      documentIds.forEach((id) => {
        expect(documents.has(id)).toBe(true);
      });
    });

    it('should handle empty document IDs array', async () => {
      const documents = await DocumentService.getDocumentsBatch([], mockUserId);

      expect(documents).toBeInstanceOf(Map);
      expect(documents.size).toBe(0);
    });
  });

  describe('getUserDocuments', () => {
    it('should get all documents for user', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              desc: jest.fn().mockResolvedValue({
                data: [mockDocument],
                error: null,
              }),
            })),
          })),
        })),
      });

      const documents = await DocumentService.getUserDocuments(mockUserId);

      expect(documents).toBeDefined();
      expect(Array.isArray(documents)).toBe(true);
    });

    it('should filter by topic_id when provided', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                desc: jest.fn().mockResolvedValue({
                  data: [mockDocument],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });

      const documents = await DocumentService.getUserDocuments(mockUserId, mockTopicId);

      expect(documents).toBeDefined();
    });
  });

  describe('deleteDocument', () => {
    it('should delete document', async () => {
      (supabaseAdmin.from as any)
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockDocument,
                error: null,
              }),
            })),
          })),
        })
        .mockReturnValueOnce({
          delete: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          })),
        });

      await DocumentService.deleteDocument(mockDocumentId, mockUserId);

      expect(supabaseAdmin.from).toHaveBeenCalled();
    });

    it('should throw ValidationError if document not found', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          })),
        })),
      });

      await expect(
        DocumentService.deleteDocument('non-existent', mockUserId)
      ).rejects.toThrow(ValidationError);
    });
  });
});
