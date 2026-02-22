import { Router } from 'express';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { ExportService, ExportFormat } from '../services/export.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { AppError } from '../types/error';
import { validateUUIDParams } from '../validation/uuid';
import logger from '../config/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/conversations
 * List user's conversations
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
    const includeMetadata = req.query.includeMetadata === 'true';

    const conversations = await ConversationService.getUserConversations(userId, {
      limit,
      offset,
      includeMetadata: includeMetadata ?? true, // Default to true for UI
    });

    res.json({
      success: true,
      data: conversations,
    });
  })
);

/**
 * POST /api/conversations
 * Create new conversation
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { title, topicId, mode } = req.body;

    // Validate mode if provided
    if (mode && !['research', 'chat'].includes(mode)) {
      res.status(400).json({
        success: false,
        error: { message: "Invalid mode. Must be 'research' or 'chat'." },
      });
      return;
    }

    const conversation = await ConversationService.createConversation({
      userId,
      title,
      topicId,
      mode: mode || 'research',
    });

    res.status(201).json({
      success: true,
      data: conversation,
    });
  })
);

/**
 * GET /api/conversations/:id
 * Get conversation details
 */
router.get(
  '/:id',
  validateUUIDParams('id'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const conversation = await ConversationService.getConversation(conversationId, userId);

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    res.json({
      success: true,
      data: conversation,
    });
  })
);

/**
 * PUT /api/conversations/:id
 * Update conversation (rename)
 */
router.put(
  '/:id',
  validateUUIDParams('id'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { title, topicId, metadata, filters, mode } = req.body;

    if (!title && topicId === undefined && metadata === undefined && filters === undefined && mode === undefined) {
      throw new AppError('At least one field (title, topicId, metadata, filters, or mode) is required', 400, 'VALIDATION_ERROR');
    }

    // Validate mode if provided
    if (mode !== undefined && !['research', 'chat'].includes(mode)) {
      throw new AppError("Invalid mode. Must be 'research' or 'chat'.", 400, 'VALIDATION_ERROR');
    }

    // If filters are provided, merge them into metadata
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (topicId !== undefined) updateData.topicId = topicId;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (mode !== undefined) updateData.mode = mode;
    if (filters !== undefined) {
      // Store filters in metadata
      updateData.metadata = { filters };
    }

    const conversation = await ConversationService.updateConversation(
      conversationId,
      userId,
      updateData
    );

    res.json({
      success: true,
      data: conversation,
    });
  })
);

/**
 * DELETE /api/conversations/:id
 * Delete conversation and all its messages
 */
router.delete(
  '/:id',
  validateUUIDParams('id'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await ConversationService.deleteConversation(conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  })
);

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation
 */
router.get(
  '/:id/messages',
  validateUUIDParams('id'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;

    const messages = await MessageService.getMessages(conversationId, userId, {
      limit,
      offset,
    });

    res.json({
      success: true,
      data: messages,
    });
  })
);

/**
 * POST /api/conversations/:id/messages
 * Save message to conversation
 */
router.post(
  '/:id/messages',
  validateUUIDParams('id'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { role, content, sources, metadata } = req.body;

    if (!role || !content) {
      throw new AppError('Role and content are required', 400, 'VALIDATION_ERROR');
    }

    // Verify conversation belongs to user
    const conversation = await ConversationService.getConversation(conversationId, userId);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    const message = await MessageService.saveMessage({
      conversationId,
      role,
      content,
      sources,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: message,
    });
  })
);

/**
 * DELETE /api/conversations/:id/messages/:messageId
 * Delete a message from a conversation
 */
router.delete(
  '/:id/messages/:messageId',
  validateUUIDParams('id', 'messageId'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;

    // Verify conversation belongs to user
    const conversation = await ConversationService.getConversation(conversationId, userId);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    await MessageService.deleteMessage(messageId, userId);

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  })
);

/**
 * GET /api/conversations/:id/export
 * Export conversation with bibliography in PDF, Markdown, or DOCX.
 * Query params: format=pdf|markdown|docx, includeSources=true, includeBibliography=true
 */
router.get(
  '/:id/export',
  validateUUIDParams('id'),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const format = (req.query.format as string) || 'markdown';

    const validFormats = ['pdf', 'markdown', 'docx'];
    if (!validFormats.includes(format)) {
      throw new AppError(`Invalid format. Must be one of: ${validFormats.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const conversation = await ConversationService.getConversation(conversationId, userId);
    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
    }

    const messages = await MessageService.getMessages(conversationId, userId, {
      limit: 500,
    });

    const includeSources = req.query.includeSources !== 'false';
    const includeBibliography = req.query.includeBibliography !== 'false';

    const result = await ExportService.exportConversation(conversation, messages, {
      format: format as ExportFormat,
      includeSources,
      includeBibliography,
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.send(result.buffer);
  })
);

export default router;
