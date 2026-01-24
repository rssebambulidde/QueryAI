import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/errorHandler';
import { StorageService } from '../services/storage.service';
import { DocumentService } from '../services/document.service';
import { ExtractionService } from '../services/extraction.service';
import { ChunkService } from '../services/chunk.service';
import { PineconeService } from '../services/pinecone.service';
import { ValidationError } from '../types/error';
import logger from '../config/logger';
import { apiLimiter } from '../middleware/rateLimiter';
import { enforceDocumentUploadLimit, requireFeature } from '../middleware/subscription.middleware';

const router = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isAllowed =
      ALLOWED_MIME_TYPES.includes(file.mimetype) || ALLOWED_EXTENSIONS.includes(extension);
    if (!isAllowed) {
      return cb(new ValidationError('Unsupported file type. Allowed: PDF, TXT, MD, DOCX.'));
    }
    return cb(null, true);
  },
});

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File too large. Maximum size is 10MB.'));
      }
      return next(new ValidationError(err.message));
    }
    return next(err);
  });
};

/**
 * Helper function to determine file type from extension
 */
const getFileType = (fileName: string, mimeType: string): 'pdf' | 'docx' | 'txt' | 'md' => {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.pdf' || mimeType === 'application/pdf') return 'pdf';
  if (extension === '.docx' || mimeType.includes('wordprocessingml')) return 'docx';
  if (extension === '.md' || mimeType === 'text/markdown') return 'md';
  return 'txt'; // Default to txt
};

/**
 * POST /api/documents/upload
 * Upload a document to Supabase Storage and extract text
 */
router.post(
  '/upload',
  authenticate,
  requireFeature('documentUpload'),
  enforceDocumentUploadLimit,
  handleUpload,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    if (!req.file) {
      throw new ValidationError('File is required');
    }

    // Upload to storage
    const storedDoc = await StorageService.uploadDocument(userId, req.file);
    const fileType = getFileType(req.file.originalname, req.file.mimetype);

    // Create document record with appropriate status
    // If auto-processing is disabled, set status to 'stored' (ready for manual processing)
    const initialStatus = (req.query.autoExtract === 'true') ? 'processing' : 'stored';
    
    // Get topicId from form data if provided
    const topicId = req.body.topicId || undefined;
    
    // Validate topicId if provided
    if (topicId) {
      const { TopicService } = await import('../services/topic.service');
      const topic = await TopicService.getTopic(topicId, userId);
      if (!topic) {
        throw new ValidationError('Invalid topic ID');
      }
    }
    
    const document = await DocumentService.createDocument({
      user_id: userId,
      filename: storedDoc.name,
      file_path: storedDoc.path,
      file_type: fileType,
      file_size: storedDoc.size,
      status: initialStatus,
      topic_id: topicId,
    });

    logger.info('Document uploaded and record created', {
      userId,
      documentId: document.id,
      filePath: storedDoc.path,
      size: storedDoc.size,
    });

    // Log document upload for analytics
    try {
      const { DatabaseService } = await import('../services/database.service');
      await DatabaseService.logUsage(userId, 'document_upload', {
        documentId: document.id,
        filename: storedDoc.name,
        fileType: fileType,
        fileSize: storedDoc.size,
        topicId: topicId,
      });
    } catch (usageError: any) {
      logger.warn('Failed to log document upload usage', { error: usageError?.message });
    }

    // Check if auto-processing is enabled (default: false - user must manually trigger processing)
    const autoExtract = req.query.autoExtract === 'true';
    const autoEmbed = req.query.autoEmbed === 'true';

    // Trigger text extraction asynchronously (if enabled)
    if (autoExtract) {
      ExtractionService.extractText(req.file.buffer, fileType, req.file.originalname)
        .then(async (result) => {
        // Update document with extracted text
        await DocumentService.updateDocument(document.id, userId, {
          status: 'extracted',
          extracted_text: result.text,
          text_length: result.stats.length,
          metadata: {
            ...result.metadata,
            wordCount: result.stats.wordCount,
            pageCount: result.stats.pageCount,
            paragraphCount: result.stats.paragraphCount,
            tables: result.tables, // Store extracted tables
            tableCount: result.tables?.length || 0,
            images: result.images ? result.images.map(img => ({
              page: img.page,
              index: img.index,
              width: img.width,
              height: img.height,
              format: img.format,
              size: img.size,
            })) : undefined, // Store image metadata (not full data URLs)
            imageCount: result.images?.length || 0,
            ocr: result.ocrUsed || false, // Mark if OCR was used
          },
        });

        logger.info('Text extraction completed', {
          documentId: document.id,
          textLength: result.stats.length,
          wordCount: result.stats.wordCount,
          pageCount: result.stats.pageCount,
          tableCount: result.tables?.length || 0,
        });

        // Trigger embedding generation automatically after text extraction (if enabled)
        if (autoEmbed) {
          // This runs in the background and doesn't block
          const { EmbeddingService } = await import('../services/embedding.service');
          const { ChunkService } = await import('../services/chunk.service');

          EmbeddingService.processDocument(document.id, userId, result.text)
          .then(async ({ chunks, embeddings, metadata }) => {
            try {
              // Store chunks in database
              await ChunkService.createChunks(document.id, chunks);

              // Update document with embedding metadata
              await DocumentService.updateDocument(document.id, userId, {
                status: 'embedded',
                metadata: {
                  ...result.metadata,
                  wordCount: result.stats.wordCount,
                  pageCount: result.stats.pageCount,
                  paragraphCount: result.stats.paragraphCount,
                  tables: result.tables,
                  tableCount: result.tables?.length || 0,
                  images: result.images ? result.images.map(img => ({
                    page: img.page,
                    index: img.index,
                    width: img.width,
                    height: img.height,
                    format: img.format,
                    size: img.size,
                  })) : undefined,
                  imageCount: result.images?.length || 0,
                  ocr: result.ocrUsed || false,
                  embedding: metadata,
                  chunkCount: chunks.length,
                  embeddedAt: new Date().toISOString(),
                },
              });

              logger.info('Embedding generation completed automatically', {
                documentId: document.id,
                chunkCount: chunks.length,
                totalTokens: metadata.totalTokens,
              });
            } catch (embedError: any) {
              logger.error('Failed to store chunks after embedding', {
                documentId: document.id,
                error: embedError.message,
              });
              await DocumentService.updateDocument(document.id, userId, {
                status: 'embedding_failed',
                embedding_error: embedError.message || 'Failed to store chunks',
              });
            }
          })
          .catch(async (embedError: any) => {
            logger.warn('Automatic embedding generation failed (non-critical)', {
              documentId: document.id,
              error: embedError.message,
            });
            // Don't fail the document - embedding can be retried manually
            // Document status remains 'extracted'
          });
        }
      })
      .catch(async (error: any) => {
        // Update document with error status
        await DocumentService.updateDocument(document.id, userId, {
          status: 'failed',
          extraction_error: error.message || 'Extraction failed',
        });

        logger.error('Text extraction failed', {
          documentId: document.id,
          error: error.message,
        });
      });
    } else {
      // Auto-extract is disabled, just store the document
      logger.info('Document uploaded without auto-extraction', {
        documentId: document.id,
        userId,
      });
    }

    // Return immediately with processing status
    const message = autoExtract
      ? autoEmbed
        ? 'Document uploaded successfully. Text extraction and embedding in progress.'
        : 'Document uploaded successfully. Text extraction in progress.'
      : 'Document uploaded successfully. Use /api/documents/:id/extract to extract text manually.';

    res.status(201).json({
      success: true,
      message,
      data: {
        id: document.id,
        path: document.file_path,
        name: document.filename,
        size: document.file_size,
        mimeType: req.file.mimetype,
        status: initialStatus, // Use the status we set, not the document status (which might be default)
        autoExtract,
        autoEmbed,
        createdAt: document.created_at,
      },
    });
  })
);

/**
 * GET /api/documents
 * List documents for the current user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { status, topic_id, limit, offset } = req.query;

    try {
      // Try to get documents from database (Phase 2.3+)
      const documents = await DocumentService.listDocuments(userId, {
        status: status as 'processing' | 'extracted' | 'failed' | undefined,
        topic_id: topic_id as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      // Format response to match frontend expectations
      // Get chunk counts for all documents in parallel
      const documentsWithChunks = await Promise.all(
        documents.map(async (doc) => {
          let chunkCount = 0;
          try {
            chunkCount = await ChunkService.getChunkCount(doc.id);
          } catch (error) {
            // If chunks table doesn't exist or error, chunkCount remains 0
            logger.warn('Failed to get chunk count', { documentId: doc.id, error });
          }
          return {
            ...doc,
            chunkCount,
          };
        })
      );

      const formattedDocuments = documentsWithChunks.map((doc) => ({
        id: doc.id,
        path: doc.file_path,
        name: doc.filename,
        size: doc.file_size,
        mimeType: doc.file_type === 'pdf' ? 'application/pdf' :
                  doc.file_type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                  doc.file_type === 'md' ? 'text/markdown' : 'text/plain',
        status: doc.status,
        textLength: doc.text_length,
        chunkCount: doc.chunkCount,
        extractionError: doc.extraction_error,
        embeddingError: doc.embedding_error,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }));

      // Only merge Storage documents if database is empty (performance optimization)
      // This prevents slow loading when there are many documents
      if (formattedDocuments.length === 0) {
        try {
          const storageDocuments = await StorageService.listDocuments(userId);
          
          // Add Storage documents that aren't in database
          storageDocuments.forEach((storageDoc) => {
            // Determine file type from extension
            const extension = path.extname(storageDoc.name).toLowerCase();
            const fileType = extension === '.pdf' ? 'pdf' :
                            extension === '.docx' ? 'docx' :
                            extension === '.md' ? 'md' : 'txt';
            
            formattedDocuments.push({
              id: storageDoc.path, // Use path as ID for legacy documents
              path: storageDoc.path,
              name: storageDoc.name,
              size: storageDoc.size,
              mimeType: storageDoc.mimeType,
              status: 'extracted' as const, // Assume extracted for legacy documents
              textLength: undefined,
              chunkCount: 0, // Legacy documents don't have chunks
              extractionError: undefined,
              embeddingError: undefined,
              createdAt: storageDoc.createdAt || new Date().toISOString(),
              updatedAt: storageDoc.updatedAt || new Date().toISOString(),
            });
          });
        } catch (storageError: any) {
          // If StorageService fails, just use database documents
          logger.warn('Failed to get documents from Storage', {
            userId,
            error: storageError.message,
          });
        }
      }

      res.status(200).json({
        success: true,
        data: formattedDocuments,
      });
    } catch (error: any) {
      // Fallback to StorageService if documents table doesn't exist (pre-Phase 2.3)
      if (error.code === 'TABLE_NOT_FOUND' || 
          error.message === 'TABLE_NOT_FOUND' ||
          (error.message?.includes('relation') && error.message?.includes('does not exist'))) {
        logger.warn('Documents table not found, falling back to StorageService', {
          userId,
          error: error.message,
        });

        const storageDocuments = await StorageService.listDocuments(userId);
        
        // Format to match expected response structure
        const formattedDocuments = storageDocuments.map((doc) => ({
          id: doc.path, // Use path as ID for legacy documents
          path: doc.path,
          name: doc.name,
          size: doc.size,
          mimeType: doc.mimeType,
          status: 'extracted' as const, // Assume extracted for legacy documents
          textLength: undefined,
          chunkCount: 0, // Legacy documents don't have chunks
          extractionError: undefined,
          embeddingError: undefined,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }));

        res.status(200).json({
          success: true,
          data: formattedDocuments,
        });
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }
  })
);

/**
 * GET /api/documents/download
 * Download a document by path
 */
router.get(
  '/download',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { path: filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('File path is required');
    }

    if (!filePath.startsWith(`${userId}/`)) {
      throw new ValidationError('Invalid file path');
    }

    const fileData = await StorageService.downloadDocument(filePath);

    res.setHeader('Content-Type', fileData.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileData.name)}"`);
    res.setHeader('Content-Length', fileData.size);

    res.send(fileData.buffer);
  })
);

/**
 * GET /api/documents/:id/text
 * Get extracted text for a document
 */
router.get(
  '/:id/text',
  authenticate,
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

    const textData = await DocumentService.getDocumentText(documentId, userId);

    if (!textData) {
      throw new ValidationError('Document not found or text not extracted');
    }

    res.status(200).json({
      success: true,
      data: {
        documentId: documentId,
        text: textData.text,
        stats: textData.stats,
        extractedAt: textData.extractedAt,
      },
    });
  })
);

/**
 * POST /api/documents/:id/extract
 * Manually trigger text extraction for a document
 */
router.post(
  '/:id/extract',
  authenticate,
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

    // Download file from storage
    const fileData = await StorageService.downloadDocument(document.file_path);

    // Update status to processing
    await DocumentService.updateDocument(documentId, userId, {
      status: 'processing',
      extraction_error: undefined,
    });

    // Extract text
    ExtractionService.extractText(fileData.buffer, document.file_type, document.filename)
      .then(async (result) => {
        await DocumentService.updateDocument(documentId, userId, {
          status: 'extracted',
          extracted_text: result.text,
          text_length: result.stats.length,
          metadata: {
            ...result.metadata,
            wordCount: result.stats.wordCount,
            pageCount: result.stats.pageCount,
            paragraphCount: result.stats.paragraphCount,
          },
        });

        logger.info('Manual text extraction completed', {
          documentId: documentId,
          textLength: result.stats.length,
        });
      })
      .catch(async (error: any) => {
        await DocumentService.updateDocument(documentId, userId, {
          status: 'failed',
          extraction_error: error.message || 'Extraction failed',
        });

        logger.error('Manual text extraction failed', {
          documentId: documentId,
          error: error.message,
        });
      });

    res.status(200).json({
      success: true,
      message: 'Text extraction started',
      data: {
        documentId: documentId,
        status: 'processing',
      },
    });
  })
);

/**
 * POST /api/documents/:id/process
 * Manually trigger full processing (extraction + chunking + embedding) for a document
 */
router.post(
  '/:id/process',
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

    // Get chunking options from request body
    const { maxChunkSize, overlapSize } = req.body;
    const chunkingOptions: {
      maxChunkSize?: number;
      overlapSize?: number;
    } = {};
    
    if (maxChunkSize && typeof maxChunkSize === 'number' && maxChunkSize >= 100 && maxChunkSize <= 2000) {
      chunkingOptions.maxChunkSize = maxChunkSize;
    }
    if (overlapSize && typeof overlapSize === 'number' && overlapSize >= 0 && overlapSize <= 500) {
      chunkingOptions.overlapSize = overlapSize;
    }

    // Check if already processed
    if (document.status === 'processed' || document.status === 'embedded') {
      const chunkCount = await ChunkService.getChunkCount(documentId);
      if (chunkCount > 0) {
        res.status(200).json({
          success: true,
          message: 'Document is already processed',
          data: {
            documentId: documentId,
            status: document.status,
          },
        });
        return;
      }
    }

    // Step 1: Extract text if not already extracted
    if (!document.extracted_text || document.extracted_text.trim().length === 0) {
      // Download file from storage
      const fileData = await StorageService.downloadDocument(document.file_path);

      // Update status to processing
      await DocumentService.updateDocument(documentId, userId, {
        status: 'processing',
        extraction_error: undefined,
      });

      // Extract text
      ExtractionService.extractText(fileData.buffer, document.file_type, document.filename)
        .then(async (result) => {
          await DocumentService.updateDocument(documentId, userId, {
            status: 'extracted',
            extracted_text: result.text,
            text_length: result.stats.length,
            metadata: {
              ...result.metadata,
              wordCount: result.stats.wordCount,
              pageCount: result.stats.pageCount,
              paragraphCount: result.stats.paragraphCount,
            },
          });

          logger.info('Text extraction completed, starting embedding', {
            documentId: documentId,
            textLength: result.stats.length,
          });

          // Step 2: Generate embeddings after extraction
          const { EmbeddingService } = await import('../services/embedding.service');

          await DocumentService.updateDocument(documentId, userId, {
            status: 'embedding',
            embedding_error: undefined,
          });

          EmbeddingService.processDocument(documentId, userId, result.text, chunkingOptions)
            .then(async ({ chunks, embeddings, metadata }) => {
              // Delete existing chunks and vectors before creating new ones
              try {
                // Delete existing Pinecone vectors
                await PineconeService.deleteDocumentVectors(documentId);
                await ChunkService.deleteChunksByDocument(documentId);
              } catch (error: any) {
                logger.warn('No existing chunks to delete or error deleting', { documentId, error: error.message });
              }
              
              // Step 1: Create chunks in database to get chunk IDs
              const createdChunks = await ChunkService.createChunks(documentId, chunks);
              
              // Step 2: Store embeddings in Pinecone
              try {
                const document = await DocumentService.getDocument(documentId, userId);
                
                // Check if Pinecone is configured
                const { isPineconeConfigured } = await import('../config/pinecone');
                if (!isPineconeConfigured()) {
                  logger.warn('Pinecone not configured, skipping vector storage', {
                    documentId,
                  });
                } else {
                  logger.info('Storing vectors in Pinecone', {
                    documentId,
                    chunkCount: createdChunks.length,
                    embeddingCount: embeddings.length,
                  });

                  const vectorIds = await PineconeService.upsertVectors(
                    documentId,
                    createdChunks.map(chunk => ({
                      id: chunk.id,
                      chunkIndex: chunk.chunk_index,
                      content: chunk.content,
                    })),
                    embeddings,
                    userId,
                    document?.topic_id || undefined
                  );

                  logger.info('Vectors stored in Pinecone successfully', {
                    documentId,
                    vectorCount: vectorIds.length,
                  });
                }
              } catch (error: any) {
                logger.error('Failed to store vectors in Pinecone', {
                  documentId,
                  error: error.message,
                  errorStack: error.stack,
                  errorCode: error.code,
                });
                // Continue even if Pinecone fails - chunks are still stored
                // But log the error so user knows vectors weren't stored
              }
              
              await DocumentService.updateDocument(documentId, userId, {
                status: 'processed',
                metadata: {
                  ...result.metadata,
                  wordCount: result.stats.wordCount,
                  pageCount: result.stats.pageCount,
                  paragraphCount: result.stats.paragraphCount,
                  embedding: metadata,
                  chunkCount: chunks.length,
                  embeddedAt: new Date().toISOString(),
                },
              });

              logger.info('Document processing completed', {
                documentId: documentId,
                chunkCount: chunks.length,
              });
            })
            .catch(async (error: any) => {
              await DocumentService.updateDocument(documentId, userId, {
                status: 'embedding_failed',
                embedding_error: error.message || 'Embedding generation failed',
              });

              logger.error('Embedding generation failed', {
                documentId: documentId,
                error: error.message,
              });
            });
        })
        .catch(async (error: any) => {
          await DocumentService.updateDocument(documentId, userId, {
            status: 'failed',
            extraction_error: error.message || 'Extraction failed',
          });

          logger.error('Text extraction failed', {
            documentId: documentId,
            error: error.message,
          });
        });
    } else {
      // Text already extracted, just generate embeddings
      await DocumentService.updateDocument(documentId, userId, {
        status: 'embedding',
        embedding_error: undefined,
      });

      const { EmbeddingService } = await import('../services/embedding.service');

      EmbeddingService.processDocument(documentId, userId, document.extracted_text, chunkingOptions)
        .then(async ({ chunks, embeddings, metadata }) => {
          // Delete existing chunks and vectors before creating new ones
          try {
            // Delete existing Pinecone vectors
            await PineconeService.deleteDocumentVectors(documentId);
            await ChunkService.deleteChunksByDocument(documentId);
          } catch (error: any) {
            logger.warn('No existing chunks to delete or error deleting', { documentId, error: error.message });
          }
          
          // Step 1: Create chunks in database to get chunk IDs
          const createdChunks = await ChunkService.createChunks(documentId, chunks);
          
          // Step 2: Store embeddings in Pinecone
          try {
            const vectorIds = await PineconeService.upsertVectors(
              documentId,
              createdChunks.map(chunk => ({
                id: chunk.id,
                chunkIndex: chunk.chunk_index,
                content: chunk.content,
              })),
              embeddings,
              userId,
              document?.topic_id || undefined
            );

            logger.info('Vectors stored in Pinecone', {
              documentId,
              vectorCount: vectorIds.length,
            });
          } catch (error: any) {
            logger.error('Failed to store vectors in Pinecone', {
              documentId,
              error: error.message,
            });
            // Continue even if Pinecone fails - chunks are still stored
          }
          
          await DocumentService.updateDocument(documentId, userId, {
            status: 'processed',
            metadata: {
              ...document.metadata,
              embedding: metadata,
              chunkCount: chunks.length,
              embeddedAt: new Date().toISOString(),
            },
          });

          logger.info('Document processing completed', {
            documentId: documentId,
            chunkCount: chunks.length,
          });
        })
        .catch(async (error: any) => {
          await DocumentService.updateDocument(documentId, userId, {
            status: 'embedding_failed',
            embedding_error: error.message || 'Embedding generation failed',
          });

          logger.error('Embedding generation failed', {
            documentId: documentId,
            error: error.message,
          });
        });
    }

    res.status(200).json({
      success: true,
      message: 'Document processing started (extraction + chunking + embedding)',
      data: {
        documentId: documentId,
        status: document.extracted_text ? 'embedding' : 'processing',
      },
    });
  })
);

/**
 * POST /api/documents/batch-extract
 * Manually trigger text extraction for multiple documents
 */
router.post(
  '/batch-extract',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { documentIds, autoEmbed } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      throw new ValidationError('documentIds array is required');
    }

    if (documentIds.length > 50) {
      throw new ValidationError('Maximum 50 documents can be processed at once');
    }

    const results: Array<{
      documentId: string;
      success: boolean;
      message: string;
    }> = [];

    // Process each document
    for (const documentId of documentIds) {
      try {
        const document = await DocumentService.getDocument(documentId, userId);
        if (!document) {
          results.push({
            documentId,
            success: false,
            message: 'Document not found',
          });
          continue;
        }

        // Check if already extracted
        if (document.extracted_text && document.extracted_text.trim().length > 0) {
          results.push({
            documentId,
            success: true,
            message: 'Document already has extracted text',
          });

          // If autoEmbed is true and not already embedded, trigger embedding
          if (autoEmbed && document.status !== 'embedded') {
            const { EmbeddingService } = await import('../services/embedding.service');
            const { ChunkService } = await import('../services/chunk.service');

            EmbeddingService.processDocument(documentId, userId, document.extracted_text)
              .then(async ({ chunks, embeddings, metadata }) => {
                await ChunkService.createChunks(documentId, chunks);
                await DocumentService.updateDocument(documentId, userId, {
                  status: 'embedded',
                  metadata: {
                    ...document.metadata,
                    embedding: metadata,
                    chunkCount: chunks.length,
                    embeddedAt: new Date().toISOString(),
                  },
                });
              })
              .catch(async (error: any) => {
                logger.error('Batch embedding failed', { documentId, error: error.message });
              });
          }
          continue;
        }

        // Download file from storage
        const fileData = await StorageService.downloadDocument(document.file_path);

        // Update status to processing
        await DocumentService.updateDocument(documentId, userId, {
          status: 'processing',
          extraction_error: undefined,
        });

        // Extract text
        const fileType = document.file_type;
        ExtractionService.extractText(fileData.buffer, fileType, document.filename)
          .then(async (result) => {
            await DocumentService.updateDocument(documentId, userId, {
              status: 'extracted',
              extracted_text: result.text,
              text_length: result.stats.length,
              metadata: {
                ...result.metadata,
                wordCount: result.stats.wordCount,
                pageCount: result.stats.pageCount,
                paragraphCount: result.stats.paragraphCount,
              },
            });

            // Auto-embed if requested
            if (autoEmbed) {
              const { EmbeddingService } = await import('../services/embedding.service');

              EmbeddingService.processDocument(documentId, userId, result.text)
                .then(async ({ chunks, embeddings, metadata }) => {
                  await ChunkService.createChunks(documentId, chunks);
                  await DocumentService.updateDocument(documentId, userId, {
                    status: 'embedded',
                    metadata: {
                      ...result.metadata,
                      wordCount: result.stats.wordCount,
                      pageCount: result.stats.pageCount,
                      paragraphCount: result.stats.paragraphCount,
                      embedding: metadata,
                      chunkCount: chunks.length,
                      embeddedAt: new Date().toISOString(),
                    },
                  });
                })
                .catch(async (error: any) => {
                  logger.error('Batch embedding failed', { documentId, error: error.message });
                });
            }
          })
          .catch(async (error: any) => {
            await DocumentService.updateDocument(documentId, userId, {
              status: 'failed',
              extraction_error: error.message || 'Extraction failed',
            });
          });

        results.push({
          documentId,
          success: true,
          message: 'Extraction started',
        });
      } catch (error: any) {
        results.push({
          documentId,
          success: false,
          message: error.message || 'Failed to process document',
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processing ${results.length} document(s)`,
      data: {
        results,
        total: results.length,
        started: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  })
);

/**
 * POST /api/documents/batch-embed
 * Manually trigger embedding generation for multiple extracted documents
 */
router.post(
  '/batch-embed',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      throw new ValidationError('documentIds array is required');
    }

    if (documentIds.length > 50) {
      throw new ValidationError('Maximum 50 documents can be processed at once');
    }

    const results: Array<{
      documentId: string;
      success: boolean;
      message: string;
    }> = [];

    // Process each document
    for (const documentId of documentIds) {
      try {
        const document = await DocumentService.getDocument(documentId, userId);
        if (!document) {
          results.push({
            documentId,
            success: false,
            message: 'Document not found',
          });
          continue;
        }

        // Check if text is extracted
        if (!document.extracted_text || document.extracted_text.trim().length === 0) {
          results.push({
            documentId,
            success: false,
            message: 'Document text must be extracted before generating embeddings',
          });
          continue;
        }

        // Check if already embedded
        const chunkCount = await ChunkService.getChunkCount(documentId);
        if (document.status === 'embedded' && chunkCount > 0) {
          results.push({
            documentId,
            success: true,
            message: 'Document already has embeddings',
          });
          continue;
        }

        // Update status to embedding
        await DocumentService.updateDocument(documentId, userId, {
          status: 'embedding',
          embedding_error: undefined,
        });

        // Trigger embedding generation
        const { EmbeddingService } = await import('../services/embedding.service');

        EmbeddingService.processDocument(documentId, userId, document.extracted_text)
          .then(async ({ chunks, embeddings, metadata }) => {
            await ChunkService.createChunks(documentId, chunks);
            await DocumentService.updateDocument(documentId, userId, {
              status: 'embedded',
              metadata: {
                ...document.metadata,
                embedding: metadata,
                chunkCount: chunks.length,
                embeddedAt: new Date().toISOString(),
              },
            });
          })
          .catch(async (error: any) => {
            await DocumentService.updateDocument(documentId, userId, {
              status: 'embedding_failed',
              embedding_error: error.message || 'Embedding generation failed',
            });
          });

        results.push({
          documentId,
          success: true,
          message: 'Embedding generation started',
        });
      } catch (error: any) {
        results.push({
          documentId,
          success: false,
          message: error.message || 'Failed to process document',
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processing ${results.length} document(s)`,
      data: {
        results,
        total: results.length,
        started: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  })
);

/**
 * POST /api/documents/:id/clear-processing
 * Clear processing data (extracted text, chunks, embeddings) but keep the document in storage
 */
router.post(
  '/:id/clear-processing',
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

    // Delete all chunks and Pinecone vectors
    try {
      // Get chunk IDs before deleting chunks (for more reliable vector deletion)
      const chunks = await ChunkService.getChunksByDocument(documentId, userId);
      const chunkIds = chunks.map(chunk => chunk.id);
      
      // Delete Pinecone vectors using chunk IDs
      await PineconeService.deleteDocumentVectors(documentId, chunkIds);
      
      // Delete chunks from database
      await ChunkService.deleteChunksByDocument(documentId);
      
      logger.info('Processing data cleared', {
        documentId,
        chunkCount: chunks.length,
      });
    } catch (error: any) {
      // If chunks don't exist, that's okay - just log and continue
      logger.warn('No chunks to delete or chunks table not found', { documentId, error: error.message });
    }

    // Clear extracted text and reset status to 'stored'
    // Use null explicitly to clear fields in database
    const updateData: any = {
      status: 'stored',
      extracted_text: null,
      text_length: null,
      extraction_error: null,
      embedding_error: null,
      metadata: {
        // Keep file metadata but clear processing metadata
        fileType: document.file_type,
        fileName: document.filename,
      },
    };
    
    await DocumentService.updateDocument(documentId, userId, updateData);

    logger.info('Processing data cleared for document', {
      documentId,
      userId,
      filename: document.filename,
    });

    res.status(200).json({
      success: true,
      message: 'Processing data cleared successfully. Document remains in storage.',
      data: {
        documentId,
        status: 'stored',
      },
    });
  })
);

/**
 * POST /api/documents/sync
 * Sync existing Storage documents to database (migrate pre-Phase 2.3 documents)
 */
router.post(
  '/sync',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    try {
      // Get all documents from Storage
      const storageDocuments = await StorageService.listDocuments(userId);
      
      if (storageDocuments.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No documents to sync',
          data: { synced: 0, skipped: 0 },
        });
      }

      let synced = 0;
      let skipped = 0;

      // For each Storage document, check if it exists in database
      for (const storageDoc of storageDocuments) {
        try {
          // Check if document already exists in database
          const existing = await DocumentService.getDocumentByPath(storageDoc.path, userId);
          
          if (existing) {
            skipped++;
            continue;
          }

          // Determine file type from extension
          const extension = path.extname(storageDoc.name).toLowerCase();
          const fileType = extension === '.pdf' ? 'pdf' :
                          extension === '.docx' ? 'docx' :
                          extension === '.md' ? 'md' : 'txt';

          // Create document record
          await DocumentService.createDocument({
            user_id: userId,
            filename: storageDoc.name,
            file_path: storageDoc.path,
            file_type: fileType,
            file_size: storageDoc.size,
          });

          synced++;
        } catch (error: any) {
          logger.error('Failed to sync document', {
            userId,
            path: storageDoc.path,
            error: error.message,
          });
          skipped++;
        }
      }

      logger.info('Document sync completed', {
        userId,
        synced,
        skipped,
        total: storageDocuments.length,
      });

      return res.status(200).json({
        success: true,
        message: `Synced ${synced} document(s), skipped ${skipped}`,
        data: { synced, skipped, total: storageDocuments.length },
      });
    } catch (error: any) {
      // If table doesn't exist, return helpful message
      if (error.code === 'TABLE_NOT_FOUND' || 
          error.message === 'TABLE_NOT_FOUND' ||
          (error.message?.includes('relation') && error.message?.includes('does not exist'))) {
        throw new ValidationError(
          'Documents table not found. Please run the database migration first: ' +
          'backend/src/database/migrations/003_documents_text_extraction.sql'
        );
      }
      // Re-throw other errors (will be handled by errorHandler middleware)
      throw error;
    }
  })
);

/**
 * DELETE /api/documents
 * Delete a document by path (from both storage and database)
 */
router.delete(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const { path: filePath, id } = req.body;

    // If ID is provided, delete by ID (preferred)
    if (id && typeof id === 'string') {
      try {
        const document = await DocumentService.getDocument(id, userId);
        if (!document) {
          throw new ValidationError('Document not found');
        }

        // Delete chunks and Pinecone vectors first (if they exist)
        try {
          await PineconeService.deleteDocumentVectors(id);
          await ChunkService.deleteChunksByDocument(id);
        } catch (chunkError: any) {
          // If chunks don't exist, that's okay - just log and continue
          logger.warn('No chunks to delete or chunks table not found', { documentId: id, error: chunkError.message });
        }

        // Delete from storage
        try {
          await StorageService.deleteDocument(userId, document.file_path);
        } catch (storageError: any) {
          // If file doesn't exist in storage, that's okay - just log and continue
          logger.warn('File not found in storage, continuing with database deletion', { 
            filePath: document.file_path, 
            error: storageError.message 
          });
        }

        // Delete from database
        await DocumentService.deleteDocument(id, userId);

        res.status(200).json({
          success: true,
          message: 'Document deleted successfully',
        });
        return;
      } catch (error: any) {
        if (error instanceof ValidationError) {
          throw error;
        }
        logger.error('Error deleting document by ID', { id, userId, error: error.message });
        throw new ValidationError('Failed to delete document: ' + error.message);
      }
    }

    // Fallback: delete by path (legacy support)
    if (!filePath || typeof filePath !== 'string') {
      throw new ValidationError('File path or document ID is required');
    }

    try {
      // Find document by path
      const document = await DocumentService.getDocumentByPath(filePath, userId);
      if (document) {
        // Delete chunks and Pinecone vectors first (if they exist)
        try {
          await PineconeService.deleteDocumentVectors(document.id);
          await ChunkService.deleteChunksByDocument(document.id);
        } catch (chunkError: any) {
          logger.warn('No chunks to delete', { documentId: document.id, error: chunkError.message });
        }

        // Delete from database
        await DocumentService.deleteDocument(document.id, userId);
      }

      // Delete from storage (even if not in database)
      try {
        await StorageService.deleteDocument(userId, filePath);
      } catch (storageError: any) {
        // If file doesn't exist in storage, that's okay if we already deleted from database
        if (document) {
          logger.warn('File not found in storage, but database record deleted', { 
            filePath, 
            error: storageError.message 
          });
        } else {
          throw new ValidationError('Document not found in storage or database');
        }
      }
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error deleting document by path', { filePath, userId, error: error.message });
      throw new ValidationError('Failed to delete document: ' + error.message);
    }

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  })
);

export default router;
