import { Router, Request, Response } from 'express';
import { AIService, QuestionRequest } from '../services/ai.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimiter';
import { ValidationError } from '../types/error';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/ai/ask
 * Answer a question using AI (non-streaming)
 * Requires authentication
 */
router.post(
  '/ask',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { question, context, conversationHistory, model, temperature, maxTokens } = req.body;

    if (!question) {
      throw new ValidationError('Question is required');
    }

    const request: QuestionRequest = {
      question: question.trim(),
      context: context?.trim(),
      conversationHistory: conversationHistory || [],
      model,
      temperature,
      maxTokens,
    };

    logger.info('AI question request', {
      userId: req.user?.id,
      questionLength: request.question.length,
      hasContext: !!request.context,
    });

    const result = await AIService.answerQuestion(request);

    res.status(200).json({
      success: true,
      message: 'Question answered successfully',
      data: result,
    });
  })
);

/**
 * POST /api/ai/ask/stream
 * Answer a question using AI (streaming)
 * Requires authentication
 */
router.post(
  '/ask/stream',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { question, context, conversationHistory, model, temperature, maxTokens } = req.body;

    if (!question) {
      throw new ValidationError('Question is required');
    }

    const request: QuestionRequest = {
      question: question.trim(),
      context: context?.trim(),
      conversationHistory: conversationHistory || [],
      model,
      temperature,
      maxTokens,
    };

    logger.info('AI streaming question request', {
      userId: req.user?.id,
      questionLength: request.question.length,
      hasContext: !!request.context,
    });

    // Set headers for Server-Sent Events (SSE)
    // Must be set before any writes
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Flush headers immediately
    res.flushHeaders();

    // Handle client disconnect
    req.on('close', () => {
      logger.info('Client disconnected from streaming endpoint', {
        userId: req.user?.id,
      });
      res.end();
    });

    try {
      // Stream the response
      const stream = AIService.answerQuestionStream(request);
      
      for await (const chunk of stream) {
        // Send chunk as SSE format
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      // Send completion message
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      logger.error('Error in streaming endpoint:', error);
      
      // Send error as SSE
      res.write(`data: ${JSON.stringify({ 
        error: {
          message: error.message || 'Failed to generate response',
          code: error.code || 'STREAM_ERROR',
        }
      })}\n\n`);
      res.end();
    }
  })
);

export default router;
