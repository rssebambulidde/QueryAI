import { Router, Request, Response } from 'express';
import { TopicService, CreateTopicInput, UpdateTopicInput, TopicTreeNode } from '../services/topic.service';
import { CacheInvalidationService } from '../services/cache-invalidation.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError, ValidationError } from '../types/error';
import { validateUUIDParams } from '../validation/uuid';
import { enforceTopicLimit } from '../middleware/subscription.middleware';
import logger from '../config/logger';

const router = Router();

/**
 * GET /api/topics
 * Get all topics for the authenticated user (flat list)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const topics = await TopicService.getUserTopics(userId);

    res.json({
      success: true,
      data: topics,
    });
  })
);

/**
 * GET /api/topics/tree
 * Get user's topics as a nested tree structure
 */
router.get(
  '/tree',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const tree = await TopicService.getUserTopicTree(userId);
    res.json({ success: true, data: tree });
  })
);

/**
 * GET /api/topics/:id
 * Get topic by ID
 */
router.get(
  '/:id',
  authenticate,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const topicId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const topic = await TopicService.getTopic(topicId, userId);

    if (!topic) {
      throw new AppError('Topic not found', 404, 'TOPIC_NOT_FOUND');
    }

    res.json({
      success: true,
      data: topic,
    });
  })
);

/**
 * POST /api/topics
 * Create a new topic
 */
router.post(
  '/',
  authenticate,
  enforceTopicLimit,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { name, description, scopeConfig } = req.body;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Topic name is required');
    }

    const input: CreateTopicInput = {
      userId,
      name,
      description,
      scopeConfig,
      parentTopicId: req.body.parentTopicId || null,
    };

    const topic = await TopicService.createTopic(input);

    res.status(201).json({
      success: true,
      data: topic,
    });
  })
);

/**
 * PUT /api/topics/:id
 * Update a topic
 */
router.put(
  '/:id',
  authenticate,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const topicId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, description, scopeConfig } = req.body;

    if (!name && description === undefined && scopeConfig === undefined && req.body.parentTopicId === undefined) {
      throw new ValidationError('At least one field (name, description, scopeConfig, or parentTopicId) is required');
    }

    const updates: UpdateTopicInput = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (scopeConfig !== undefined) updates.scopeConfig = scopeConfig;
    if (req.body.parentTopicId !== undefined) updates.parentTopicId = req.body.parentTopicId;

    const topic = await TopicService.updateTopic(topicId, userId, updates);

    // Invalidate cache for this topic
    try {
      await CacheInvalidationService.invalidateTopicCache(userId, topicId, {
        invalidateRAG: true,
        reason: 'Topic updated',
      });
    } catch (cacheError: any) {
      // Don't fail topic update if cache invalidation fails
      logger.warn('Cache invalidation failed after topic update', {
        topicId,
        error: cacheError.message,
      });
    }

    res.json({
      success: true,
      data: topic,
    });
  })
);

/**
 * DELETE /api/topics/:id
 * Delete a topic
 */
router.delete(
  '/:id',
  authenticate,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const topicId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await TopicService.deleteTopic(topicId, userId);

    // Invalidate cache for this topic
    try {
      await CacheInvalidationService.invalidateTopicCache(userId, topicId, {
        invalidateRAG: true,
        reason: 'Topic deleted',
      });
    } catch (cacheError: any) {
      // Don't fail topic deletion if cache invalidation fails
      logger.warn('Cache invalidation failed after topic deletion', {
        topicId,
        error: cacheError.message,
      });
    }

    res.json({
      success: true,
      message: 'Topic deleted successfully',
    });
  })
);

/**
 * GET /api/topics/:id/ancestors
 * Get the ancestor chain for a topic (root → current)
 */
router.get(
  '/:id/ancestors',
  authenticate,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const topicId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ancestors = await TopicService.getAncestors(topicId, userId);
    res.json({ success: true, data: ancestors });
  })
);

/**
 * GET /api/topics/:id/descendants
 * Get all descendant topic IDs (including self)
 */
router.get(
  '/:id/descendants',
  authenticate,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const topicId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const ids = await TopicService.getDescendantIds(topicId, userId);
    res.json({ success: true, data: ids });
  })
);

export default router;
