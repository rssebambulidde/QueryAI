import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { ValidationError } from '../types/error';
import { DocumentService } from '../services/document.service';
import { ChunkService } from '../services/chunk.service';
import { EmbeddingService } from '../services/embedding.service';
import { apiLimiter } from '../middleware/rateLimiter';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/documents/:id/embed
 * Trigger embedding generation for a document
 */
router.post(
  '/:id/embed',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    const documentId = Array.isArray(id) ? id[0] : id;
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }

    // Get document
    const document = await DocumentService.getDocument(documentId, userId);
    if (!document) {
      throw new ValidationError('Document not found');
    }

    // Check if text is extracted
    if (!document.extracted_text || document.extracted_text.trim().length === 0) {
      throw new ValidationError('Document text must be extracted before generating embeddings');
    }

    // Check if already embedded
    if (document.status === 'embedded') {
      const chunkCount = await ChunkService.getChunkCount(documentId);
      if (chunkCount > 0) {
        res.status(200).json({
          success: true,
          message: 'Document already has embeddings',
          data: {
            documentId,
            chunkCount,
            status: 'embedded',
          },
        });
        return;
      }
    }

    // Update status to embedding
    await DocumentService.updateDocument(documentId, userId, {
      status: 'embedding',
      embedding_error: undefined,
    });

    logger.info('Starting embedding generation', {
      documentId,
      userId,
      textLength: document.extracted_text.length,
    });

    // Process document asynchronously (don't wait)
    EmbeddingService.processDocument(documentId, userId, document.extracted_text)
      .then(async ({ chunks, embeddings, metadata }) => {
        try {
          // Store chunks in database
          const createdChunks = await ChunkService.createChunks(documentId, chunks);

          // Update document with embedding metadata
          await DocumentService.updateDocument(documentId, userId, {
            status: 'embedded',
            metadata: {
              ...document.metadata,
              embedding: metadata,
              chunkCount: chunks.length,
              embeddedAt: new Date().toISOString(),
            },
          });

          logger.info('Embedding generation completed', {
            documentId,
            chunkCount: chunks.length,
            totalTokens: metadata.totalTokens,
          });

          // Note: Embeddings are stored in memory here
          // In Phase 2.5, we'll store them in Pinecone
          // For now, we just store the chunk metadata
        } catch (error: any) {
          logger.error('Failed to store chunks after embedding', {
            documentId,
            error: error.message,
          });
          await DocumentService.updateDocument(documentId, userId, {
            status: 'embedding_failed',
            embedding_error: error.message || 'Failed to store chunks',
          });
        }
      })
      .catch(async (error: any) => {
        logger.error('Embedding generation failed', {
          documentId,
          error: error.message,
        });
        await DocumentService.updateDocument(documentId, userId, {
          status: 'embedding_failed',
          embedding_error: error.message || 'Embedding generation failed',
        });
      });

    // Return immediately
    res.status(202).json({
      success: true,
      message: 'Embedding generation started',
      data: {
        documentId,
        status: 'embedding',
      },
    });
  })
);

/**
 * GET /api/documents/:id/embedding-status
 * Get embedding status for a document
 */
router.get(
  '/:id/embedding-status',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    const documentId = Array.isArray(id) ? id[0] : id;
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }

    const document = await DocumentService.getDocument(documentId, userId);
    if (!document) {
      throw new ValidationError('Document not found');
    }

    const chunkCount = await ChunkService.getChunkCount(documentId);
    const embeddingMetadata = document.metadata?.embedding;

    res.status(200).json({
      success: true,
      data: {
        documentId,
        status: document.status,
        chunkCount,
        embeddingMetadata,
        embeddingError: document.embedding_error,
      },
    });
  })
);

/**
 * GET /api/documents/:id/chunks
 * Get all chunks for a document
 */
router.get(
  '/:id/chunks',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { id } = req.params;
    const documentId = Array.isArray(id) ? id[0] : id;
    if (!documentId) {
      throw new ValidationError('Document ID is required');
    }

    const chunks = await ChunkService.getChunksByDocument(documentId, userId);

    res.status(200).json({
      success: true,
      data: {
        documentId,
        chunks: chunks.map(chunk => ({
          id: chunk.id,
          chunkIndex: chunk.chunk_index,
          content: chunk.content,
          startChar: chunk.start_char,
          endChar: chunk.end_char,
          tokenCount: chunk.token_count,
          embeddingId: chunk.embedding_id,
          createdAt: chunk.created_at,
        })),
        count: chunks.length,
      },
    });
  })
);

export default router;
