import { Router, Request, Response } from 'express';
import { AIService } from '../services/ai.service';
import type { QuestionRequest } from '../services/ai.service';
import { RequestQueueService, QueuePriority } from '../services/request-queue.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { apiLimiter, anonymousAiLimiter } from '../middleware/rateLimiter';
import { enforceQueryLimit, enforceResearchMode } from '../middleware/subscription.middleware';
import { tierRateLimiter } from '../middleware/tierRateLimiter.middleware';
import { validateRequest } from '../middleware/validate';
import { QuestionRequestSchema, RegenerateRequestSchema } from '../schemas/ai-request.schema';
import { ValidationError, NotFoundError } from '../types/error';
import { isValidUUID, assertUUID, validateUUIDArray } from '../validation/uuid';
import { AIAnswerPipelineService } from '../services/ai-answer-pipeline.service';
import { StreamingService } from '../services/streaming.service';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/ai/ask
 * Answer a question using AI (non-streaming)
 * Requires authentication
 */
router.post(
  '/ask',
  validateRequest(QuestionRequestSchema),
  authenticate,
  tierRateLimiter,
  enforceResearchMode,
  enforceQueryLimit,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // req.body has been validated & stripped by Zod middleware
    const body = req.body;

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { useQueue, priority, ...rest } = body;

    const request: QuestionRequest = {
      ...rest,
      question: rest.question.trim(),
      context: rest.context?.trim(),
      // Let undefined/empty flow through so prepareRequestContext() loads
      // history from DB via the unified sliding-window strategy.
      conversationHistory: rest.conversationHistory?.length ? rest.conversationHistory : undefined,
      enableSearch: rest.enableSearch !== false,
      topic: rest.topic?.trim(),
      maxSearchResults: rest.maxSearchResults ?? 5,
      enableDocumentSearch: false, // v2: document search disabled
      enableWebSearch: rest.enableWebSearch !== false,
      maxDocumentChunks: rest.maxDocumentChunks ?? 5,
      mode: rest.mode || 'research',
    };

    logger.info('AI question request', {
      userId,
      questionLength: request.question.length,
      hasContext: !!request.context,
      mode: request.mode,
      enableWebSearch: request.enableWebSearch,
      useQueue: !!useQueue,
    });

    // AbortController for client disconnect on non-streaming requests
    const abortController = new AbortController();
    req.on('close', () => {
      if (!res.writableEnded) abortController.abort();
    });

    // Use queue if requested and available (Redis must be configured)
    if (useQueue && RequestQueueService.isAvailable()) {
      try {
        // Parse priority
        let queuePriority = QueuePriority.NORMAL;
        if (priority) {
          const priorityMap: Record<string, QueuePriority> = {
            'low': QueuePriority.LOW,
            'normal': QueuePriority.NORMAL,
            'high': QueuePriority.HIGH,
            'urgent': QueuePriority.URGENT,
          };
          queuePriority = priorityMap[priority.toLowerCase()] || QueuePriority.NORMAL;
        }

        const job = await RequestQueueService.addRAGRequest(userId, request, {
          priority: queuePriority,
          metadata: {
            conversationId: request.conversationId,
          },
        });

        return res.status(202).json({
          success: true,
          message: 'Request queued successfully',
          data: {
            jobId: job.id,
            status: 'queued',
            priority: queuePriority,
          },
        });
      } catch (queueError: any) {
        logger.error('Failed to queue request', {
          error: queueError.message,
          userId,
        });
        // Fall back to direct processing
        logger.info('Falling back to direct processing');
      }
    }

    // Direct processing (default or fallback)
    const result = await AIService.answerQuestion(request, userId, { signal: abortController.signal });

    // Log usage for analytics
    try {
      const { DatabaseService } = await import('../services/database.service');
      await DatabaseService.logUsage(userId, 'query', {
        question: request.question.substring(0, 200), // Truncate for storage
        model: request.model || 'gpt-3.5-turbo',
        hasSources: result.sources && result.sources.length > 0,
      });
    } catch (usageError: any) {
      logger.warn('Failed to log query usage', { error: usageError?.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Question answered successfully',
      data: result,
    });
  })
);

/**
 * POST /api/ai/ask/anonymous
 * Answer a question using AI (streaming) — no authentication required.
 * Uses IP-based rate limiting. Conversations are NOT saved.
 * Designed for the anonymous "try before sign-up" experience.
 */
router.post(
  '/ask/anonymous',
  validateRequest(QuestionRequestSchema),
  optionalAuthenticate,
  anonymousAiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body;

    // Anonymous users get a deterministic pseudo-ID for logging (not saved to DB)
    const anonId = req.user?.id || `anon-${req.ip || 'unknown'}`;

    const request: QuestionRequest = {
      question: body.question.trim(),
      context: body.context?.trim(),
      conversationHistory: body.conversationHistory?.length ? body.conversationHistory : undefined,
      enableSearch: body.enableSearch !== false,
      topic: body.topic?.trim(),
      maxSearchResults: Math.min(body.maxSearchResults ?? 3, 3), // Limit web results for anonymous
      enableDocumentSearch: false,
      enableWebSearch: body.enableWebSearch !== false,
      maxDocumentChunks: 0,
      mode: body.mode || 'research',
      // Inline attachments (images + documents) — ephemeral, not stored
      attachments: body.attachments,
    };

    logger.info('Anonymous AI streaming request', {
      anonId,
      questionLength: request.question.length,
      mode: request.mode,
      ip: req.ip,
    });

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.flushHeaders();

    const abortController = new AbortController();

    req.on('close', () => {
      abortController.abort();
      logger.info('Anonymous client disconnected', { anonId });
      if (!res.writableEnded) res.end();
    });

    try {
      // ── RAG retrieval (research mode only) ─────────────────────────
      let sources: any[] | undefined = undefined;

      if (request.mode !== 'chat') {
        try {
          const { RAGService } = await import('../services/rag.service');
          const ragOptions: any = {
            userId: undefined, // No user for anonymous
            enableDocumentSearch: false,
            enableWebSearch: request.enableWebSearch !== false,
            maxDocumentChunks: 0,
            maxWebResults: request.maxSearchResults ?? 3,
            topic: request.topic,
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            country: request.country,
          };

          if (request.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }

          const ragContext = await RAGService.retrieveContext(request.question, ragOptions);
          sources = RAGService.extractSources(ragContext);
        } catch (ragError: any) {
          logger.warn('Failed to retrieve RAG context for anonymous streaming', {
            error: ragError.message,
          });
        }
      }

      // Send sources early via SSE
      if (sources && sources.length > 0) {
        res.write(StreamingService.formatSSEMessage('sources', sources));
      }

      // Stream the response — use a generic userId for the pipeline
      // The pipeline will generate an answer but nothing is persisted
      const stream = AIService.answerQuestionStream(request, anonId, { signal: abortController.signal });
      let fullAnswer = '';
      let structuredMeta: { followUpQuestions?: string[]; citedSources?: any[] } | null = null;

      for await (const chunk of stream) {
        // The pipeline may yield extraction status metadata at the start
        if (typeof chunk === 'string' && chunk.startsWith('{"__extractionStatus":true')) {
          try {
            const meta = JSON.parse(chunk);
            res.write(StreamingService.formatSSEMessage('extractionStatus', meta.statuses));
          } catch { /* skip malformed */ }
          continue;
        }
        if (typeof chunk === 'string' && chunk.startsWith('{"__structured":true')) {
          try {
            structuredMeta = JSON.parse(chunk);
          } catch {
            fullAnswer += chunk;
            res.write(StreamingService.formatSSEMessage('chunk', chunk));
          }
        } else {
          fullAnswer += chunk;
          res.write(StreamingService.formatSSEMessage('chunk', chunk));
        }
      }

      // Emit follow-up questions if available (no DB persistence)
      if (structuredMeta?.followUpQuestions && structuredMeta.followUpQuestions.length > 0) {
        res.write(StreamingService.formatSSEMessage('followUpQuestions', { questions: structuredMeta.followUpQuestions }));
      }

      // No conversation/message saving for anonymous users

      // Send completion
      if (!abortController.signal.aborted && !res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('done', {}));
        res.end();
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ABORT_ERR' || abortController.signal.aborted) {
        logger.info('Anonymous stream cancelled', { anonId });
        if (!res.writableEnded) res.end();
        return;
      }

      logger.error('Error in anonymous streaming endpoint:', error);

      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('error', {
          message: error.message || 'Failed to generate response',
          code: error.code || 'STREAM_ERROR',
        }));
        res.end();
      }
    }
  })
);

/**
 * POST /api/ai/ask/stream
 * Answer a question using AI (streaming)
 * Requires authentication
 */
router.post(
  '/ask/stream',
  validateRequest(QuestionRequestSchema),
  authenticate,
  tierRateLimiter,
  enforceResearchMode,
  enforceQueryLimit,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // req.body has been validated & stripped by Zod middleware
    const body = req.body;

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { useQueue, priority, resendUserMessageId, ...rest } = body;

    const request: QuestionRequest = {
      ...rest,
      question: rest.question.trim(),
      context: rest.context?.trim(),
      // Let undefined/empty flow through so prepareRequestContext() loads
      // history from DB via the unified sliding-window strategy.
      conversationHistory: rest.conversationHistory?.length ? rest.conversationHistory : undefined,
      enableSearch: rest.enableSearch !== false,
      topic: rest.topic?.trim(),
      maxSearchResults: rest.maxSearchResults ?? 5,
      enableDocumentSearch: false, // v2: document search disabled
      enableWebSearch: rest.enableWebSearch !== false,
      maxDocumentChunks: rest.maxDocumentChunks ?? 5,
      mode: rest.mode || 'research',
    };

    logger.info('AI streaming question request', {
      userId,
      questionLength: request.question.length,
      hasContext: !!request.context,
      mode: request.mode,
      enableWebSearch: request.enableWebSearch,
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

    // AbortController — signals the OpenAI API to stop generating when the client disconnects
    const abortController = new AbortController();

    // Handle client disconnect
    req.on('close', () => {
      abortController.abort();
      logger.info('Client disconnected from streaming endpoint', {
        userId: req.user?.id,
      });
      if (!res.writableEnded) res.end();
    });

    try {
      const isResend = !!resendUserMessageId && !!request.conversationId && !!userId;

      if (isResend) {
        const { MessageService } = await import('../services/message.service');
        await MessageService.updateMessage(resendUserMessageId, userId, { content: request.question });
        const all = await MessageService.getAllMessages(request.conversationId!, userId, { unlimited: true });
        const idx = all.findIndex((m) => m.id === resendUserMessageId);
        if (idx >= 0 && idx + 1 < all.length && all[idx + 1].role === 'assistant') {
          await MessageService.deleteMessage(all[idx + 1].id, userId);
        }
      }

      // v2: Off-topic pre-check removed (topics retired)

      // ── RAG retrieval (research mode only) ─────────────────────────
      let sources: any[] | undefined = undefined;
      let ragContext: any = null;
      let formattedRagContext: string | undefined = undefined;
      
      if (request.mode !== 'chat' && userId) {
        try {
          const { RAGService } = await import('../services/rag.service');
          const ragOptions: any = {
            userId,
            enableDocumentSearch: false, // v2: document search disabled
            enableWebSearch: request.enableWebSearch !== false,
            maxDocumentChunks: request.maxDocumentChunks ?? 5,
            maxWebResults: request.maxSearchResults ?? 5,
            // Leave minScore as undefined when not provided so adaptive threshold runs.
            // Adaptive threshold dynamically calculates the best score for this query.
            minScore: request.minScore,
            topic: request.topic,
            timeRange: request.timeRange,
            startDate: request.startDate,
            endDate: request.endDate,
            country: request.country,
          };
          
          if (request.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }
          
          ragContext = await RAGService.retrieveContext(request.question, ragOptions);
          sources = RAGService.extractSources(ragContext);
          
          // Pre-format context to pass to stream generator (avoids double RAG retrieval)
          formattedRagContext = await RAGService.formatContextForPrompt(ragContext, {
            enableRelevanceOrdering: true,
            contextReductionStrategy: 'summarize' as const,
            enableSourcePrioritization: true,
            enableTokenBudgeting: true,
            tokenBudgetOptions: { model: request.model || 'gpt-3.5-turbo' },
            query: request.question,
            model: request.model || 'gpt-3.5-turbo',
            userId: userId,
          });
        } catch (ragError: any) {
          logger.warn('Failed to retrieve RAG context for sources in streaming', {
            error: ragError.message,
          });
        }
      }
      
      // Send sources early via SSE so frontend can display them while streaming
      if (sources && sources.length > 0) {
        res.write(StreamingService.formatSSEMessage('sources', sources));
      }
      
      // Stream the response and collect full answer
      const stream = AIService.answerQuestionStream(request, userId, { signal: abortController.signal });
      let fullAnswer = '';
      let structuredMeta: { followUpQuestions?: string[]; citedSources?: any[] } | null = null;
      
      for await (const chunk of stream) {
        // The pipeline may yield extraction status metadata at the start
        if (typeof chunk === 'string' && chunk.startsWith('{"__extractionStatus":true')) {
          try {
            const meta = JSON.parse(chunk);
            res.write(StreamingService.formatSSEMessage('extractionStatus', meta.statuses));
          } catch { /* skip malformed */ }
          continue;
        }
        // The pipeline may yield a JSON metadata sentinel at the end
        if (typeof chunk === 'string' && chunk.startsWith('{"__structured":true')) {
          try {
            structuredMeta = JSON.parse(chunk);
          } catch {
            // Not valid metadata — treat as text
            fullAnswer += chunk;
            res.write(StreamingService.formatSSEMessage('chunk', chunk));
          }
        } else {
          fullAnswer += chunk;
          // Send chunk as SSE format
          res.write(StreamingService.formatSSEMessage('chunk', chunk));
        }
      }
      
      // Post-stream processing
      if (request.mode === 'chat') {
        // Chat mode: save messages, skip quality scoring / citation validation
        // Still emit follow-ups if the structured output included them
        if (structuredMeta?.followUpQuestions && structuredMeta.followUpQuestions.length > 0) {
          res.write(StreamingService.formatSSEMessage('followUpQuestions', { questions: structuredMeta.followUpQuestions }));
        }

        if (request.conversationId && userId) {
          try {
            const { ConversationService } = await import('../services/conversation.service');
            const { MessageService } = await import('../services/message.service');

            let conversationId = request.conversationId;
            let conversation = await ConversationService.getConversation(conversationId, userId);

            if (!conversation) {
              const title = ConversationService.generateTitleFromMessage(request.question);
              conversation = await ConversationService.createConversation({
                userId,
                title,
                mode: 'chat',
              });
              conversationId = conversation.id;
            }

            await MessageService.saveMessagePair(
              conversationId,
              request.question,
              fullAnswer,
              undefined, // no sources
              { model: request.model || 'gpt-4o-mini', isResend },
            );
          } catch (saveError: any) {
            logger.warn('Failed to save chat messages', { error: saveError.message });
          }
        }

        // Log usage for chat mode (research mode logs via postProcessStream)
        if (userId && fullAnswer) {
          try {
            const { DatabaseService } = await import('../services/database.service');
            await DatabaseService.logUsage(userId, 'query', {
              question: request.question.substring(0, 200),
              model: request.model || 'gpt-4o-mini',
              mode: 'chat',
              streaming: true,
            });
          } catch (usageError: any) {
            logger.warn('Failed to log chat query usage', { error: usageError?.message });
          }
        }
      } else {
        // Research mode: full post-processing (follow-ups, quality, save, usage log)
        const ragSettingsObj: Record<string, any> = {
          enableWebSearch: request.enableWebSearch,
          enableDocumentSearch: false,
          maxSearchResults: request.maxSearchResults,
          timeRange: request.timeRange,
          startDate: request.startDate,
          endDate: request.endDate,
          country: request.country,
          topic: request.topic,
        };
        Object.keys(ragSettingsObj).forEach((k) => ragSettingsObj[k] === undefined && delete ragSettingsObj[k]);

        const postResult = await AIAnswerPipelineService.postProcessStream({
          fullAnswer,
          question: request.question,
          userId,
          sources,
          conversationId: request.conversationId,
          model: request.model,
          isResend,
          structuredFollowUps: structuredMeta?.followUpQuestions,
          structuredCitedSources: structuredMeta?.citedSources,
          ragSettings: ragSettingsObj,
        });

        if (postResult.followUpQuestions && postResult.followUpQuestions.length > 0) {
          res.write(StreamingService.formatSSEMessage('followUpQuestions', { questions: postResult.followUpQuestions }));
        }
        if (postResult.qualityScore !== undefined) {
          res.write(StreamingService.formatSSEMessage('qualityScore', { score: postResult.qualityScore }));
        }
      }

      // Send completion message
      if (!abortController.signal.aborted && !res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('done', {}));
        res.end();
      }
    } catch (error: any) {
      // Client disconnected — not an error
      if (error.name === 'AbortError' || error.code === 'ABORT_ERR' || error.code === 'REQUEST_CANCELLED' || abortController.signal.aborted) {
        logger.info('Stream cancelled by client', { userId: req.user?.id });
        if (!res.writableEnded) res.end();
        return;
      }

      logger.error('Error in streaming endpoint:', error);
      
      // Send error as SSE (only if the client is still connected)
      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('error', {
          message: error.message || 'Failed to generate response',
          code: error.code || 'STREAM_ERROR',
        }));
        res.end();
      }
    }
  })
);

/**
 * POST /api/ai/summarize
 * Generate a summary of a previous AI response
 */
router.post(
  '/summarize',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { originalResponse, keyword, sources } = req.body;

    if (!originalResponse || !keyword) {
      throw new ValidationError('originalResponse and keyword are required');
    }

    const summary = await AIService.summarizeResponse(originalResponse, keyword, sources);

    return res.status(200).json({
      success: true,
      data: { summary },
    });
  })
);

/**
 * POST /api/ai/essay
 * Generate a formal essay based on a previous AI response
 */
router.post(
  '/essay',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { originalResponse, keyword, sources } = req.body;

    if (!originalResponse || !keyword) {
      throw new ValidationError('originalResponse and keyword are required');
    }

    const essay = await AIService.writeEssay(originalResponse, keyword, sources);

    return res.status(200).json({
      success: true,
      data: { essay },
    });
  })
);

/**
 * POST /api/ai/report
 * Generate a detailed report based on a previous AI response
 */
router.post(
  '/report',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { originalResponse, keyword, sources } = req.body;

    if (!originalResponse || !keyword) {
      throw new ValidationError('originalResponse and keyword are required');
    }

    const report = await AIService.generateDetailedReport(originalResponse, keyword, sources);

    return res.status(200).json({
      success: true,
      data: { report },
    });
  })
);

// ── Streaming generation endpoints (SSE) ──────────────────────────────

/**
 * POST /api/ai/summarize/stream
 * Stream a summary of a previous AI response via SSE
 */
router.post(
  '/summarize/stream',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { originalResponse, keyword, sources } = req.body;

    if (!originalResponse || !keyword) {
      throw new ValidationError('originalResponse and keyword are required');
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.flushHeaders();

    try {
      const stream = AIService.summarizeResponseStream(originalResponse, keyword, sources);

      for await (const chunk of stream) {
        if (res.writableEnded) break;
        res.write(StreamingService.formatSSEMessage('chunk', chunk));
      }

      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('done', {}));
        res.end();
      }
    } catch (error: any) {
      logger.error('Error in summarize stream:', error);
      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('error', { message: error.message || 'Streaming summary failed' }));
        res.end();
      }
    }
  })
);

/**
 * POST /api/ai/essay/stream
 * Stream a formal essay based on a previous AI response via SSE
 */
router.post(
  '/essay/stream',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { originalResponse, keyword, sources } = req.body;

    if (!originalResponse || !keyword) {
      throw new ValidationError('originalResponse and keyword are required');
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.flushHeaders();

    try {
      const stream = AIService.writeEssayStream(originalResponse, keyword, sources);

      for await (const chunk of stream) {
        if (res.writableEnded) break;
        res.write(StreamingService.formatSSEMessage('chunk', chunk));
      }

      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('done', {}));
        res.end();
      }
    } catch (error: any) {
      logger.error('Error in essay stream:', error);
      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('error', { message: error.message || 'Streaming essay failed' }));
        res.end();
      }
    }
  })
);

/**
 * POST /api/ai/report/stream
 * Stream a detailed report based on a previous AI response via SSE
 */
router.post(
  '/report/stream',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { originalResponse, keyword, sources } = req.body;

    if (!originalResponse || !keyword) {
      throw new ValidationError('originalResponse and keyword are required');
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.flushHeaders();

    try {
      const stream = AIService.generateDetailedReportStream(originalResponse, keyword, sources);

      for await (const chunk of stream) {
        if (res.writableEnded) break;
        res.write(StreamingService.formatSSEMessage('chunk', chunk));
      }

      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('done', {}));
        res.end();
      }
    } catch (error: any) {
      logger.error('Error in report stream:', error);
      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('error', { message: error.message || 'Streaming report failed' }));
        res.end();
      }
    }
  })
);

// v2: /research-session-summary and /suggested-starters removed (topic features retired)

/**
 * POST /api/ai/ask/queue
 * Queue a RAG request for async processing
 * Requires authentication
 */
router.post(
  '/ask/queue',
  authenticate,
  tierRateLimiter,
  enforceResearchMode,
  enforceQueryLimit,
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
      timeRange,
      startDate,
      endDate,
      country,
      // RAG options
      enableWebSearch,
      conversationId,
      priority,
    } = req.body;

    if (!question) {
      throw new ValidationError('Question is required');
    }

    // Validate UUID params from body
    if (conversationId) assertUUID(conversationId, 'conversationId');

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const request: QuestionRequest = {
      question: question.trim(),
      context: context?.trim(),
      // Let undefined/empty flow through — unified sliding-window strategy in pipeline
      conversationHistory: conversationHistory?.length ? conversationHistory : undefined,
      model,
      temperature,
      maxTokens,
      enableSearch: enableSearch !== false,
      topic: topic?.trim(),
      maxSearchResults: maxSearchResults ?? 5,
      timeRange,
      startDate,
      endDate,
      country,
      enableDocumentSearch: false, // v2: document search disabled
      enableWebSearch: enableWebSearch !== false,
      conversationId: conversationId,
    };

    if (!RequestQueueService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Queue is not available. Redis is not configured. Use POST /api/ai/ask for direct processing.',
      });
    }

    // Parse priority
    let queuePriority = QueuePriority.NORMAL;
    if (priority) {
      const priorityMap: Record<string, QueuePriority> = {
        'low': QueuePriority.LOW,
        'normal': QueuePriority.NORMAL,
        'high': QueuePriority.HIGH,
        'urgent': QueuePriority.URGENT,
      };
      queuePriority = priorityMap[priority.toLowerCase()] || QueuePriority.NORMAL;
    }

    const job = await RequestQueueService.addRAGRequest(userId, request, {
      priority: queuePriority,
      metadata: {
        conversationId,
      },
    });

    return res.status(202).json({
      success: true,
      message: 'Request queued successfully',
      data: {
        jobId: job.id,
        status: 'queued',
        priority: queuePriority,
      },
    });
  })
);

/**
 * GET /api/ai/queue/job/:jobId
 * Get job status
 */
router.get(
  '/queue/job/:jobId',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!RequestQueueService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Queue is not available. Redis is not configured.',
      });
    }
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const userId = req.user?.id;

    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const status = await RequestQueueService.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Verify job belongs to user (basic check)
    const job = await RequestQueueService.getJob(jobId);
    if (job && job.data.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    return res.json({
      success: true,
      data: status,
    });
  })
);

/**
 * DELETE /api/ai/queue/job/:jobId
 * Cancel a queued job
 */
router.delete(
  '/queue/job/:jobId',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!RequestQueueService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Queue is not available. Redis is not configured.',
      });
    }
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const userId = req.user?.id;

    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    // Verify job belongs to user
    const job = await RequestQueueService.getJob(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (job.data.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const cancelled = await RequestQueueService.cancelJob(jobId);

    return res.json({
      success: cancelled,
      message: cancelled ? 'Job cancelled successfully' : 'Failed to cancel job',
    });
  })
);

/**
 * GET /api/ai/queue/stats
 * Get queue statistics
 */
router.get(
  '/queue/stats',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!RequestQueueService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Queue is not available. Redis is not configured.',
      });
    }
    const stats = await RequestQueueService.getQueueStats();
    const health = await RequestQueueService.getQueueHealth();
    const { RAGWorker } = await import('../workers/rag-worker');
    const workerStatus = RAGWorker.getWorkerStatus();

    return res.json({
      success: true,
      data: {
        stats,
        health,
        worker: workerStatus,
      },
    });
  })
);

/**
 * GET /api/ai/queue/jobs
 * Get jobs by state
 */
router.get(
  '/queue/jobs',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!RequestQueueService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Queue is not available. Redis is not configured.',
      });
    }
    const { state = 'waiting', start = 0, end = 9 } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const validStates = ['waiting', 'active', 'completed', 'failed', 'delayed', 'paused'];
    if (!validStates.includes(state as string)) {
      throw new ValidationError(`Invalid state. Must be one of: ${validStates.join(', ')}`);
    }

    const jobs = await RequestQueueService.getJobsByState(
      state as any,
      parseInt(start as string, 10),
      parseInt(end as string, 10)
    );

    // Filter by user ID
    const userJobs = jobs.filter(job => job.data.userId === userId);

    return res.json({
      success: true,
      data: {
        jobs: userJobs.map(job => ({
          id: job.id,
          state: state,
          priority: job.opts.priority,
          progress: job.progress,
          timestamp: job.timestamp,
          question: job.data.request.question.substring(0, 100),
        })),
        count: userJobs.length,
      },
    });
  })
);

/**
 * POST /api/ai/regenerate
 * Re-run the AI pipeline for an existing assistant message with optional parameter overrides.
 * Creates a NEW version row linked via parent_message_id (version history).
 * Uses SSE streaming — same protocol as /ask/stream with an additional `version` event at the end.
 */
router.post(
  '/regenerate',
  validateRequest(RegenerateRequestSchema),
  authenticate,
  tierRateLimiter,
  enforceResearchMode,
  enforceQueryLimit,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { messageId, conversationId, options } = req.body;
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { ConversationService } = await import('../services/conversation.service');
    const { MessageService } = await import('../services/message.service');

    // 1. Verify conversation ownership
    const conversation = await ConversationService.getConversation(conversationId, userId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // 2. Fetch the target assistant message and the preceding user message
    const allMessages = await MessageService.getAllMessages(conversationId, userId, { unlimited: true });
    const assistantIdx = allMessages.findIndex((m) => m.id === messageId);
    if (assistantIdx === -1 || allMessages[assistantIdx].role !== 'assistant') {
      throw new NotFoundError('Assistant message not found');
    }

    const originalAssistant = allMessages[assistantIdx];

    // Walk backwards to find the originating user question
    let userMessage: typeof allMessages[number] | undefined;
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (allMessages[i].role === 'user') {
        userMessage = allMessages[i];
        break;
      }
    }
    if (!userMessage) {
      throw new NotFoundError('Originating user message not found');
    }

    // 3. Build a QuestionRequest from the original user message + overrides
    //    Restore RAG settings from the original assistant metadata so
    //    regeneration replays the same retrieval config by default.
    const savedRagSettings = originalAssistant.metadata?.ragSettings as Record<string, any> | undefined;

    // Build conversation history from all messages before the target index
    const conversationHistory = allMessages
      .slice(0, assistantIdx)
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const mergedRequest: QuestionRequest = {
      question: userMessage.content,
      conversationId,
      ...(savedRagSettings && savedRagSettings),
      ...options,
      enableDocumentSearch: false, // v2: document search disabled
      // Always include conversation history for multi-turn context
      ...(conversationHistory.length > 0 && { conversationHistory }),
    };

    logger.info('Regenerating response (streaming, new version)', {
      userId,
      conversationId,
      messageId,
      userQuestion: userMessage.content.substring(0, 100),
      overrides: options,
    });

    // ── SSE headers ────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.flushHeaders();

    const abortController = new AbortController();

    req.on('close', () => {
      abortController.abort();
      logger.info('Client disconnected from regenerate streaming endpoint', { userId });
      if (!res.writableEnded) res.end();
    });

    try {
      // ── RAG retrieval (research mode) ────────────────────────────
      let sources: any[] | undefined = undefined;
      let ragContext: any = null;
      let formattedRagContext: string | undefined = undefined;

      if (mergedRequest.mode !== 'chat') {
        try {
          const { RAGService } = await import('../services/rag.service');
          const ragOptions: any = {
            userId,
            enableDocumentSearch: false,
            enableWebSearch: mergedRequest.enableWebSearch !== false,
            maxDocumentChunks: mergedRequest.maxDocumentChunks ?? 5,
            maxWebResults: mergedRequest.maxSearchResults ?? 5,
            minScore: mergedRequest.minScore,
            topic: mergedRequest.topic,
            timeRange: mergedRequest.timeRange,
            startDate: mergedRequest.startDate,
            endDate: mergedRequest.endDate,
            country: mergedRequest.country,
          };

          if (mergedRequest.enableSearch === false) {
            ragOptions.enableWebSearch = false;
          }

          ragContext = await RAGService.retrieveContext(mergedRequest.question, ragOptions);
          sources = RAGService.extractSources(ragContext);

          formattedRagContext = await RAGService.formatContextForPrompt(ragContext, {
            enableRelevanceOrdering: true,
            contextReductionStrategy: 'summarize' as const,
            enableSourcePrioritization: true,
            enableTokenBudgeting: true,
            tokenBudgetOptions: { model: mergedRequest.model || 'gpt-3.5-turbo' },
            query: mergedRequest.question,
            model: mergedRequest.model || 'gpt-3.5-turbo',
            userId,
          });
        } catch (ragError: any) {
          logger.warn('Failed to retrieve RAG context for regeneration streaming', {
            error: ragError.message,
          });
        }
      }

      // Send sources early
      if (sources && sources.length > 0) {
        res.write(StreamingService.formatSSEMessage('sources', sources));
      }

      // ── Stream the response ──────────────────────────────────────
      // Inject pre-retrieved context so the pipeline doesn't re-fetch
      if (formattedRagContext) {
        (mergedRequest as any)._preRetrievedRagContext = formattedRagContext;
      }

      const stream = AIService.answerQuestionStream(mergedRequest, userId, { signal: abortController.signal });
      let fullAnswer = '';
      let structuredMeta: { followUpQuestions?: string[]; citedSources?: any[] } | null = null;

      for await (const chunk of stream) {
        if (typeof chunk === 'string' && chunk.startsWith('{"__structured":true')) {
          try {
            structuredMeta = JSON.parse(chunk);
          } catch {
            fullAnswer += chunk;
            res.write(StreamingService.formatSSEMessage('chunk', chunk));
          }
        } else {
          fullAnswer += chunk;
          res.write(StreamingService.formatSSEMessage('chunk', chunk));
        }
      }

      // ── Post-stream: follow-ups & quality ────────────────────────
      const ragSettingsObj: Record<string, any> = {
        enableWebSearch: mergedRequest.enableWebSearch,
        enableDocumentSearch: false,
        maxSearchResults: mergedRequest.maxSearchResults,
        ...(options && { regenerateOptions: options }),
      };
      Object.keys(ragSettingsObj).forEach((k) => ragSettingsObj[k] === undefined && delete ragSettingsObj[k]);

      // We use postProcessStream but with skipSave=true semantics:
      // only extract follow-ups + quality; we'll save the version ourselves.
      let followUpQuestions: string[] | undefined;
      let qualityScore: number | undefined;
      let cleanedAnswer = fullAnswer;

      if (structuredMeta?.followUpQuestions && structuredMeta.followUpQuestions.length > 0) {
        followUpQuestions = structuredMeta.followUpQuestions;
      } else {
        try {
          const { ResponseProcessorService } = await import('../services/response-processor.service');
          const followUpResult = await ResponseProcessorService.processFollowUpQuestions(
            fullAnswer,
            mergedRequest.question,
          );
          followUpQuestions = followUpResult.questions.length > 0 ? followUpResult.questions : undefined;
          cleanedAnswer = followUpResult.answer;
        } catch (err: any) {
          logger.warn('Follow-up processing failed in regeneration stream', { error: err?.message });
        }
      }

      try {
        const { ResponseProcessorService } = await import('../services/response-processor.service');
        qualityScore = ResponseProcessorService.calculateAnswerQualityScore(
          cleanedAnswer,
          sources || [],
          followUpQuestions || [],
        );
      } catch (err: any) {
        logger.warn('Quality score calculation failed in regeneration', { error: err?.message });
      }

      if (followUpQuestions && followUpQuestions.length > 0) {
        res.write(StreamingService.formatSSEMessage('followUpQuestions', { questions: followUpQuestions }));
      }
      if (qualityScore !== undefined) {
        res.write(StreamingService.formatSSEMessage('qualityScore', { score: qualityScore }));
      }

      // ── Create new version ───────────────────────────────────────
      const newVersionMsg = await MessageService.createMessageVersion(messageId, {
        content: cleanedAnswer,
        sources: sources as any,
        metadata: {
          model: mergedRequest.model || 'gpt-4o-mini',
          streaming: true,
          ...(followUpQuestions?.length && { followUpQuestions }),
          ...(qualityScore !== undefined && { qualityScore }),
          ...(options && { regenerateOptions: options }),
          ragSettings: ragSettingsObj,
        },
      });

      await ConversationService.updateConversationTimestamp(conversationId);

      // Fetch all versions for the version pills UI
      const allVersions = await MessageService.getMessageVersions(messageId, userId);

      // ── Send version event ───────────────────────────────────────
      const versionPayload = {
        version: newVersionMsg.version,
        messageId: newVersionMsg.id,
        versions: allVersions.map((v) => ({
          id: v.id,
          version: v.version,
          content: v.content,
          sources: v.sources,
          metadata: v.metadata,
          created_at: v.created_at,
        })),
      };
      res.write(StreamingService.formatSSEMessage('version', versionPayload));

      logger.info('Response regenerated (streaming, new version)', {
        userId,
        conversationId,
        originalMessageId: messageId,
        newMessageId: newVersionMsg.id,
        newVersion: newVersionMsg.version,
      });

      // ── Log usage for regeneration ───────────────────────────────
      if (userId && cleanedAnswer) {
        try {
          const { DatabaseService } = await import('../services/database.service');
          await DatabaseService.logUsage(userId, 'query', {
            question: userMessage.content.substring(0, 200),
            model: mergedRequest.model || 'gpt-4o-mini',
            streaming: true,
            regeneration: true,
          });
        } catch (usageError: any) {
          logger.warn('Failed to log regeneration query usage', { error: usageError?.message });
        }
      }

      // ── Done ─────────────────────────────────────────────────────
      if (!abortController.signal.aborted && !res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('done', {}));
        res.end();
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ABORT_ERR' || abortController.signal.aborted) {
        logger.info('Regeneration stream cancelled by client', { userId });
        if (!res.writableEnded) res.end();
        return;
      }

      logger.error('Error in regeneration streaming endpoint:', error);

      if (!res.writableEnded) {
        res.write(StreamingService.formatSSEMessage('error', {
          message: error.message || 'Failed to regenerate response',
          code: error.code || 'REGENERATE_STREAM_ERROR',
        }));
        res.end();
      }
    }
  })
);

/**
 * GET /api/ai/messages/:messageId/versions
 * Fetch all versions of a message (root + children) for version history UI.
 */
router.get(
  '/messages/:messageId/versions',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { messageId } = req.params;
    if (!messageId || !isValidUUID(messageId)) {
      throw new ValidationError('Valid message ID is required');
    }

    const { MessageService } = await import('../services/message.service');
    const versions = await MessageService.getMessageVersions(messageId, userId);

    return res.status(200).json({
      success: true,
      data: { versions },
    });
  })
);

export default router;
