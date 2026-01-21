import { Router, Request, Response } from 'express';
import { AIService, QuestionRequest } from '../services/ai.service';
import { apiKeyAuth, logApiKeyUsage } from '../middleware/apiKeyAuth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import logger from '../config/logger';

const router = Router();

/**
 * Custom API Routes
 * These routes are accessible via API key authentication
 * and are scoped to the topic associated with the API key
 */

/**
 * POST /api/v1/ask
 * Ask a question using the topic-scoped AI
 * Requires API key authentication
 */
router.post(
  '/ask',
  apiKeyAuth,
  logApiKeyUsage,
  asyncHandler(async (req: Request, res: Response) => {
    const { question, conversationHistory, model, temperature, maxTokens } = req.body;
    const apiKey = (req as any).apiKey;
    const userId = (req as any).userId;
    const topicId = (req as any).topicId;

    if (!question || question.trim().length === 0) {
      throw new ValidationError('Question is required');
    }

    if (question.length > 2000) {
      throw new ValidationError('Question is too long (max 2000 characters)');
    }

    // Build request - scope to API key's topic
    const request: QuestionRequest = {
      question,
      conversationHistory,
      model,
      temperature,
      maxTokens,
      // Always use topic from API key
      topicId: topicId || undefined,
      // Enable both document and web search by default
      enableDocumentSearch: true,
      enableWebSearch: true,
      maxDocumentChunks: 5,
      maxSearchResults: 5,
    };

    logger.info('Custom API question request', {
      apiKeyId: apiKey.id,
      userId,
      topicId,
      questionLength: question.length,
    });

    const response = await AIService.answerQuestion(request, userId);

    res.json({
      success: true,
      data: response,
    });
  })
);

/**
 * POST /api/v1/ask/stream
 * Ask a question with streaming response
 * Requires API key authentication
 */
router.post(
  '/ask/stream',
  apiKeyAuth,
  logApiKeyUsage,
  asyncHandler(async (req: Request, res: Response) => {
    const { question, conversationHistory, model, temperature, maxTokens } = req.body;
    const apiKey = (req as any).apiKey;
    const userId = (req as any).userId;
    const topicId = (req as any).topicId;

    if (!question || question.trim().length === 0) {
      throw new ValidationError('Question is required');
    }

    if (question.length > 2000) {
      throw new ValidationError('Question is too long (max 2000 characters)');
    }

    // Build request - scope to API key's topic
    const request: QuestionRequest = {
      question,
      conversationHistory,
      model,
      temperature,
      maxTokens,
      // Always use topic from API key
      topicId: topicId || undefined,
      // Enable both document and web search by default
      enableDocumentSearch: true,
      enableWebSearch: true,
      maxDocumentChunks: 5,
      maxSearchResults: 5,
    };

    logger.info('Custom API streaming question request', {
      apiKeyId: apiKey.id,
      userId,
      topicId,
      questionLength: question.length,
    });

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      // Stream the response
      for await (const chunk of AIService.answerQuestionStream(request, userId)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      logger.error('Error in streaming response:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  })
);

/**
 * GET /api/v1/health
 * Health check endpoint for custom API
 */
router.get(
  '/health',
  apiKeyAuth,
  logApiKeyUsage,
  asyncHandler(async (req: Request, res: Response) => {
    const apiKey = (req as any).apiKey;
    const rateLimit = await import('../services/api-key.service').then(
      (m) => m.ApiKeyService.checkRateLimit(apiKey.id)
    );

    res.json({
      success: true,
      data: {
        status: 'operational',
        apiKeyId: apiKey.id,
        topicId: apiKey.topic_id,
        rateLimit: {
          remainingPerHour: rateLimit.remainingPerHour,
          remainingPerDay: rateLimit.remainingPerDay,
        },
      },
    });
  })
);

export default router;
