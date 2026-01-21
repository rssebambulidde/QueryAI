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
      // RAG options
      enableDocumentSearch,
      enableWebSearch,
      topicId,
      documentIds,
      maxDocumentChunks,
      minScore,
      conversationId,
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
    });

    const result = await AIService.answerQuestion(request, userId);

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
      // RAG options
      enableDocumentSearch,
      enableWebSearch,
      topicId,
      documentIds,
      maxDocumentChunks,
      minScore,
      conversationId,
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

      // Save messages to conversation if conversationId provided and userId available
      if (request.conversationId && userId && fullAnswer) {
        try {
          const { ConversationService } = await import('../services/conversation.service');
          const { MessageService } = await import('../services/message.service');
          
          // Verify or create conversation
          let conversationId = request.conversationId;
          let conversation = await ConversationService.getConversation(conversationId, userId);
          
          if (!conversation) {
            // Create new conversation with auto-generated title
            const title = ConversationService.generateTitleFromMessage(request.question);
            conversation = await ConversationService.createConversation({
              userId,
              title,
              topicId: request.topicId,
            });
            conversationId = conversation.id;
            logger.info('Created new conversation for streaming message', { conversationId, userId });
          }

          // Save message pair with sources
          await MessageService.saveMessagePair(
            conversationId,
            request.question,
            fullAnswer,
            sources, // Include sources from RAG context
            {
              model: request.model || 'gpt-4o-mini',
              streaming: true,
            }
          );

          logger.info('Messages saved to conversation (streaming)', {
            conversationId,
            userId,
          });
        } catch (saveError: any) {
          // Log error but don't fail the request
          logger.warn('Failed to save messages to conversation (streaming)', {
            error: saveError.message,
            conversationId: request.conversationId,
            userId,
          });
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

export default router;
