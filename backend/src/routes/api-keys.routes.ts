import { Router, Request, Response } from 'express';
import { ApiKeyService, CreateApiKeyInput, UpdateApiKeyInput } from '../services/api-key.service';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { AppError, ValidationError } from '../types/error';

const router = Router();

/**
 * GET /api/api-keys
 * Get all API keys for the authenticated user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const apiKeys = await ApiKeyService.getUserApiKeys(userId);

    res.json({
      success: true,
      data: apiKeys,
    });
  })
);

/**
 * GET /api/api-keys/:id
 * Get API key by ID
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const apiKeyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const apiKey = await ApiKeyService.getApiKey(apiKeyId, userId);

    if (!apiKey) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND');
    }

    res.json({
      success: true,
      data: apiKey,
    });
  })
);

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { name, description, topicId, rateLimitPerHour, rateLimitPerDay, expiresAt } = req.body;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('API key name is required');
    }

    const input: CreateApiKeyInput = {
      userId,
      name,
      description,
      topicId,
      rateLimitPerHour,
      rateLimitPerDay,
      expiresAt,
    };

    const result = await ApiKeyService.createApiKey(input);

    // Return API key with plain key (only shown once)
    res.status(201).json({
      success: true,
      data: {
        ...result.apiKey,
        // Include plain key only on creation
        key: result.plainKey,
      },
      message: 'API key created. Save this key securely - it will not be shown again.',
    });
  })
);

/**
 * PUT /api/api-keys/:id
 * Update an API key
 */
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const apiKeyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, description, rateLimitPerHour, rateLimitPerDay, isActive, expiresAt } = req.body;

    const updates: UpdateApiKeyInput = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (rateLimitPerHour !== undefined) updates.rateLimitPerHour = rateLimitPerHour;
    if (rateLimitPerDay !== undefined) updates.rateLimitPerDay = rateLimitPerDay;
    if (isActive !== undefined) updates.isActive = isActive;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt;

    const apiKey = await ApiKeyService.updateApiKey(apiKeyId, userId, updates);

    res.json({
      success: true,
      data: apiKey,
    });
  })
);

/**
 * DELETE /api/api-keys/:id
 * Delete an API key
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const apiKeyId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    await ApiKeyService.deleteApiKey(apiKeyId, userId);

    res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  })
);

export default router;
