import { Router, Request, Response } from 'express';
import { CollectionService, CreateCollectionInput, UpdateCollectionInput } from '../services/collection.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError, ValidationError } from '../types/error';

const router = Router();

/**
 * GET /api/collections
 * Get all collections for the authenticated user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const collections = await CollectionService.getUserCollections(userId);

    res.json({
      success: true,
      data: collections,
    });
  })
);

/**
 * GET /api/collections/:id
 * Get collection by ID with conversations
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const collectionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const collection = await CollectionService.getCollectionWithConversations(collectionId, userId);

    res.json({
      success: true,
      data: collection,
    });
  })
);

/**
 * POST /api/collections
 * Create a new collection
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { name, description, color, icon } = req.body;

    if (!name || typeof name !== 'string') {
      throw new ValidationError('Collection name is required');
    }

    const input: CreateCollectionInput = {
      user_id: userId,
      name,
      description,
      color,
      icon,
    };

    const collection = await CollectionService.createCollection(input);

    res.status(201).json({
      success: true,
      data: collection,
    });
  })
);

/**
 * PUT /api/collections/:id
 * Update a collection
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const collectionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, description, color, icon } = req.body;

    const updates: UpdateCollectionInput = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;

    const collection = await CollectionService.updateCollection(collectionId, userId, updates);

    res.json({
      success: true,
      data: collection,
    });
  })
);

/**
 * DELETE /api/collections/:id
 * Delete a collection
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const collectionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await CollectionService.deleteCollection(collectionId, userId);

    res.json({
      success: true,
      message: 'Collection deleted successfully',
    });
  })
);

/**
 * POST /api/collections/:id/conversations/:conversationId
 * Add a conversation to a collection
 */
router.post(
  '/:id/conversations/:conversationId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const collectionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversationId = Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId;

    await CollectionService.addConversationToCollection(collectionId, conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation added to collection',
    });
  })
);

/**
 * DELETE /api/collections/:id/conversations/:conversationId
 * Remove a conversation from a collection
 */
router.delete(
  '/:id/conversations/:conversationId',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const collectionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversationId = Array.isArray(req.params.conversationId) ? req.params.conversationId[0] : req.params.conversationId;

    await CollectionService.removeConversationFromCollection(collectionId, conversationId, userId);

    res.json({
      success: true,
      message: 'Conversation removed from collection',
    });
  })
);

/**
 * GET /api/collections/:id/search
 * Search conversations within a collection
 */
router.get(
  '/:id/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const collectionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const searchQuery = Array.isArray(req.query.q) ? req.query.q[0] : (req.query.q as string);

    if (!searchQuery || typeof searchQuery !== 'string') {
      throw new ValidationError('Search query is required');
    }

    const conversations = await CollectionService.searchCollectionConversations(
      collectionId,
      userId,
      searchQuery
    );

    res.json({
      success: true,
      data: conversations,
    });
  })
);

export default router;
