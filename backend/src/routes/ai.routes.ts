import { Router, Request, Response } from 'express';
import { AIService, QuestionRequest } from '../services/ai.service';
import { RequestQueueService, QueuePriority } from '../services/request-queue.service';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth.middleware';
import { apiLimiter } from '../middleware/rateLimiter';
import { enforceQueryLimit } from '../middleware/subscription.middleware';
import { logQueryUsage } from '../middleware/usageCounter.middleware';
import { tierRateLimiter } from '../middleware/tierRateLimiter.middleware';
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
  tierRateLimiter,
  enforceQueryLimit,
  apiLimiter,
  logQueryUsage,
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
      enableDocumentSearch,
      enableWebSearch,
      topicId,
      documentIds,
      maxDocumentChunks,
      minScore,
      conversationId,
      // Queue options
      useQueue,
      priority,
    } = req.body;

    if (!question) {
      throw new ValidationError('Question is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
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
      timeRange,
      startDate,
      endDate,
      country,
      // RAG options
      enableDocumentSearch: enableDocumentSearch !== false, // Default to true
      enableWebSearch: enableWebSearch !== false, // Default to true
      topicId: topicId,
      documentIds: documentIds,
      maxDocumentChunks: maxDocumentChunks || 5,
      minScore: minScore || 0.5,
      // Conversation management
      conversationId: conversationId,
    };

    logger.info('AI question request with RAG', {
      userId,
      questionLength: request.question.length,
      hasContext: !!request.context,
      enableDocumentSearch: request.enableDocumentSearch,
      enableWebSearch: request.enableWebSearch,
      topicId: request.topicId,
      useQueue: !!useQueue,
    });

    // Use queue if requested
    if (useQueue) {
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
            conversationId,
            topicId,
            documentIds,
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
    const result = await AIService.answerQuestion(request, userId);

    // Log usage for analytics
    try {
      const { DatabaseService } = await import('../services/database.service');
      await DatabaseService.logUsage(userId, 'query', {
        question: request.question.substring(0, 200), // Truncate for storage
        topicId: request.topicId,
        model: request.model || 'gpt-3.5-turbo',
        hasSources: result.sources && result.sources.length > 0,
      });
    } catch (usageError: any) {
      logger.warn('Failed to log query usage', { error: usageError?.message });
    }

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
  tierRateLimiter,
  enforceQueryLimit,
  apiLimiter,
  logQueryUsage,
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
      enableDocumentSearch,
      enableWebSearch,
      topicId,
      documentIds,
      maxDocumentChunks,
      minScore,
      conversationId,
      resendUserMessageId,
    } = req.body;

    if (!question) {
      throw new ValidationError('Question is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
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
      timeRange,
      startDate,
      endDate,
      country,
      // RAG options
      enableDocumentSearch: enableDocumentSearch !== false, // Default to true
      enableWebSearch: enableWebSearch !== false, // Default to true
      topicId: topicId,
      documentIds: documentIds,
      maxDocumentChunks: maxDocumentChunks || 5,
      minScore: minScore || 0.5,
      // Conversation management
      conversationId: conversationId,
    };

    logger.info('AI streaming question request with RAG', {
      userId,
      questionLength: request.question.length,
      hasContext: !!request.context,
      enableDocumentSearch: request.enableDocumentSearch,
      enableWebSearch: request.enableWebSearch,
      topicId: request.topicId,
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
      const isResend = !!resendUserMessageId && !!request.conversationId && userId;

      if (isResend) {
        const { MessageService } = await import('../services/message.service');
        await MessageService.updateMessage(resendUserMessageId, userId, { content: request.question });
        const all = await MessageService.getAllMessages(request.conversationId!, userId);
        const idx = all.findIndex((m) => m.id === resendUserMessageId);
        if (idx >= 0 && idx + 1 < all.length && all[idx + 1].role === 'assistant') {
          await MessageService.deleteMessage(all[idx + 1].id, userId);
        }
      }

      // Off-topic pre-check (before RAG): skip RAG and stream refusal when enabled (8.x, 13.1)
      let topicName: string | undefined;
      let topicDescription: string | undefined;
      let topicScopeConfig: any;
      if (request.topicId && userId) {
        try {
          const { TopicService } = await import('../services/topic.service');
          const topic = await TopicService.getTopic(request.topicId, userId);
          if (topic) {
            topicName = topic.name;
            topicDescription = topic.description ?? undefined;
            topicScopeConfig = topic.scope_config ?? null;
          }
        } catch (_) {}
      }
      const preCheckEnabled =
        !!topicName &&
        process.env.ENABLE_OFF_TOPIC_PRE_CHECK !== 'false' &&
        topicScopeConfig?.enable_off_topic_pre_check !== false;
      if (preCheckEnabled) {
        const onTopic = await AIService.runOffTopicPreCheck(
          request.question,
          topicName!,
          topicDescription,
          topicScopeConfig
        );
        if (!onTopic) {
          const refusal = AIService.getRefusalMessage(topicName!);
          const followUp = AIService.getRefusalFollowUp(topicName!);
          res.write(`data: ${JSON.stringify({ chunk: refusal })}\n\n`);
          res.write(`data: ${JSON.stringify({ followUpQuestions: [followUp], refusal: true })}\n\n`);
          if (request.conversationId && userId) {
            try {
              const { ConversationService } = await import('../services/conversation.service');
              const { MessageService } = await import('../services/message.service');
              let conv = await ConversationService.getConversation(request.conversationId, userId);
              let cid = request.conversationId;
              if (!conv) {
                conv = await ConversationService.createConversation({
                  userId,
                  title: ConversationService.generateTitleFromMessage(request.question),
                  topicId: request.topicId,
                });
                cid = conv.id;
              }
              await MessageService.saveMessagePair(cid, request.question, refusal, [], {
                followUpQuestions: [followUp],
                isRefusal: true,
              });
            } catch (e: any) {
              logger.warn('Failed to save refusal to conversation (streaming)', { error: e?.message });
            }
          }
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
          return;
        }
      }

      // Retrieve RAG context first to get sources
      let sources: any[] | undefined = undefined;
      let ragContext: any = null;
      
      if (userId) {
        try {
          const { RAGService } = await import('../services/rag.service');
          const ragOptions: any = {
            userId,
            topicId: request.topicId,
            documentIds: request.documentIds,
            enableDocumentSearch: request.enableDocumentSearch !== false,
            enableWebSearch: request.enableWebSearch !== false,
            maxDocumentChunks: request.maxDocumentChunks || 5,
            maxWebResults: request.maxSearchResults || 5,
            minScore: request.minScore || 0.5,
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
        } catch (ragError: any) {
          logger.warn('Failed to retrieve RAG context for sources in streaming', {
            error: ragError.message,
          });
        }
      }
      
      // Stream the response and collect full answer
      const stream = AIService.answerQuestionStream(request, userId);
      let fullAnswer = '';
      
      for await (const chunk of stream) {
        fullAnswer += chunk;
        // Send chunk as SSE format
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      
      // Parse follow-up questions from the complete answer (lenient: FOLLOW_UP_QUESTIONS/Follow-up, bullets - * •)
      let followUpQuestions: string[] | undefined;
      let followUpMatch = fullAnswer.match(/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i);
      if (followUpMatch) {
        const questionsText = followUpMatch[1];
        followUpQuestions = questionsText
          .split('\n')
          .map(line => line.replace(/^[-*•]\s+/, '').trim())
          .filter(q => q.length > 0)
          .slice(0, 4);
        fullAnswer = fullAnswer.substring(0, followUpMatch.index).trim();
      } else {
        // Fallback: extract 1–4 bullet lines from the end (model sometimes varies FOLLOW_UP format)
        const tail = fullAnswer.slice(-700);
        const bulletLines = tail.split(/\n/).filter((l) => /^\s*[-*•]\s+.{10,}/.test(l));
        if (bulletLines.length >= 1 && bulletLines.length <= 6) {
          followUpQuestions = bulletLines
            .map((l) => l.replace(/^\s*[-*•]\s+/, '').trim())
            .filter((q) => q.length > 5 && q.length < 200)
            .slice(0, 4);
          if (followUpQuestions.length >= 1) {
            const idx = tail.indexOf(bulletLines[0]);
            if (idx >= 0) {
              const start = Math.max(0, fullAnswer.length - 700 + idx);
              fullAnswer = fullAnswer.substring(0, start).trim();
            }
          }
        }
      }

      // Mandatory follow-ups: if still none, generate from latest Q&A (research or not)
      if ((!followUpQuestions || followUpQuestions.length === 0) && fullAnswer) {
        try {
          const generated = await AIService.generateFollowUpQuestions(request.question, fullAnswer, topicName);
          if (generated.length > 0) followUpQuestions = generated;
        } catch (genErr: any) {
          logger.warn('Follow-up questions fallback failed in streaming', { error: genErr?.message });
        }
      }
      
      // Send follow-up questions (required on every response)
      if (followUpQuestions && followUpQuestions.length > 0) {
        res.write(`data: ${JSON.stringify({ followUpQuestions })}\n\n`);
      }

      // Save messages to conversation if conversationId provided and userId available
      if (request.conversationId && userId && fullAnswer) {
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
              topicId: request.topicId,
            });
            conversationId = conversation.id;
            logger.info('Created new conversation for streaming message', { conversationId, userId });
          }

          if (isResend) {
            await MessageService.saveMessage({
              conversationId,
              role: 'assistant',
              content: fullAnswer,
              sources: sources ?? undefined,
              metadata: {
                model: request.model || 'gpt-4o-mini',
                streaming: true,
                ...(followUpQuestions && followUpQuestions.length > 0 && { followUpQuestions }),
              },
            });
          } else {
            await MessageService.saveMessagePair(
              conversationId,
              request.question,
              fullAnswer,
              sources,
              {
                model: request.model || 'gpt-4o-mini',
                streaming: true,
                ...(followUpQuestions && followUpQuestions.length > 0 && { followUpQuestions }),
              }
            );
          }

          logger.info('Messages saved to conversation (streaming)', {
            conversationId,
            userId,
            isResend,
          });
        } catch (saveError: any) {
          logger.warn('Failed to save messages to conversation (streaming)', {
            error: saveError.message,
            conversationId: request.conversationId,
            userId,
          });
        }
      }

      // Log usage for analytics
      if (userId && fullAnswer) {
        try {
          const { DatabaseService } = await import('../services/database.service');
          await DatabaseService.logUsage(userId, 'query', {
            question: request.question.substring(0, 200), // Truncate for storage
            topicId: request.topicId,
            model: request.model || 'gpt-3.5-turbo',
            hasSources: sources && sources.length > 0,
            streaming: true,
          });
        } catch (usageError: any) {
          logger.warn('Failed to log query usage (streaming)', { error: usageError?.message });
        }
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

    res.status(200).json({
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

    res.status(200).json({
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

    res.status(200).json({
      success: true,
      data: { report },
    });
  })
);

/**
 * POST /api/ai/research-session-summary (7.1)
 * Generate a research session summary when exiting research mode
 */
router.post(
  '/research-session-summary',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationId, topicName } = req.body;

    if (!conversationId || !topicName) {
      throw new ValidationError('conversationId and topicName are required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const summary = await AIService.generateResearchSessionSummary(conversationId, userId, topicName);

    res.status(200).json({
      success: true,
      data: { summary },
    });
  })
);

/**
 * GET /api/ai/suggested-starters?topicId=:id (6.1)
 * Generate dynamic, AI-generated starter questions for a research topic.
 */
router.get(
  '/suggested-starters',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const topicId = req.query.topicId as string;

    if (!topicId) {
      throw new ValidationError('topicId is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const starters = await AIService.generateSuggestedStarters(topicId, userId);

    res.status(200).json({
      success: true,
      data: { starters },
    });
  })
);

/**
 * POST /api/ai/ask/queue
 * Queue a RAG request for async processing
 * Requires authentication
 */
router.post(
  '/ask/queue',
  authenticate,
  tierRateLimiter,
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
      enableDocumentSearch,
      enableWebSearch,
      topicId,
      documentIds,
      maxDocumentChunks,
      minScore,
      conversationId,
      priority,
    } = req.body;

    if (!question) {
      throw new ValidationError('Question is required');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const request: QuestionRequest = {
      question: question.trim(),
      context: context?.trim(),
      conversationHistory: conversationHistory || [],
      model,
      temperature,
      maxTokens,
      enableSearch: enableSearch !== false,
      topic: topic?.trim(),
      maxSearchResults: maxSearchResults || 5,
      timeRange,
      startDate,
      endDate,
      country,
      enableDocumentSearch: enableDocumentSearch !== false,
      enableWebSearch: enableWebSearch !== false,
      topicId: topicId,
      documentIds: documentIds,
      maxDocumentChunks: maxDocumentChunks || 5,
      minScore: minScore || 0.5,
      conversationId: conversationId,
    };

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
        topicId,
        documentIds,
      },
    });

    res.status(202).json({
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
    const { jobId } = req.params;
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

    res.json({
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
    const { jobId } = req.params;
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

    res.json({
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
    const stats = await RequestQueueService.getQueueStats();
    const health = await RequestQueueService.getQueueHealth();
    const { RAGWorker } = await import('../workers/rag-worker');
    const workerStatus = RAGWorker.getWorkerStatus();

    res.json({
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

    res.json({
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

export default router;
