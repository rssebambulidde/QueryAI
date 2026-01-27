import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MessageService, CreateMessageInput } from '../services/message.service';
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
          order: jest.fn(() => ({
            asc: jest.fn(),
          })),
        })),
      })),
    })),
  },
}));

// Mock ConversationService
jest.mock('../services/conversation.service', () => ({
  ConversationService: {
    updateConversationTimestamp: jest.fn(),
  },
}));

// Mock ConversationSummarizerService
jest.mock('../services/conversation-summarizer.service', () => ({
  ConversationSummarizerService: {
    summarizeConversation: jest.fn(),
  },
}));

// Mock SlidingWindowService
jest.mock('../services/sliding-window.service', () => ({
  SlidingWindowService: {
    getSlidingWindow: jest.fn(),
  },
}));

import { supabaseAdmin } from '../config/database';
import { ConversationService } from '../services/conversation.service';
import { ConversationSummarizerService } from '../services/conversation-summarizer.service';
import { SlidingWindowService } from '../services/sliding-window.service';

describe('MessageService', () => {
  const mockConversationId = 'conv-123';
  const mockMessageId = 'msg-456';

  const mockMessage = {
    id: mockMessageId,
    conversation_id: mockConversationId,
    role: 'user',
    content: 'What is AI?',
    sources: null,
    metadata: null,
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ConversationService.updateConversationTimestamp as any).mockResolvedValue(undefined);
    (ConversationSummarizerService.summarizeConversation as any).mockResolvedValue({
      summary: 'Conversation summary',
    });
    (SlidingWindowService.getSlidingWindow as any).mockImplementation((messages) => messages);
  });

  describe('saveMessage', () => {
    it('should save a message', async () => {
      const input: CreateMessageInput = {
        conversationId: mockConversationId,
        role: 'user',
        content: 'What is AI?',
      };

      (supabaseAdmin.from as any).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: mockMessage,
              error: null,
            }),
          })),
        })),
      });

      const message = await MessageService.saveMessage(input);

      expect(message).toBeDefined();
      expect(message.id).toBe(mockMessageId);
      expect(message.content).toBe('What is AI?');
      expect(ConversationService.updateConversationTimestamp).toHaveBeenCalled();
    });

    it('should save message with sources', async () => {
      const input: CreateMessageInput = {
        conversationId: mockConversationId,
        role: 'assistant',
        content: 'AI is...',
        sources: [
          {
            type: 'web',
            title: 'AI Wikipedia',
            url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
          },
        ],
      };

      (supabaseAdmin.from as any).mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { ...mockMessage, sources: input.sources },
              error: null,
            }),
          })),
        })),
      });

      const message = await MessageService.saveMessage(input);

      expect(message).toBeDefined();
    });

    it('should throw ValidationError if conversationId is missing', async () => {
      const input: CreateMessageInput = {
        conversationId: '',
        role: 'user',
        content: 'Test',
      };

      await expect(MessageService.saveMessage(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if role is invalid', async () => {
      const input: CreateMessageInput = {
        conversationId: mockConversationId,
        role: 'invalid' as any,
        content: 'Test',
      };

      await expect(MessageService.saveMessage(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if content is empty', async () => {
      const input: CreateMessageInput = {
        conversationId: mockConversationId,
        role: 'user',
        content: '   ',
      };

      await expect(MessageService.saveMessage(input)).rejects.toThrow(ValidationError);
    });

    it('should handle database errors', async () => {
      const input: CreateMessageInput = {
        conversationId: mockConversationId,
        role: 'user',
        content: 'Test',
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

      await expect(MessageService.saveMessage(input)).rejects.toThrow(AppError);
    });
  });

  describe('saveMessagePair', () => {
    it('should save user and assistant messages atomically', async () => {
      (supabaseAdmin.from as any)
        .mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { ...mockMessage, role: 'user' },
                error: null,
              }),
            })),
          })),
        })
        .mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { ...mockMessage, role: 'assistant', id: 'msg-789' },
                error: null,
              }),
            })),
          })),
        });

      const pair = await MessageService.saveMessagePair(
        mockConversationId,
        'User question',
        'Assistant answer'
      );

      expect(pair).toBeDefined();
      expect(pair.userMessage.role).toBe('user');
      expect(pair.assistantMessage.role).toBe('assistant');
    });

    it('should save message pair with sources', async () => {
      const sources = [
        {
          type: 'web' as const,
          title: 'Source',
          url: 'https://example.com',
        },
      ];

      (supabaseAdmin.from as any)
        .mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { ...mockMessage, role: 'user' },
                error: null,
              }),
            })),
          })),
        })
        .mockReturnValueOnce({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { ...mockMessage, role: 'assistant', sources, id: 'msg-789' },
                error: null,
              }),
            })),
          })),
        });

      const pair = await MessageService.saveMessagePair(
        mockConversationId,
        'Question',
        'Answer',
        sources
      );

      expect(pair.assistantMessage.sources).toEqual(sources);
    });
  });

  describe('getConversationMessages', () => {
    it('should get all messages for conversation', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              asc: jest.fn().mockResolvedValue({
                data: [mockMessage],
                error: null,
              }),
            })),
          })),
        })),
      });

      const messages = await MessageService.getConversationMessages(mockConversationId);

      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
    });

    it('should use sliding window when enabled', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              asc: jest.fn().mockResolvedValue({
                data: Array.from({ length: 20 }, (_, i) => ({
                  ...mockMessage,
                  id: `msg-${i}`,
                })),
                error: null,
              }),
            })),
          })),
        })),
      });

      const messages = await MessageService.getConversationMessages(mockConversationId, {
        useSlidingWindow: true,
        maxMessages: 10,
      });

      expect(SlidingWindowService.getSlidingWindow).toHaveBeenCalled();
      expect(messages.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getConversationHistory', () => {
    it('should get conversation history formatted for OpenAI', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              asc: jest.fn().mockResolvedValue({
                data: [
                  { ...mockMessage, role: 'user' },
                  { ...mockMessage, role: 'assistant', id: 'msg-789' },
                ],
                error: null,
              }),
            })),
          })),
        })),
      });

      const history = await MessageService.getConversationHistory(mockConversationId);

      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should limit history to last N messages', async () => {
      (supabaseAdmin.from as any).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              asc: jest.fn().mockResolvedValue({
                data: Array.from({ length: 15 }, (_, i) => ({
                  ...mockMessage,
                  id: `msg-${i}`,
                  role: i % 2 === 0 ? 'user' : 'assistant',
                })),
                error: null,
              }),
            })),
          })),
        })),
      });

      const history = await MessageService.getConversationHistory(mockConversationId, 10);

      expect(history.length).toBeLessThanOrEqual(10);
    });
  });
});
