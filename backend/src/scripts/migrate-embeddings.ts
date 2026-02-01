/**
 * Embedding Migration Script
 * 
 * This script helps migrate embeddings from one model to another.
 * 
 * Usage:
 *   npm run migrate-embeddings -- --from-model text-embedding-3-small --to-model text-embedding-3-large --dry-run
 * 
 * Options:
 *   --from-model: Source embedding model (default: text-embedding-3-small)
 *   --to-model: Target embedding model (default: text-embedding-3-large)
 *   --dry-run: Preview changes without actually migrating
 *   --batch-size: Number of documents to process at a time (default: 10)
 *   --user-id: Migrate only for specific user (optional)
 *   --document-id: Migrate only specific document (optional)
 */

import dotenv from 'dotenv';
import path from 'path';
import { EmbeddingService } from '../services/embedding.service';
import { PineconeService } from '../services/pinecone.service';
import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';
import { EmbeddingModel, getEmbeddingModelSpec, getEmbeddingDimensions } from '../config/embedding.config';
import { Database } from '../types/database';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface MigrationOptions {
  fromModel: EmbeddingModel;
  toModel: EmbeddingModel;
  dryRun: boolean;
  batchSize: number;
  userId?: string;
  documentId?: string;
}

interface MigrationStats {
  totalDocuments: number;
  processedDocuments: number;
  totalChunks: number;
  processedChunks: number;
  failedChunks: number;
  errors: string[];
}

/**
 * Parse command line arguments
 */
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    fromModel: 'text-embedding-3-small',
    toModel: 'text-embedding-3-large',
    dryRun: false,
    batchSize: 10,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--from-model':
        options.fromModel = args[++i] as EmbeddingModel;
        break;
      case '--to-model':
        options.toModel = args[++i] as EmbeddingModel;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10) || 10;
        break;
      case '--user-id':
        options.userId = args[++i];
        break;
      case '--document-id':
        options.documentId = args[++i];
        break;
    }
  }

  return options;
}

/**
 * Validate migration options
 */
function validateOptions(options: MigrationOptions): void {
  const fromSpec = getEmbeddingModelSpec(options.fromModel);
  const toSpec = getEmbeddingModelSpec(options.toModel);

  if (!fromSpec || !toSpec) {
    throw new Error(`Invalid model: ${options.fromModel} or ${options.toModel}`);
  }

  if (options.fromModel === options.toModel) {
    throw new Error('Source and target models must be different');
  }

  logger.info('Migration configuration', {
    fromModel: options.fromModel,
    fromDimensions: fromSpec.dimensions,
    toModel: options.toModel,
    toDimensions: toSpec.dimensions,
    dryRun: options.dryRun,
    batchSize: options.batchSize,
  });
}

/**
 * Migrate embeddings for a single document
 */
async function migrateDocument(
  document: Database.Document,
  options: MigrationOptions,
  stats: MigrationStats
): Promise<void> {
  const documentId = document.id;
  try {
    logger.info('Processing document', { documentId, filename: document.filename });

    // Get document chunks directly from database
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('document_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (chunksError) {
      throw new Error(`Failed to get chunks: ${chunksError.message}`);
    }

    if (!chunks || chunks.length === 0) {
      logger.warn('No chunks found for document', { documentId });
      return;
    }

    stats.totalChunks += chunks.length;

    // Generate new embeddings for all chunks
    const chunkContents = chunks.map(chunk => chunk.content || '');
    const newEmbeddings = await EmbeddingService.generateEmbeddingsBatch(
      chunkContents,
      options.toModel
    );

    if (newEmbeddings.length !== chunks.length) {
      throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${newEmbeddings.length}`);
    }

    // Prepare chunks for upsert
    const chunksWithIds = chunks.map((chunk, index) => ({
      id: chunk.id,
      chunkIndex: chunk.chunk_index || index,
      content: chunk.content || '',
    }));

    if (!options.dryRun) {
      // Delete old vectors
      const oldVectorIds = chunks.map(chunk => 
        `${documentId}:${chunk.id}`
      );
      await PineconeService.deleteVectors(documentId, oldVectorIds);

      // Upsert new vectors
      const toDimensions = getEmbeddingDimensions(options.toModel);
      await PineconeService.upsertVectors(
        documentId,
        chunksWithIds,
        newEmbeddings,
        document.user_id,
        document.topic_id || undefined,
        toDimensions,
        options.toModel
      );

      logger.info('Document migrated successfully', {
        documentId,
        chunkCount: chunks.length,
      });
    } else {
      logger.info('DRY RUN: Would migrate document', {
        documentId,
        chunkCount: chunks.length,
        fromModel: options.fromModel,
        toModel: options.toModel,
      });
    }

    stats.processedChunks += chunks.length;
    stats.processedDocuments++;
  } catch (error: any) {
    logger.error('Failed to migrate document', {
      documentId,
      error: error.message,
    });
    // Try to get chunk count for error reporting
    try {
      const { count } = await supabaseAdmin
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);
      stats.failedChunks += count || 0;
    } catch {
      // Ignore if we can't get chunks
    }
    stats.errors.push(`Document ${documentId}: ${error.message}`);
  }
}

/**
 * Main migration function
 */
async function migrate(options: MigrationOptions): Promise<void> {
  validateOptions(options);

  logger.info('Starting embedding migration', {
    fromModel: options.fromModel,
    toModel: options.toModel,
    dryRun: options.dryRun,
  });

  const stats: MigrationStats = {
    totalDocuments: 0,
    processedDocuments: 0,
    totalChunks: 0,
    processedChunks: 0,
    failedChunks: 0,
    errors: [],
  };

  try {
    // Set target model temporarily
    EmbeddingService.setModel(options.toModel);

    // Get documents to migrate
    let query = supabaseAdmin.from('documents').select('*');
    
    if (options.documentId) {
      query = query.eq('id', options.documentId);
    } else if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    const { data: documents, error: docsError } = await query;

    if (docsError) {
      throw new Error(`Failed to get documents: ${docsError.message}`);
    }

    if (!documents || documents.length === 0) {
      logger.info('No documents found to migrate');
      return;
    }

    stats.totalDocuments = documents.length;

    logger.info('Found documents to migrate', {
      count: documents.length,
    });

    // Process in batches
    for (let i = 0; i < documents.length; i += options.batchSize) {
      const batch = documents.slice(i, i + options.batchSize);
      
      logger.info(`Processing batch ${Math.floor(i / options.batchSize) + 1}`, {
        batchStart: i + 1,
        batchEnd: Math.min(i + options.batchSize, documents.length),
        total: documents.length,
      });

      // Process batch in parallel
      await Promise.all(
        batch.map(doc => migrateDocument(doc as Database.Document, options, stats))
      );

      // Small delay between batches to avoid rate limits
      if (i + options.batchSize < documents.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Print summary
    logger.info('Migration completed', {
      totalDocuments: stats.totalDocuments,
      processedDocuments: stats.processedDocuments,
      totalChunks: stats.totalChunks,
      processedChunks: stats.processedChunks,
      failedChunks: stats.failedChunks,
      errors: stats.errors.length,
      dryRun: options.dryRun,
    });

    if (stats.errors.length > 0) {
      logger.warn('Migration errors', {
        errors: stats.errors.slice(0, 10), // Show first 10 errors
        totalErrors: stats.errors.length,
      });
    }

    if (options.dryRun) {
      logger.info('DRY RUN: No actual changes were made. Run without --dry-run to perform migration.');
    }
  } catch (error: any) {
    logger.error('Migration failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  const options = parseArgs();
  migrate(options)
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed', { error: error.message });
      process.exit(1);
    });
}

export { migrate, MigrationOptions, MigrationStats };
