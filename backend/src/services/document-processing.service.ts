/**
 * Document Processing Service
 *
 * Business logic extracted from documents.routes.ts.
 * Handles: text extraction, embedding generation, Pinecone vector storage,
 * batch operations, cache invalidation, and legacy document syncing.
 */

import path from 'path';
import { DocumentService } from './document.service';
import { StorageService } from './storage.service';
import { ExtractionService } from './extraction.service';
import { ChunkService } from './chunk.service';
import { PineconeService } from './pinecone.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { ProcessingProgressService } from './processing-progress.service';
import logger from '../config/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
}

export type FileType = 'pdf' | 'docx' | 'txt' | 'md';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a canonical FileType from filename + MIME type. */
export function getFileType(fileName: string, mimeType: string): FileType {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf' || mimeType === 'application/pdf') return 'pdf';
  if (ext === '.docx' || mimeType.includes('wordprocessingml')) return 'docx';
  if (ext === '.md' || mimeType === 'text/markdown') return 'md';
  return 'txt';
}

/** Validate & clamp user-supplied chunking options. */
export function parseChunkingOptions(body: any): ChunkingOptions {
  const opts: ChunkingOptions = {};
  if (body?.maxChunkSize && typeof body.maxChunkSize === 'number' && body.maxChunkSize >= 100 && body.maxChunkSize <= 2000) {
    opts.maxChunkSize = body.maxChunkSize;
  }
  if (body?.overlapSize && typeof body.overlapSize === 'number' && body.overlapSize >= 0 && body.overlapSize <= 500) {
    opts.overlapSize = body.overlapSize;
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Extraction pipeline (fire-and-forget)
// ---------------------------------------------------------------------------

/**
 * Run text extraction for a document. Updates document status on success/failure.
 * Optionally chains to embedding if `autoEmbed` is true.
 */
export async function runExtraction(
  documentId: string,
  userId: string,
  buffer: Buffer,
  fileType: FileType,
  filename: string,
  autoEmbed: boolean,
): Promise<void> {
  try {
    ProcessingProgressService.advanceStage(documentId, 'extracting');
    const result = await ExtractionService.extractText(buffer, fileType, filename);
    ProcessingProgressService.updateStageProgress(documentId, 1);

    await DocumentService.updateDocument(documentId, userId, {
      status: 'extracted',
      extracted_text: result.text,
      text_length: result.stats.length,
      metadata: {
        ...result.metadata,
        wordCount: result.stats.wordCount,
        pageCount: result.stats.pageCount,
        paragraphCount: result.stats.paragraphCount,
        tables: result.tables,
        tableCount: result.tables?.length || 0,
        images: result.images
          ? result.images.map((img: any) => ({
              page: img.page,
              index: img.index,
              width: img.width,
              height: img.height,
              format: img.format,
              size: img.size,
            }))
          : undefined,
        imageCount: result.images?.length || 0,
        ocr: result.ocrUsed ?? false,
      },
    });

    logger.info('Text extraction completed', {
      documentId,
      textLength: result.stats.length,
      wordCount: result.stats.wordCount,
      pageCount: result.stats.pageCount,
      tableCount: result.tables?.length || 0,
    });

    if (autoEmbed) {
      await runEmbedding(documentId, userId, result.text, {}, {
        ...result.metadata,
        wordCount: result.stats.wordCount,
        pageCount: result.stats.pageCount,
        paragraphCount: result.stats.paragraphCount,
        tables: result.tables,
        tableCount: result.tables?.length || 0,
        images: result.images
          ? result.images.map((img: any) => ({
              page: img.page,
              index: img.index,
              width: img.width,
              height: img.height,
              format: img.format,
              size: img.size,
            }))
          : undefined,
        imageCount: result.images?.length || 0,
        ocr: result.ocrUsed ?? false,
      });
    }
  } catch (error: any) {
    ProcessingProgressService.fail(documentId, error.message || 'Extraction failed');
    await DocumentService.updateDocument(documentId, userId, {
      status: 'failed',
      extraction_error: error.message || 'Extraction failed',
    });
    logger.error('Text extraction failed', { documentId, error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Embedding pipeline
// ---------------------------------------------------------------------------

/**
 * Generate embeddings for already-extracted text. Updates document status on
 * success/failure. Stores chunks in DB and vectors in Pinecone.
 */
export async function runEmbedding(
  documentId: string,
  userId: string,
  text: string,
  chunkingOptions: ChunkingOptions = {},
  existingMetadata: Record<string, any> = {},
): Promise<void> {
  try {
    const { EmbeddingService } = await import('./embedding.service');

    ProcessingProgressService.advanceStage(documentId, 'chunking');
    const { chunks, embeddings, metadata } = await EmbeddingService.processDocument(
      documentId,
      userId,
      text,
      chunkingOptions,
    );
    ProcessingProgressService.advanceStage(documentId, 'embedding');
    ProcessingProgressService.updateStageProgress(documentId, 0.5);

    // Delete existing chunks & vectors
    try {
      const existingChunkIds = await ChunkService.getChunkIdsByDocument(documentId);
      await PineconeService.deleteDocumentVectors(documentId, existingChunkIds.length > 0 ? existingChunkIds : undefined);
      await ChunkService.deleteChunksByDocument(documentId);
    } catch (err: any) {
      logger.warn('No existing chunks to delete or error deleting', { documentId, error: err.message });
    }

    // Create chunks in DB
    const createdChunks = await ChunkService.createChunks(documentId, chunks);

    // Store vectors in Pinecone
    ProcessingProgressService.advanceStage(documentId, 'indexing');
    try {
      const { isPineconeConfigured } = await import('../config/pinecone');
      if (isPineconeConfigured()) {
        const document = await DocumentService.getDocument(documentId, userId);
        const vectorIds = await PineconeService.upsertVectors(
          documentId,
          createdChunks.map((c: any) => ({ id: c.id, chunkIndex: c.chunk_index, content: c.content })),
          embeddings,
          userId,
          document?.topic_id || undefined,
          undefined,
          EmbeddingService.getCurrentModel(),
        );
        logger.info('Vectors stored in Pinecone', { documentId, vectorCount: vectorIds.length });
      } else {
        logger.warn('Pinecone not configured, skipping vector storage', { documentId });
      }
    } catch (err: any) {
      logger.error('Failed to store vectors in Pinecone', { documentId, error: err.message });
      // Continue — chunks are already stored
    }

    await DocumentService.updateDocument(documentId, userId, {
      status: 'processed',
      metadata: {
        ...existingMetadata,
        embedding: metadata,
        chunkCount: chunks.length,
        embeddedAt: new Date().toISOString(),
      },
    });

    ProcessingProgressService.advanceStage(documentId, 'completed');
    logger.info('Embedding generation completed', { documentId, chunkCount: chunks.length });

    // Invalidate cache
    try {
      await CacheInvalidationService.invalidateDocumentCache(userId, [documentId], {
        invalidateRAG: true,
        invalidateEmbeddings: false,
        reason: 'Document processed',
      });
    } catch (cacheError: any) {
      logger.warn('Cache invalidation failed after document processing', { documentId, error: cacheError.message });
    }
  } catch (error: any) {
    ProcessingProgressService.fail(documentId, error.message || 'Embedding generation failed');
    await DocumentService.updateDocument(documentId, userId, {
      status: 'embedding_failed',
      embedding_error: error.message || 'Embedding generation failed',
    });
    logger.error('Embedding generation failed', { documentId, error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Full processing pipeline (extract → embed)
// ---------------------------------------------------------------------------

/**
 * Full processing: extract text (if needed) then embed.
 * Fire-and-forget — call without awaiting in the controller.
 */
export async function runFullProcessing(
  documentId: string,
  userId: string,
  document: any,
  chunkingOptions: ChunkingOptions = {},
): Promise<void> {
  ProcessingProgressService.start(documentId);

  if (!document.extracted_text || document.extracted_text.trim().length === 0) {
    // Need extraction first
    ProcessingProgressService.advanceStage(documentId, 'downloading');
    const fileData = await StorageService.downloadDocument(document.file_path);
    await DocumentService.updateDocument(documentId, userId, {
      status: 'processing',
      extraction_error: undefined,
    });

    try {
      ProcessingProgressService.advanceStage(documentId, 'extracting');
      const result = await ExtractionService.extractText(fileData.buffer, document.file_type, document.filename);
      ProcessingProgressService.updateStageProgress(documentId, 1);
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

      logger.info('Text extraction completed, starting embedding', { documentId, textLength: result.stats.length });

      await DocumentService.updateDocument(documentId, userId, { status: 'embedding', embedding_error: undefined });
      await runEmbedding(documentId, userId, result.text, chunkingOptions, {
        ...result.metadata,
        wordCount: result.stats.wordCount,
        pageCount: result.stats.pageCount,
        paragraphCount: result.stats.paragraphCount,
      });
    } catch (error: any) {
      ProcessingProgressService.fail(documentId, error.message || 'Extraction failed');
      await DocumentService.updateDocument(documentId, userId, {
        status: 'failed',
        extraction_error: error.message || 'Extraction failed',
      });
      logger.error('Text extraction failed', { documentId, error: error.message });
    }
  } else {
    // Text already extracted — just embed
    await DocumentService.updateDocument(documentId, userId, { status: 'embedding', embedding_error: undefined });
    await runEmbedding(documentId, userId, document.extracted_text, chunkingOptions, document.metadata || {});
  }
}

// ---------------------------------------------------------------------------
// Clear processing data
// ---------------------------------------------------------------------------

/**
 * Delete chunks, Pinecone vectors, extracted text — reset to 'stored' status.
 */
export async function clearProcessingData(documentId: string, userId: string, document: any): Promise<void> {
  ProcessingProgressService.clear(documentId);

  // Delete chunks + vectors
  try {
    const chunks = await ChunkService.getChunksByDocument(documentId, userId);
    const chunkIds = chunks.map((c: any) => c.id);
    await PineconeService.deleteDocumentVectors(documentId, chunkIds);
    await ChunkService.deleteChunksByDocument(documentId);
    logger.info('Processing data cleared', { documentId, chunkCount: chunks.length });
  } catch (error: any) {
    logger.warn('No chunks to delete or chunks table not found', { documentId, error: error.message });
  }

  await DocumentService.updateDocument(documentId, userId, {
    status: 'stored',
    extracted_text: null as any,
    text_length: null as any,
    extraction_error: null as any,
    embedding_error: null as any,
    metadata: { fileType: document.file_type, fileName: document.filename },
  });

  logger.info('Processing data cleared for document', { documentId, userId, filename: document.filename });
}

// ---------------------------------------------------------------------------
// Delete a document fully (storage + DB + chunks + vectors + cache)
// ---------------------------------------------------------------------------

export async function deleteDocumentFully(documentId: string, userId: string, filePath: string): Promise<void> {
  // Chunks + vectors
  try {
    const chunkIds = await ChunkService.getChunkIdsByDocument(documentId);
    await PineconeService.deleteDocumentVectors(documentId, chunkIds.length > 0 ? chunkIds : undefined);
    await ChunkService.deleteChunksByDocument(documentId);
  } catch (err: any) {
    logger.warn('No chunks to delete or chunks table not found', { documentId, error: err.message });
  }

  // Storage
  try {
    await StorageService.deleteDocument(userId, filePath);
  } catch (err: any) {
    logger.warn('File not found in storage, continuing with database deletion', { filePath, error: err.message });
  }

  // DB
  await DocumentService.deleteDocument(documentId, userId);

  // Cache
  try {
    await CacheInvalidationService.invalidateDocumentCache(userId, [documentId], {
      invalidateRAG: true,
      invalidateEmbeddings: true,
      reason: 'Document deleted',
    });
  } catch (err: any) {
    logger.warn('Cache invalidation failed after document deletion', { documentId, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Sync legacy Storage documents → DB
// ---------------------------------------------------------------------------

export async function syncStorageDocuments(userId: string): Promise<{ synced: number; skipped: number; total: number }> {
  const storageDocuments = await StorageService.listDocuments(userId);
  if (storageDocuments.length === 0) return { synced: 0, skipped: 0, total: 0 };

  let synced = 0;
  let skipped = 0;

  for (const storageDoc of storageDocuments) {
    try {
      const existing = await DocumentService.getDocumentByPath(storageDoc.path, userId);
      if (existing) { skipped++; continue; }

      const ext = path.extname(storageDoc.name).toLowerCase();
      const fileType: FileType = ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : ext === '.md' ? 'md' : 'txt';

      await DocumentService.createDocument({
        user_id: userId,
        filename: storageDoc.name,
        file_path: storageDoc.path,
        file_type: fileType,
        file_size: storageDoc.size,
      });
      synced++;
    } catch (error: any) {
      logger.error('Failed to sync document', { userId, path: storageDoc.path, error: error.message });
      skipped++;
    }
  }

  logger.info('Document sync completed', { userId, synced, skipped, total: storageDocuments.length });
  return { synced, skipped, total: storageDocuments.length };
}
