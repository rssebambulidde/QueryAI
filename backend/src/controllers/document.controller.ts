/**
 * Document Controller
 *
 * Express request handlers for the /api/documents routes.
 * Each exported function is a thin adapter that validates input, calls
 * business-logic services, and sends the HTTP response.
 */

import { Request, Response } from 'express';
import path from 'path';
import { StorageService } from '../services/storage.service';
import { DocumentService } from '../services/document.service';
import { ChunkService } from '../services/chunk.service';
import { ValidationError } from '../types/error';
import logger from '../config/logger';
import { assertUUID } from '../validation/uuid';
import {
  getFileType,
  parseChunkingOptions,
  runExtraction,
  runEmbedding,
  runFullProcessing,
  clearProcessingData,
  deleteDocumentFully,
  syncStorageDocuments,
} from '../services/document-processing.service';
import { ProcessingProgressService } from '../services/processing-progress.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract `userId` from the authenticated request or throw. */
function requireUserId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) throw new ValidationError('User not authenticated');
  return userId;
}

/** Normalise the `:id` param (express can return string | string[]). */
function requireDocumentId(req: Request): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) throw new ValidationError('Document ID is required');
  return id;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/documents/upload
 *
 * Upload a document to Supabase Storage, create a DB record, and optionally
 * kick off asynchronous text extraction + embedding.
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  if (!req.file) throw new ValidationError('File is required');

  const storedDoc = await StorageService.uploadDocument(userId, req.file);
  const fileType = getFileType(req.file.originalname, req.file.mimetype);

  const initialStatus = req.query.autoExtract === 'true' ? 'processing' : 'stored';
  const topicId = req.body.topicId ? assertUUID(req.body.topicId, 'topicId') : undefined;

  if (topicId) {
    const { TopicService } = await import('../services/topic.service');
    const topic = await TopicService.getTopic(topicId, userId);
    if (!topic) throw new ValidationError('Invalid topic ID');
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

  // Analytics
  try {
    const { DatabaseService } = await import('../services/database.service');
    await DatabaseService.logUsage(userId, 'document_upload', {
      documentId: document.id,
      filename: storedDoc.name,
      fileType,
      fileSize: storedDoc.size,
      topicId,
    });
  } catch (err: any) {
    logger.warn('Failed to log document upload usage', { error: err?.message });
  }

  const autoExtract = req.query.autoExtract === 'true';
  const autoEmbed = req.query.autoEmbed === 'true';

  if (autoExtract) {
    // Fire-and-forget
    runExtraction(document.id, userId, req.file.buffer, fileType, req.file.originalname, autoEmbed).catch(() => {});
  } else {
    logger.info('Document uploaded without auto-extraction', { documentId: document.id, userId });
  }

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
      status: initialStatus,
      autoExtract,
      autoEmbed,
      createdAt: document.created_at,
    },
  });
}

/**
 * GET /api/documents
 *
 * List documents for the authenticated user, with optional status / topic
 * filters. Falls back to Storage-only listing for pre-migration databases.
 */
export async function getDocuments(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { status, topic_id, limit, offset } = req.query;

  try {
    const documents = await DocumentService.listDocuments(userId, {
      status: status as 'processing' | 'extracted' | 'failed' | undefined,
      topic_id: topic_id as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    const documentsWithChunks = await Promise.all(
      documents.map(async (doc) => {
        let chunkCount = 0;
        try { chunkCount = await ChunkService.getChunkCount(doc.id); } catch { /* ignore */ }
        return { ...doc, chunkCount };
      }),
    );

    const formattedDocuments: any[] = documentsWithChunks.map((doc) => ({
      id: doc.id,
      path: doc.file_path,
      name: doc.filename,
      size: doc.file_size,
      mimeType:
        doc.file_type === 'pdf' ? 'application/pdf'
        : doc.file_type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : doc.file_type === 'md' ? 'text/markdown'
        : 'text/plain',
      status: doc.status,
      textLength: doc.text_length,
      chunkCount: doc.chunkCount,
      extractionError: doc.extraction_error,
      embeddingError: doc.embedding_error,
      createdAt: doc.created_at,
      updatedAt: doc.updated_at,
    }));

    // Merge legacy Storage documents when DB is empty
    if (formattedDocuments.length === 0) {
      try {
        const storageDocuments = await StorageService.listDocuments(userId);
        for (const storageDoc of storageDocuments) {
          const ext = path.extname(storageDoc.name).toLowerCase();
          formattedDocuments.push({
            id: storageDoc.path,
            path: storageDoc.path,
            name: storageDoc.name,
            size: storageDoc.size,
            mimeType: storageDoc.mimeType,
            status: 'extracted' as const,
            textLength: undefined,
            chunkCount: 0,
            extractionError: undefined,
            embeddingError: undefined,
            createdAt: storageDoc.createdAt || new Date().toISOString(),
            updatedAt: storageDoc.updatedAt || new Date().toISOString(),
          });
        }
      } catch (storageError: any) {
        logger.warn('Failed to get documents from Storage', { userId, error: storageError.message });
      }
    }

    res.status(200).json({ success: true, data: formattedDocuments });
  } catch (error: any) {
    // Fallback for pre-Phase 2.3 databases
    if (
      error.code === 'TABLE_NOT_FOUND' ||
      error.message === 'TABLE_NOT_FOUND' ||
      (error.message?.includes('relation') && error.message?.includes('does not exist'))
    ) {
      logger.warn('Documents table not found, falling back to StorageService', { userId, error: error.message });
      const storageDocuments = await StorageService.listDocuments(userId);
      const formatted = storageDocuments.map((doc) => ({
        id: doc.path,
        path: doc.path,
        name: doc.name,
        size: doc.size,
        mimeType: doc.mimeType,
        status: 'extracted' as const,
        textLength: undefined,
        chunkCount: 0,
        extractionError: undefined,
        embeddingError: undefined,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }));
      res.status(200).json({ success: true, data: formatted });
    } else {
      throw error;
    }
  }
}

/**
 * GET /api/documents/download
 *
 * Download a document by its storage path (query param `path`).
 */
export async function downloadDocument(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const filePath = req.query.path;
  if (!filePath || typeof filePath !== 'string') throw new ValidationError('File path is required');
  if (!filePath.startsWith(`${userId}/`)) throw new ValidationError('Invalid file path');

  const fileData = await StorageService.downloadDocument(filePath);
  res.setHeader('Content-Type', fileData.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileData.name)}"`);
  res.setHeader('Content-Length', fileData.size);
  res.send(fileData.buffer);
}

/**
 * GET /api/documents/:id/text
 *
 * Return the extracted text and stats for a single document.
 */
export async function getDocumentText(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const documentId = requireDocumentId(req);

  const textData = await DocumentService.getDocumentText(documentId, userId);
  if (!textData) throw new ValidationError('Document not found or text not extracted');

  res.status(200).json({
    success: true,
    data: { documentId, text: textData.text, stats: textData.stats, extractedAt: textData.extractedAt },
  });
}

/**
 * PATCH /api/documents/:id
 *
 * Update document metadata and/or filename.
 */
export async function updateDocumentMetadata(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const documentId = requireDocumentId(req);

  const { metadata, filename } = req.body;
  const updates: Record<string, any> = {};
  if (metadata !== undefined && typeof metadata === 'object') updates.metadata = metadata;
  if (filename !== undefined && typeof filename === 'string' && filename.trim()) updates.filename = filename.trim();
  if (Object.keys(updates).length === 0) throw new ValidationError('No valid updates provided (metadata or filename)');

  const existing = await DocumentService.getDocument(documentId, userId);
  if (!existing) throw new ValidationError('Document not found');

  await DocumentService.updateDocument(documentId, userId, updates);
  const updated = await DocumentService.getDocument(documentId, userId);

  res.status(200).json({
    success: true,
    message: 'Metadata saved',
    data: { id: updated?.id, filename: updated?.filename, metadata: updated?.metadata },
  });
}

/**
 * POST /api/documents/:id/extract
 *
 * Manually trigger text extraction for one document (fire-and-forget).
 */
export async function extractDocument(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const documentId = requireDocumentId(req);

  const document = await DocumentService.getDocument(documentId, userId);
  if (!document) throw new ValidationError('Document not found');

  const fileData = await StorageService.downloadDocument(document.file_path);

  await DocumentService.updateDocument(documentId, userId, { status: 'processing', extraction_error: undefined });

  // Fire-and-forget
  runExtraction(documentId, userId, fileData.buffer, document.file_type, document.filename, false).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'Text extraction started',
    data: { documentId, status: 'processing' },
  });
}

/**
 * POST /api/documents/:id/process
 *
 * Full processing pipeline: extract (if needed) → chunk → embed.
 */
export async function processDocument(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const documentId = requireDocumentId(req);

  const document = await DocumentService.getDocument(documentId, userId);
  if (!document) throw new ValidationError('Document not found');

  const chunkingOptions = parseChunkingOptions(req.body);

  // Already processed?
  if (document.status === 'processed' || document.status === 'embedded') {
    const chunkCount = await ChunkService.getChunkCount(documentId);
    if (chunkCount > 0) {
      res.status(200).json({
        success: true,
        message: 'Document is already processed',
        data: { documentId, status: document.status },
      });
      return;
    }
  }

  // Fire-and-forget
  runFullProcessing(documentId, userId, document, chunkingOptions).catch(() => {});

  res.status(200).json({
    success: true,
    message: 'Document processing started (extraction + chunking + embedding)',
    data: { documentId, status: document.extracted_text ? 'embedding' : 'processing' },
  });
}

/**
 * POST /api/documents/batch-extract
 *
 * Trigger text extraction (+ optional embedding) for up to 50 documents.
 */
export async function batchExtract(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { documentIds, autoEmbed } = req.body;

  if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
    throw new ValidationError('documentIds array is required');
  }
  if (documentIds.length > 50) throw new ValidationError('Maximum 50 documents can be processed at once');

  const results: Array<{ documentId: string; success: boolean; message: string }> = [];

  for (const documentId of documentIds) {
    try {
      const document = await DocumentService.getDocument(documentId, userId);
      if (!document) { results.push({ documentId, success: false, message: 'Document not found' }); continue; }

      if (document.extracted_text && document.extracted_text.trim().length > 0) {
        results.push({ documentId, success: true, message: 'Document already has extracted text' });

        if (autoEmbed && document.status !== 'embedded') {
          runEmbedding(documentId, userId, document.extracted_text, {}, document.metadata || {}).catch(() => {});
        }
        continue;
      }

      const fileData = await StorageService.downloadDocument(document.file_path);
      await DocumentService.updateDocument(documentId, userId, { status: 'processing', extraction_error: undefined });

      runExtraction(documentId, userId, fileData.buffer, document.file_type, document.filename, !!autoEmbed).catch(() => {});

      results.push({ documentId, success: true, message: 'Extraction started' });
    } catch (error: any) {
      results.push({ documentId, success: false, message: error.message || 'Failed to process document' });
    }
  }

  res.status(200).json({
    success: true,
    message: `Processing ${results.length} document(s)`,
    data: {
      results,
      total: results.length,
      started: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
  });
}

/**
 * POST /api/documents/batch-embed
 *
 * Trigger embedding generation for up to 50 already-extracted documents.
 */
export async function batchEmbed(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const { documentIds } = req.body;

  if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
    throw new ValidationError('documentIds array is required');
  }
  if (documentIds.length > 50) throw new ValidationError('Maximum 50 documents can be processed at once');

  const results: Array<{ documentId: string; success: boolean; message: string }> = [];

  for (const documentId of documentIds) {
    try {
      const document = await DocumentService.getDocument(documentId, userId);
      if (!document) { results.push({ documentId, success: false, message: 'Document not found' }); continue; }

      if (!document.extracted_text || document.extracted_text.trim().length === 0) {
        results.push({ documentId, success: false, message: 'Document text must be extracted before generating embeddings' });
        continue;
      }

      const chunkCount = await ChunkService.getChunkCount(documentId);
      if (document.status === 'embedded' && chunkCount > 0) {
        results.push({ documentId, success: true, message: 'Document already has embeddings' });
        continue;
      }

      await DocumentService.updateDocument(documentId, userId, { status: 'embedding', embedding_error: undefined });

      runEmbedding(documentId, userId, document.extracted_text, {}, document.metadata || {}).catch(() => {});

      results.push({ documentId, success: true, message: 'Embedding generation started' });
    } catch (error: any) {
      results.push({ documentId, success: false, message: error.message || 'Failed to process document' });
    }
  }

  res.status(200).json({
    success: true,
    message: `Processing ${results.length} document(s)`,
    data: {
      results,
      total: results.length,
      started: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    },
  });
}

/**
 * POST /api/documents/:id/clear-processing
 *
 * Remove extracted text, chunks, embeddings — reset status to 'stored'.
 */
export async function clearDocumentProcessing(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const documentId = requireDocumentId(req);

  const document = await DocumentService.getDocument(documentId, userId);
  if (!document) throw new ValidationError('Document not found');

  await clearProcessingData(documentId, userId, document);

  res.status(200).json({
    success: true,
    message: 'Processing data cleared successfully. Document remains in storage.',
    data: { documentId, status: 'stored' },
  });
}

/**
 * POST /api/documents/sync
 *
 * Sync legacy Supabase Storage documents into the documents table.
 */
export async function syncDocuments(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);

  try {
    const { synced, skipped, total } = await syncStorageDocuments(userId);
    res.status(200).json({
      success: true,
      message: `Synced ${synced} document(s), skipped ${skipped}`,
      data: { synced, skipped, total },
    });
  } catch (error: any) {
    if (
      error.code === 'TABLE_NOT_FOUND' ||
      error.message === 'TABLE_NOT_FOUND' ||
      (error.message?.includes('relation') && error.message?.includes('does not exist'))
    ) {
      throw new ValidationError(
        'Documents table not found. Please run the database migration first: ' +
          'backend/src/database/migrations/003_documents_text_extraction.sql',
      );
    }
    throw error;
  }
}

/**
 * DELETE /api/documents
 *
 * Delete a document by ID (preferred) or legacy file path.
 * Removes storage file, DB record, chunks, Pinecone vectors, and cache.
 */
export async function deleteDocument(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);

  const { path: filePathBody, id: idBody } = req.body || {};
  const pathFromQuery = typeof req.query.path === 'string' ? req.query.path : undefined;
  const idFromQuery = typeof req.query.id === 'string' ? req.query.id : undefined;
  const filePath = filePathBody ?? pathFromQuery;
  const id = idBody ?? idFromQuery;

  // ── Delete by ID (preferred) ───────────────────────────────────────────
  if (id && typeof id === 'string') {
    const document = await DocumentService.getDocument(id, userId);
    if (!document) throw new ValidationError('Document not found');

    await deleteDocumentFully(id, userId, document.file_path);

    res.status(200).json({ success: true, message: 'Document deleted successfully' });
    return;
  }

  // ── Fallback: delete by path (legacy) ──────────────────────────────────
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError('File path or document ID is required');
  }

  try {
    const document = await DocumentService.getDocumentByPath(filePath, userId);
    if (document) {
      await deleteDocumentFully(document.id, userId, filePath);
    } else {
      // Not in DB — try storage only
      await StorageService.deleteDocument(userId, filePath);
    }
  } catch (error: any) {
    if (error instanceof ValidationError) throw error;
    logger.error('Error deleting document by path', { filePath, userId, error: error.message });
    throw new ValidationError('Failed to delete document: ' + error.message);
  }

  res.status(200).json({ success: true, message: 'Document deleted successfully' });
}

// ---------------------------------------------------------------------------
// Processing status
// ---------------------------------------------------------------------------

/**
 * GET /api/documents/:id/status
 *
 * Returns the real-time processing progress for a document.
 * Combines in-memory stage tracking with the persisted document status.
 */
export async function getDocumentStatus(req: Request, res: Response): Promise<void> {
  const userId = requireUserId(req);
  const documentId = requireDocumentId(req);

  const document = await DocumentService.getDocument(documentId, userId);
  if (!document) throw new ValidationError('Document not found');

  const progress = ProcessingProgressService.getProgress(documentId);

  res.status(200).json({
    success: true,
    data: {
      documentId,
      status: document.status,
      // In-memory progress (null when not actively processing)
      processing: progress
        ? {
            stage: progress.stage,
            progressPercent: progress.progressPercent,
            stageLabel: progress.stageLabel,
            startedAt: progress.startedAt,
            error: progress.error,
            failedStage: progress.failedStage,
            stages: progress.stages,
          }
        : null,
      // Persisted error info from documents table
      extractionError: (document as any).extraction_error || null,
      embeddingError: (document as any).embedding_error || null,
    },
  });
}
