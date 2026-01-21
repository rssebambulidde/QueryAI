import { Router, Request, Response } from 'express';
import { TopicService, CreateTopicInput, UpdateTopicInput } from '../services/topic.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import { AppError, ValidationError } from '../types/error';

const router = Router();

/**
 * GET /api/topics
 * Get all topics for the authenticated user
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
 * GET /api/topics/:id
 * Get topic by ID
 */
router.get(
  '/:id',
  authenticate,
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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const topicId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, description, scopeConfig } = req.body;

    if (!name && description === undefined && scopeConfig === undefined) {
      throw new ValidationError('At least one field (name, description, or scopeConfig) is required');
    }

    const updates: UpdateTopicInput = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (scopeConfig !== undefined) updates.scopeConfig = scopeConfig;

    const topic = await TopicService.updateTopic(topicId, userId, updates);

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const topicId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await TopicService.deleteTopic(topicId, userId);

    res.json({
      success: true,
      message: 'Topic deleted successfully',
    });
  })
);

export default router;
