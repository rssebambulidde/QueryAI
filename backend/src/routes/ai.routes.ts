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
    const { 
      question, 
      context, 
      conversationHistory, 
      model, 
      temperature, 
      maxTokens,
      enableSearch,
      topic,
      maxSearchResults,
      includeDomains,
      excludeDomains,
      searchDepth,
      includeRawContent,
      includeAnswer,
      includeImages,
      timeRange,
      startDate,
      endDate,
      country,
    } = req.body;

    if (!question) {
      throw new ValidationError('Question is required');
    }

    const validTimeRanges = ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y'];
    if (timeRange && !validTimeRanges.includes(timeRange)) {
      throw new ValidationError(`Invalid timeRange. Must be one of: ${validTimeRanges.join(', ')}`);
    }

    const validSearchDepths = ['basic', 'advanced'];
    if (searchDepth && !validSearchDepths.includes(searchDepth)) {
      throw new ValidationError(`Invalid searchDepth. Must be one of: ${validSearchDepths.join(', ')}`);
    }

    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new ValidationError('startDate must be in YYYY-MM-DD format');
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new ValidationError('endDate must be in YYYY-MM-DD format');
    }

    if (maxSearchResults && (typeof maxSearchResults !== 'number' || maxSearchResults < 1 || maxSearchResults > 10)) {
      throw new ValidationError('maxSearchResults must be a number between 1 and 10');
    }

    if (includeDomains && !Array.isArray(includeDomains)) {
      throw new ValidationError('includeDomains must be an array of domain strings');
    }
    if (excludeDomains && !Array.isArray(excludeDomains)) {
      throw new ValidationError('excludeDomains must be an array of domain strings');
    }

    if (includeRawContent !== undefined && typeof includeRawContent !== 'boolean') {
      throw new ValidationError('includeRawContent must be a boolean');
    }
    if (includeAnswer !== undefined && typeof includeAnswer !== 'boolean') {
      throw new ValidationError('includeAnswer must be a boolean');
    }
    if (includeImages !== undefined && typeof includeImages !== 'boolean') {
      throw new ValidationError('includeImages must be a boolean');
    }

    const request: QuestionRequest = {
      question: question.trim(),
      context: context?.trim(),
      conversationHistory: conversationHistory || [],
      model,
      temperature,
      maxTokens,
      enableSearch: enableSearch !== false, // Default to true
      topic: topic?.trim(),
      maxSearchResults: maxSearchResults || 5,
      includeDomains,
      excludeDomains,
      searchDepth,
      includeRawContent,
      includeAnswer,
      includeImages,
      timeRange,
      startDate,
      endDate,
      country: country?.trim(),
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
    const { 
      question, 
      context, 
      conversationHistory, 
      model, 
      temperature, 
      maxTokens,
      enableSearch,
      topic,
      maxSearchResults,
      includeDomains,
      excludeDomains,
      searchDepth,
      includeRawContent,
      includeAnswer,
      includeImages,
      timeRange,
      startDate,
      endDate,
      country,
    } = req.body;

    if (!question) {
      throw new ValidationError('Question is required');
    }

    const validTimeRanges = ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y'];
    if (timeRange && !validTimeRanges.includes(timeRange)) {
      throw new ValidationError(`Invalid timeRange. Must be one of: ${validTimeRanges.join(', ')}`);
    }

    const validSearchDepths = ['basic', 'advanced'];
    if (searchDepth && !validSearchDepths.includes(searchDepth)) {
      throw new ValidationError(`Invalid searchDepth. Must be one of: ${validSearchDepths.join(', ')}`);
    }

    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new ValidationError('startDate must be in YYYY-MM-DD format');
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new ValidationError('endDate must be in YYYY-MM-DD format');
    }

    if (maxSearchResults && (typeof maxSearchResults !== 'number' || maxSearchResults < 1 || maxSearchResults > 10)) {
      throw new ValidationError('maxSearchResults must be a number between 1 and 10');
    }

    if (includeDomains && !Array.isArray(includeDomains)) {
      throw new ValidationError('includeDomains must be an array of domain strings');
    }
    if (excludeDomains && !Array.isArray(excludeDomains)) {
      throw new ValidationError('excludeDomains must be an array of domain strings');
    }

    if (includeRawContent !== undefined && typeof includeRawContent !== 'boolean') {
      throw new ValidationError('includeRawContent must be a boolean');
    }
    if (includeAnswer !== undefined && typeof includeAnswer !== 'boolean') {
      throw new ValidationError('includeAnswer must be a boolean');
    }
    if (includeImages !== undefined && typeof includeImages !== 'boolean') {
      throw new ValidationError('includeImages must be a boolean');
    }

    const request: QuestionRequest = {
      question: question.trim(),
      context: context?.trim(),
      conversationHistory: conversationHistory || [],
      model,
      temperature,
      maxTokens,
      enableSearch: enableSearch !== false, // Default to true
      topic: topic?.trim(),
      maxSearchResults: maxSearchResults || 5,
      includeDomains,
      excludeDomains,
      searchDepth,
      includeRawContent,
      includeAnswer,
      includeImages,
      timeRange,
      startDate,
      endDate,
      country: country?.trim(),
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
