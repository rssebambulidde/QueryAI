import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ConversationService,
  CreateConversationInput,
  UpdateConversationInput,
} from '../services/conversation.service';
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
          })),
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

// Mock ConversationStateService
jest.mock('../services/conversation-state.service', () => ({
  ConversationStateService: {
    getState: jest.fn(),
    updateState: jest.fn(),
  },
}));

import { supabaseAdmin } from '../config/database';
import { ConversationStateService } from '../services/conversation-state.service';

describe('ConversationService', () => {
  const mockUserId = 'user-123';
  const mockConversationId = 'conv-456';
  const mockTopicId = 'topic-789';

  const mockConversation = {
    id: mockConversationId,
    user_id: mockUserId,
    topic_id: mockTopicId,
    title: 'Test Conversation',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ConversationStateService.getState as any).mockResolvedValue(null);
    (ConversationStateService.updateState as any).mockResolvedValue(undefined);
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const input: CreateConversationInput = {
        userId: mockUserId,
        title: 'New Conversation',
      };

      (supabaseAdmin.from as any).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockConversation,
              error: null,
            }),
          })),
        })),
      });

      const conversation = await ConversationService.createConversation(input);

      expect(conversation).toBeDefined();
      expect(conversation.id).toBe(mockConversationId);
      expect(conversation.title).toBe('Test Conversation');
    });

    it('should create conversation with default title if not provided', async () => {
      const input: CreateConversationInput = {
        userId: mockUserId,
      };

      (supabaseAdmin.from as any).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { ...mockConversation, title: 'New Conversation' },
              error: null,
            }),
          })),
        })),
      });

      const conversation = await ConversationService.createConversation(input);

      expect(conversation).toBeDefined();
    });

    it('should create conversation with topic_id', async () => {
      const input: CreateConversationInput = {
        userId: mockUserId,
        topicId: mockTopicId,
      };

      (supabaseAdmin.from as any).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { ...mockConversation, topic_id: mockTopicId },
              error: null,
            }),
          })),
        })),
      });

      const conversation = await ConversationService.createConversation(input);

      expect(conversation.topic_id).toBe(mockTopicId);
    });

    it('should throw ValidationError if userId is missing', async () => {
      const input: CreateConversationInput = {
        userId: '',
      };

      await expect(ConversationService.createConversation(input)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle database errors', async () => {
      const input: CreateConversationInput = {
        userId: mockUserId,
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

      await expect(ConversationService.createConversation(input)).rejects.toThrow(AppError);
    });
  });

  describe('getConversation', () => {
    it('should get conversation by ID', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockConversation,
              error: null,
            }),
          })),
        })),
      });

      const conversation = await ConversationService.getConversation(
        mockConversationId,
        mockUserId
      );

      expect(conversation).toBeDefined();
      expect(conversation?.id).toBe(mockConversationId);
    });

    it('should return null if conversation not found', async () => {
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

      const conversation = await ConversationService.getConversation(
        'non-existent',
        mockUserId
      );

      expect(conversation).toBeNull();
    });
  });

  describe('getUserConversations', () => {
    it('should get all conversations for user', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              desc: jest.fn().mockResolvedValue({
                data: [mockConversation],
                error: null,
              }),
            })),
          })),
        })),
      });

      const conversations = await ConversationService.getUserConversations(mockUserId);

      expect(conversations).toBeDefined();
      expect(Array.isArray(conversations)).toBe(true);
    });

    it('should filter by topic_id when provided', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                desc: jest.fn().mockResolvedValue({
                  data: [mockConversation],
                  error: null,
                }),
              })),
            })),
          })),
        })),
      });

      const conversations = await ConversationService.getUserConversations(
        mockUserId,
        mockTopicId
      );

      expect(conversations).toBeDefined();
    });
  });

  describe('updateConversation', () => {
    it('should update conversation', async () => {
      const updates: UpdateConversationInput = {
        title: 'Updated Title',
      };

      (supabaseAdmin.from as any)
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockConversation,
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
                  data: { ...mockConversation, ...updates },
                  error: null,
                }),
              })),
            })),
          })),
        });

      const conversation = await ConversationService.updateConversation(
        mockConversationId,
        mockUserId,
        updates
      );

      expect(conversation).toBeDefined();
      expect(conversation.title).toBe('Updated Title');
    });

    it('should throw ValidationError if conversation not found', async () => {
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
        ConversationService.updateConversation(mockConversationId, mockUserId, {
          title: 'New Title',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation', async () => {
      (supabaseAdmin.from as any)
        .mockReturnValueOnce({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockConversation,
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

      await ConversationService.deleteConversation(mockConversationId, mockUserId);

      expect(supabaseAdmin.from).toHaveBeenCalled();
    });

    it('should throw ValidationError if conversation not found', async () => {
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
        ConversationService.deleteConversation('non-existent', mockUserId)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('generateTitleFromMessage', () => {
    it('should generate title from message', () => {
      const message = 'What is artificial intelligence?';
      const title = ConversationService.generateTitleFromMessage(message);

      expect(title).toBeDefined();
      expect(typeof title).toBe('string');
      expect(title.length).toBeGreaterThan(0);
    });

    it('should truncate long messages', () => {
      const longMessage = 'a '.repeat(100);
      const title = ConversationService.generateTitleFromMessage(longMessage);

      expect(title.length).toBeLessThanOrEqual(100);
    });

    it('should handle empty message', () => {
      const title = ConversationService.generateTitleFromMessage('');

      expect(title).toBeDefined();
    });
  });

  describe('updateConversationTimestamp', () => {
    it('should update conversation timestamp', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })),
      });

      await ConversationService.updateConversationTimestamp(mockConversationId);

      expect(supabaseAdmin.from).toHaveBeenCalled();
    });
  });
});
