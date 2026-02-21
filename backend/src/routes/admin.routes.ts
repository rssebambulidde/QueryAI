import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/authorization.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError, AuthorizationError } from '../types/error';
import { supabaseAdmin } from '../config/database';
import { DatabaseService } from '../services/database.service';
import logger from '../config/logger';
import { apiLimiter } from '../middleware/rateLimiter';
import { sanitizePostgrestValue, validateSearchInput } from '../validation/sanitize';
import { validateUUIDParams } from '../validation/uuid';

const router = Router();

/**
 * GET /api/admin/users
 * List all users (admin/super_admin only)
 */
router.get(
  '/users',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { limit: rawLimit = '50', offset: rawOffset = '0', search } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(rawLimit as string, 10) || 50, 1), 100);
    const parsedOffset = Math.max(parseInt(rawOffset as string, 10) || 0, 0);

    let query = supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name, role, created_at, updated_at')
      .order('created_at', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    const validatedSearch = validateSearchInput(search);
    if (validatedSearch) {
      const sanitized = sanitizePostgrestValue(validatedSearch);
      query = query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
    }

    const { data: users, error } = await query;

    if (error) {
      logger.error('Error fetching users:', error);
      throw new ValidationError('Failed to fetch users');
    }

    res.json({
      success: true,
      data: {
        users: users || [],
        total: users?.length || 0,
      },
    });
  })
);

/**
 * GET /api/admin/users/:id
 * Get user details by ID (admin/super_admin only)
 */
router.get(
  '/users/:id',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;

    const [profile, subscription] = await Promise.all([
      DatabaseService.getUserProfile(userId),
      DatabaseService.getUserSubscription(userId),
    ]);

    if (!profile) {
      throw new ValidationError('User not found');
    }

    res.json({
      success: true,
      data: {
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: profile.role || 'user',
          subscriptionTier: subscription?.tier || 'free',
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
      },
    });
  })
);

/**
 * PUT /api/admin/users/:id/role
 * Update user role (super_admin only)
 */
router.put(
  '/users/:id/role',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  validateUUIDParams('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = Array.isArray(id) ? id[0] : id;
    const { role } = req.body;

    if (!role || !['user', 'super_admin'].includes(role)) {
      throw new ValidationError('Invalid role. Must be: user or super_admin');
    }

    // Prevent changing own role (security measure)
    if (req.user?.id === userId && role !== 'super_admin') {
      throw new AuthorizationError('Cannot change your own role');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user role:', error);
      throw new ValidationError('Failed to update user role');
    }

    logger.info(`User role updated by ${req.user?.id}: ${userId} -> ${role}`);

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
        },
      },
    });
  })
);

/**
 * PUT /api/admin/users/by-email/:email/role
 * Update user role by email (super_admin only)
 */
router.put(
  '/users/by-email/:email/role',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.params;
    const userEmail = Array.isArray(email) ? email[0] : email;
    const { role } = req.body;

    if (!role || !['user', 'super_admin'].includes(role)) {
      throw new ValidationError('Invalid role. Must be: user or super_admin');
    }

    // Find user by email
    const { data: profile, error: findError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (findError || !profile) {
      throw new ValidationError('User not found');
    }

    // Prevent changing own role
    if (req.user?.id === profile.id && role !== 'super_admin') {
      throw new AuthorizationError('Cannot change your own role');
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ role })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating user role:', error);
      throw new ValidationError('Failed to update user role');
    }

    logger.info(`User role updated by ${req.user?.id}: ${userEmail} (${profile.id}) -> ${role}`);

    res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: data.id,
          email: data.email,
          role: data.role,
        },
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════
// LLM-as-Judge Evaluation Aggregates
// ═════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/quality/evaluations
 * Returns aggregate faithfulness / relevance / citation-accuracy scores
 * grouped by day (default), week, or month.
 *
 * Query params:
 *   days    – lookback window (default 30)
 *   groupBy – "day" | "week" | "month"
 *   detail  – if "true", also returns the most recent individual evaluations
 */
router.get(
  '/quality/evaluations',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { AnswerEvaluatorService } = await import('../services/answer-evaluator.service');

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);
    const groupBy = (['day', 'week', 'month'].includes(req.query.groupBy as string)
      ? req.query.groupBy as 'day' | 'week' | 'month'
      : 'day');
    const includeDetail = req.query.detail === 'true';

    const aggregates = await AnswerEvaluatorService.getAggregates(days, groupBy);

    const responseData: Record<string, any> = { aggregates };

    if (includeDetail) {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
      responseData.recent = await AnswerEvaluatorService.getRecentEvaluations(limit, offset);
    }

    res.json({ success: true, data: responseData });
  })
);

// ═══════════════════════════════════════════════════════════════════════
// Feedback analytics (admin)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/feedback/analytics
 * Aggregate user feedback grouped by day/week/month.
 */
router.get(
  '/feedback/analytics',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);
    const groupBy = (['day', 'week', 'month'].includes(req.query.groupBy as string)
      ? req.query.groupBy as 'day' | 'week' | 'month'
      : 'day');

    const analytics = await FeedbackService.getAnalytics(days, groupBy);

    res.json({ success: true, data: { analytics } });
  })
);

/**
 * GET /api/admin/feedback/by-model
 * Feedback breakdown per AI model.
 */
router.get(
  '/feedback/by-model',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);

    const byModel = await FeedbackService.getByModel(days);

    res.json({ success: true, data: { byModel } });
  })
);

/**
 * GET /api/admin/feedback/by-topic
 * Feedback breakdown per topic.
 */
router.get(
  '/feedback/by-topic',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 30, 1), 365);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

    const byTopic = await FeedbackService.getByTopic(days, limit);

    res.json({ success: true, data: { byTopic } });
  })
);

/**
 * GET /api/admin/feedback/flagged
 * Recent feedback with flagged citations.
 */
router.get(
  '/feedback/flagged',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const flagged = await FeedbackService.getRecentFlagged(limit, offset);

    res.json({ success: true, data: { flagged } });
  })
);

/**
 * GET /api/admin/feedback/recent
 * Recent feedback entries (all).
 */
router.get(
  '/feedback/recent',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { FeedbackService } = await import('../services/feedback.service');

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const recent = await FeedbackService.getRecent(limit, offset);

    res.json({ success: true, data: { recent } });
  })
);

// ══════════════════════════════════════════════════════════════════════════════
// LLM Settings
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/settings/llm
 * Returns current provider config per mode, available providers & models.
 */
router.get(
  '/settings/llm',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (_req: Request, res: Response) => {
    const { ProviderRegistry } = await import('../providers/provider-registry');
    const { SystemSettingsService } = await import('../services/system-settings.service');

    const providers = ProviderRegistry.listProviders();
    const chatConfig = ProviderRegistry.getActiveConfig('chat');
    const researchConfig = ProviderRegistry.getActiveConfig('research');
    const defaults = await SystemSettingsService.get<{ temperature?: number; maxTokens?: number }>('llm_defaults');
    const featureFlags = await SystemSettingsService.get<Record<string, boolean>>('feature_flags');

    // Return which providers have API keys configured (redacted)
    const apiKeyStatus: Record<string, boolean> = {};
    for (const p of providers) {
      apiKeyStatus[p.id] = p.configured;
    }

    res.json({
      success: true,
      data: {
        chatConfig,
        researchConfig,
        providers,
        apiKeyStatus,
        defaults: defaults ?? { temperature: 0.7, maxTokens: 4096 },
        featureFlags: featureFlags ?? {},
      },
    });
  })
);

/**
 * PUT /api/admin/settings/llm
 * Update provider + model for a mode (chat or research).
 * Body: { mode: 'chat' | 'research', providerId: string, modelId: string }
 */
router.put(
  '/settings/llm',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { mode, providerId, modelId } = req.body;

    if (!mode || !['chat', 'research'].includes(mode)) {
      throw new ValidationError('mode must be "chat" or "research"');
    }
    if (!providerId || typeof providerId !== 'string') {
      throw new ValidationError('providerId is required');
    }
    if (!modelId || typeof modelId !== 'string') {
      throw new ValidationError('modelId is required');
    }

    const { ProviderRegistry } = await import('../providers/provider-registry');

    // Validate the provider exists
    const providers = ProviderRegistry.listProviders();
    const target = providers.find((p) => p.id === providerId);
    if (!target) {
      throw new ValidationError(`Unknown provider: ${providerId}`);
    }
    // Validate the model exists in that provider
    const modelExists = target.models.some((m) => m.id === modelId);
    if (!modelExists) {
      throw new ValidationError(`Model "${modelId}" is not available in provider "${providerId}"`);
    }

    await ProviderRegistry.setAndPersistConfig(mode, providerId, modelId, req.user!.id);

    logger.info('Admin updated LLM config', { mode, providerId, modelId, userId: req.user!.id });

    res.json({
      success: true,
      data: { mode, providerId, modelId },
    });
  })
);

/**
 * PUT /api/admin/settings/llm/api-keys
 * Set API keys per provider. Keys are stored as redacted hashes in system_settings.
 * The real keys remain in env vars — this endpoint is for future runtime key rotation.
 * Body: { keys: { openai?: string, anthropic?: string, google?: string, groq?: string } }
 */
router.put(
  '/settings/llm/api-keys',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { keys } = req.body;

    if (!keys || typeof keys !== 'object') {
      throw new ValidationError('keys object is required');
    }

    const allowedProviders = ['openai', 'anthropic', 'google', 'groq'];
    const sanitized: Record<string, string> = {};

    for (const [provider, key] of Object.entries(keys)) {
      if (!allowedProviders.includes(provider)) {
        throw new ValidationError(`Unknown provider: ${provider}`);
      }
      if (typeof key !== 'string' || key.length < 10) {
        throw new ValidationError(`Invalid API key for ${provider}`);
      }
      // Store a redacted version (first 8 + last 4 chars)
      sanitized[provider] = `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
    }

    const { SystemSettingsService } = await import('../services/system-settings.service');
    await SystemSettingsService.set('llm_api_keys', sanitized, req.user!.id);

    logger.info('Admin updated LLM API keys', { providers: Object.keys(sanitized), userId: req.user!.id });

    res.json({
      success: true,
      data: { providers: Object.keys(sanitized) },
    });
  })
);

/**
 * POST /api/admin/settings/llm/test
 * Test a provider + model connection by sending a simple prompt.
 * Body: { providerId: string, modelId: string }
 */
router.post(
  '/settings/llm/test',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { providerId, modelId } = req.body;

    if (!providerId || typeof providerId !== 'string') {
      throw new ValidationError('providerId is required');
    }
    if (!modelId || typeof modelId !== 'string') {
      throw new ValidationError('modelId is required');
    }

    const { ProviderRegistry } = await import('../providers/provider-registry');
    const provider = ProviderRegistry.getProvider(providerId);

    if (!provider) {
      throw new ValidationError(`Provider "${providerId}" is not registered (missing API key?)`);
    }

    const modelExists = provider.supportedModels.some((m) => m.id === modelId);
    if (!modelExists) {
      throw new ValidationError(`Model "${modelId}" not found in provider "${providerId}"`);
    }

    const startTime = Date.now();
    try {
      const result = await provider.chatCompletion({
        model: modelId,
        messages: [{ role: 'user', content: 'Say "hello" in one word.' }],
        temperature: 0,
        maxTokens: 20,
      });

      const latencyMs = Date.now() - startTime;

      logger.info('Admin LLM connection test succeeded', { providerId, modelId, latencyMs });

      res.json({
        success: true,
        data: {
          status: 'ok',
          response: result.content.substring(0, 100),
          model: result.model,
          latencyMs,
          tokensUsed: result.usage.totalTokens,
        },
      });
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      logger.error('Admin LLM connection test failed', { providerId, modelId, error: err.message });

      res.json({
        success: false,
        error: {
          message: `Connection test failed: ${err.message}`,
          latencyMs,
        },
      });
    }
  })
);

/**
 * PUT /api/admin/settings/llm/defaults
 * Update default temperature and max tokens.
 * Body: { temperature?: number, maxTokens?: number }
 */
router.put(
  '/settings/llm/defaults',
  authenticate,
  requireSuperAdmin,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { temperature, maxTokens } = req.body;

    const updates: Record<string, number> = {};
    if (temperature !== undefined) {
      if (typeof temperature !== 'number' || temperature < 0 || temperature > 2) {
        throw new ValidationError('temperature must be a number between 0 and 2');
      }
      updates.temperature = temperature;
    }
    if (maxTokens !== undefined) {
      if (typeof maxTokens !== 'number' || maxTokens < 100 || maxTokens > 128000) {
        throw new ValidationError('maxTokens must be a number between 100 and 128000');
      }
      updates.maxTokens = maxTokens;
    }

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('At least one of temperature or maxTokens must be provided');
    }

    const { SystemSettingsService } = await import('../services/system-settings.service');
    const existing = (await SystemSettingsService.get<Record<string, number>>('llm_defaults')) ?? {};
    const merged = { ...existing, ...updates };

    await SystemSettingsService.set('llm_defaults', merged, req.user!.id);

    logger.info('Admin updated LLM defaults', { ...updates, userId: req.user!.id });

    res.json({
      success: true,
      data: merged,
    });
  })
);

export default router;
