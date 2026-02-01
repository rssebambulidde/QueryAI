import OpenAI from 'openai';
import config from '../config/env';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { ChunkingService, ChunkingOptions, TextChunk } from './chunking.service';
import { PineconeService } from './pinecone.service';
import { RedisCacheService } from './redis-cache.service';
import { RetryService } from './retry.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import {
  EmbeddingModel,
  getEmbeddingModelSpec,
  getEmbeddingDimensions,
  DEFAULT_EMBEDDING_MODEL,
  supportsDimensionReduction,
} from '../config/embedding.config';

/**
 * Batch processing queue item
 */
interface BatchQueueItem {
  text: string;
  model: EmbeddingModel;
  dimensions?: number;
  resolve: (embedding: number[]) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Batch processing statistics
 */
export interface BatchProcessingStats {
  totalBatches: number;
  totalProcessed: number;
  totalQueued: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  queueSize: number;
  errors: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Embedding Service
 * Handles document embedding generation and processing
 * Supports multiple embedding models with different dimensions
 */
export class EmbeddingService {
  private static openai: OpenAI | null = null;
  private static currentModel: EmbeddingModel | null = null;

  // Embedding cache configuration
  private static readonly EMBEDDING_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private static readonly EMBEDDING_CACHE_PREFIX = 'embedding';

  // Batch processing queue configuration
  private static readonly DEFAULT_BATCH_SIZE = 100; // Default batch size for embeddings
  private static readonly MAX_BATCH_SIZE = 2048; // OpenAI's max batch size
  private static readonly MIN_BATCH_SIZE = 1;
  private static readonly BATCH_PROCESSING_INTERVAL = 100; // Process queue every 100ms
  private static readonly MAX_QUEUE_SIZE = 10000; // Maximum items in queue
  private static readonly MAX_BATCH_WAIT_TIME = 5000; // Max wait time before processing batch (5 seconds)

  // Batch processing queue
  private static batchQueue: Map<string, BatchQueueItem[]> = new Map(); // Key: model:dimensions
  private static processingInterval: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  // Batch processing statistics
  private static batchStats: BatchProcessingStats = {
    totalBatches: 0,
    totalProcessed: 0,
    totalQueued: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0,
    queueSize: 0,
    errors: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  // Processing time tracking
  private static processingTimes: number[] = [];

  /**
   * Normalize text for cache key generation
   * Removes extra whitespace, converts to lowercase, and trims
   */
  private static normalizeTextForCache(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Replace multiple spaces with single space
  }

  /**
   * Simple hash function for cache keys (djb2 algorithm)
   */
  private static hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36); // Convert to base36 for shorter keys
  }

  /**
   * Generate cache key for embedding
   * Includes model, dimensions, and text hash to ensure cache correctness
   */
  private static generateEmbeddingCacheKey(
    text: string,
    model: EmbeddingModel,
    dimensions?: number
  ): string {
    const normalizedText = this.normalizeTextForCache(text);
    const textHash = this.hashString(normalizedText);
    const modelPart = model.replace(/[^a-z0-9]/g, '_');
    const dimensionsPart = dimensions ? `:d${dimensions}` : '';
    const lengthPart = `:l${normalizedText.length}`; // Include length for additional uniqueness
    
    return `${modelPart}${dimensionsPart}${lengthPart}:${textHash}`;
  }

  /**
   * Get OpenAI client instance
   */
  private static getOpenAIClient(): OpenAI {
    if (!this.openai) {
      if (!config.OPENAI_API_KEY) {
        throw new AppError('OpenAI API key is not configured', 500, 'OPENAI_NOT_CONFIGURED');
      }
      this.openai = new OpenAI({
        apiKey: config.OPENAI_API_KEY,
      });
    }
    return this.openai;
  }

  /**
   * Get current embedding model from config or default
   */
  static getCurrentModel(): EmbeddingModel {
    if (!this.currentModel) {
      const modelFromEnv = config.EMBEDDING_MODEL as EmbeddingModel;
      // Validate model - check if it exists in EMBEDDING_MODELS
      const validModels: EmbeddingModel[] = ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'];
      if (modelFromEnv && validModels.includes(modelFromEnv)) {
        this.currentModel = modelFromEnv;
      } else {
        this.currentModel = DEFAULT_EMBEDDING_MODEL;
        if (modelFromEnv) {
          logger.warn('Invalid embedding model in config, using default', {
            provided: modelFromEnv,
            default: DEFAULT_EMBEDDING_MODEL,
          });
        }
      }
    }
    return this.currentModel;
  }

  /**
   * Set embedding model (for testing or dynamic switching)
   */
  static setModel(model: EmbeddingModel): void {
    this.currentModel = model;
    logger.info('Embedding model changed', {
      model,
      dimensions: getEmbeddingDimensions(model),
    });
  }

  /**
   * Get current embedding dimensions
   */
  static getCurrentDimensions(): number {
    return getEmbeddingDimensions(this.getCurrentModel());
  }

  /**
   * Get embedding cache statistics
   */
  static getEmbeddingCacheStats() {
    return RedisCacheService.getEmbeddingStats();
  }

  /**
   * Get batch processing statistics
   */
  static getBatchProcessingStats(): BatchProcessingStats {
    // Calculate current queue size
    let totalQueueSize = 0;
    this.batchQueue.forEach(items => {
      totalQueueSize += items.length;
    });

    // Calculate average processing time
    const avgProcessingTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    // Calculate average batch size
    const avgBatchSize = this.batchStats.totalBatches > 0
      ? this.batchStats.totalProcessed / this.batchStats.totalBatches
      : 0;

    return {
      ...this.batchStats,
      queueSize: totalQueueSize,
      averageProcessingTime: avgProcessingTime,
      averageBatchSize: avgBatchSize,
    };
  }

  /**
   * Get optimal batch size based on configuration
   */
  static getOptimalBatchSize(): number {
    const envBatchSize = process.env.EMBEDDING_BATCH_SIZE
      ? parseInt(process.env.EMBEDDING_BATCH_SIZE, 10)
      : this.DEFAULT_BATCH_SIZE;

    // Clamp between min and max
    return Math.max(
      this.MIN_BATCH_SIZE,
      Math.min(this.MAX_BATCH_SIZE, envBatchSize)
    );
  }

  /**
   * Start batch processing queue (if not already started)
   */
  static startBatchProcessor(): void {
    if (this.processingInterval) {
      return; // Already started
    }

    this.processingInterval = setInterval(() => {
      this.processBatchQueue().catch((error: any) => {
        logger.error('Error in batch processing queue', {
          error: error.message,
        });
      });
    }, this.BATCH_PROCESSING_INTERVAL);

    logger.info('Batch embedding processor started', {
      interval: this.BATCH_PROCESSING_INTERVAL,
      batchSize: this.getOptimalBatchSize(),
    });
  }

  /**
   * Stop batch processing queue
   */
  static stopBatchProcessor(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('Batch embedding processor stopped');
    }
  }

  /**
   * Process items in the batch queue
   */
  private static async processBatchQueue(): Promise<void> {
    if (this.isProcessing || this.batchQueue.size === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Process each model/dimension combination
      const queueKeys = Array.from(this.batchQueue.keys());
      
      for (const queueKey of queueKeys) {
        const queue = this.batchQueue.get(queueKey);
        if (!queue || queue.length === 0) {
          continue;
        }

        // Get optimal batch size
        const optimalBatchSize = this.getOptimalBatchSize();
        
        // Process in batches
        while (queue.length > 0) {
          const batch = queue.splice(0, Math.min(optimalBatchSize, queue.length));
          
          if (batch.length === 0) {
            break;
          }

          // Parse queue key to get model and dimensions
          const [model, dimensionsStr] = queueKey.split(':');
          const dimensions = dimensionsStr ? parseInt(dimensionsStr, 10) : undefined;
          const embeddingModel = model as EmbeddingModel;

          try {
            // Process batch
            await this.processBatch(batch, embeddingModel, dimensions);
            this.batchStats.totalBatches++;
            this.batchStats.totalProcessed += batch.length;
          } catch (error: any) {
            logger.error('Error processing batch', {
              error: error.message,
              batchSize: batch.length,
              model: embeddingModel,
            });
            this.batchStats.errors += batch.length;

            // Reject all items in failed batch
            batch.forEach(item => {
              item.reject(error instanceof Error ? error : new Error(error.message));
            });
          }
        }

        // Remove empty queue
        if (queue.length === 0) {
          this.batchQueue.delete(queueKey);
        }
      }
    } finally {
      this.isProcessing = false;
      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);
      
      // Keep only last 100 processing times for average calculation
      if (this.processingTimes.length > 100) {
        this.processingTimes.shift();
      }
    }
  }

  /**
   * Process a batch of queue items
   */
  private static async processBatch(
    batch: BatchQueueItem[],
    model: EmbeddingModel,
    dimensions?: number
  ): Promise<void> {
    const texts = batch.map(item => item.text);
    const modelSpec = getEmbeddingModelSpec(model);
    const finalDimensions = dimensions || modelSpec.dimensions;

    // Check cache first
    const cacheKeys = texts.map(text => 
      this.generateEmbeddingCacheKey(text, model, dimensions)
    );

    const cachedResults: (number[] | null)[] = await Promise.all(
      cacheKeys.map(key => 
        RedisCacheService.get<number[]>(key, {
          prefix: this.EMBEDDING_CACHE_PREFIX,
          ttl: this.EMBEDDING_CACHE_TTL,
        })
      )
    );

    // Track cache hits/misses
    const cacheHits = cachedResults.filter(r => r !== null).length;
    const cacheMisses = cachedResults.length - cacheHits;
    this.batchStats.cacheHits += cacheHits;
    this.batchStats.cacheMisses += cacheMisses;

    // Resolve cached items
    batch.forEach((item, index) => {
      if (cachedResults[index]) {
        item.resolve(cachedResults[index]!);
        RedisCacheService.recordEmbeddingHit();
      }
    });

    // Find items that need generation
    const itemsToGenerate: { item: BatchQueueItem; index: number; text: string }[] = [];
    batch.forEach((item, index) => {
      if (cachedResults[index] === null) {
        itemsToGenerate.push({ item, index, text: texts[index] });
      }
    });

    // If all cached, return
    if (itemsToGenerate.length === 0) {
      return;
    }

    // Generate embeddings for uncached items
    const client = this.getOpenAIClient();
    const textsForGeneration = itemsToGenerate.map(i => i.text);

    const requestParams: any = {
      model,
      input: textsForGeneration,
    };

    if (supportsDimensionReduction(model) && dimensions) {
      const maxDimensions = modelSpec.dimensions;
      const finalDimensions = Math.min(Math.max(dimensions, 256), maxDimensions);
      requestParams.dimensions = finalDimensions;
    }

    // Use circuit breaker with retry service for embedding generation
    const circuitResult = await CircuitBreakerService.execute(
      'openai-embeddings',
      async () => {
        const retryResult = await RetryService.execute(
          async () => {
            const response = await client.embeddings.create(requestParams);
            if (!response.data || response.data.length !== textsForGeneration.length) {
              throw new AppError(
                `Failed to generate embeddings: expected ${textsForGeneration.length}, got ${response.data?.length || 0}`,
                500,
                'EMBEDDING_GENERATION_ERROR'
              );
            }
            return response;
          },
          {
            maxRetries: 3,
            initialDelay: 1000,
            multiplier: 2,
            maxDelay: 10000,
            onRetry: (error, attempt, delay) => {
              logger.warn('Retrying embedding generation', {
                attempt,
                delay,
                error: error.message,
                batchSize: textsForGeneration.length,
                model: model,
              });
            },
          }
        );
        return retryResult.result;
      },
      {
        failureThreshold: 5,
        resetTimeout: 60000, // 60 seconds
        monitoringWindow: 60000,
        timeout: 30000, // 30 seconds
        errorFilter: (error) => {
          // Only count server errors and rate limits as failures
          return error.status >= 500 || error.status === 429 || error.code === 'rate_limit_exceeded';
        },
      }
    );

    const response = circuitResult.result;

    if (!response.data || response.data.length !== textsForGeneration.length) {
      throw new AppError(
        `Failed to generate embeddings: expected ${textsForGeneration.length}, got ${response.data?.length || 0}`,
        500,
        'EMBEDDING_GENERATION_ERROR'
      );
    }

    // Resolve items and cache embeddings
    await Promise.all(
      itemsToGenerate.map(async ({ item, index }, genIndex) => {
        const embedding = response.data[genIndex].embedding;
        
        // Resolve promise
        item.resolve(embedding);

        // Cache embedding
        try {
          const cacheKey = cacheKeys[itemsToGenerate[index].index];
          await RedisCacheService.set(cacheKey, embedding, {
            prefix: this.EMBEDDING_CACHE_PREFIX,
            ttl: this.EMBEDDING_CACHE_TTL,
          });
          RedisCacheService.recordEmbeddingSet();
        } catch (cacheError: any) {
          RedisCacheService.recordEmbeddingError();
          logger.warn('Failed to cache embedding in batch queue', {
            error: cacheError.message,
          });
        }
      })
    );
  }

  /**
   * Queue an embedding request for batch processing
   */
  static async queueEmbedding(
    text: string,
    model?: EmbeddingModel,
    dimensions?: number
  ): Promise<number[]> {
    const embeddingModel = model || this.getCurrentModel();
    const queueKey = `${embeddingModel}:${dimensions || 'default'}`;

    // Check if queue is full
    const currentQueueSize = this.batchQueue.get(queueKey)?.length || 0;
    if (currentQueueSize >= this.MAX_QUEUE_SIZE) {
      throw new AppError('Embedding queue is full', 503, 'QUEUE_FULL');
    }

    // Check cache first (synchronous check to avoid queueing cached items)
    const cacheKey = this.generateEmbeddingCacheKey(text, embeddingModel, dimensions);
    const cached = await RedisCacheService.get<number[]>(cacheKey, {
      prefix: this.EMBEDDING_CACHE_PREFIX,
      ttl: this.EMBEDDING_CACHE_TTL,
    });

    if (cached) {
      RedisCacheService.recordEmbeddingHit();
      this.batchStats.cacheHits++;
      return cached;
    }

    RedisCacheService.recordEmbeddingMiss();
    this.batchStats.cacheMisses++;

    // Queue the request
    return new Promise<number[]>((resolve, reject) => {
      const queueItem: BatchQueueItem = {
        text,
        model: embeddingModel,
        dimensions,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      if (!this.batchQueue.has(queueKey)) {
        this.batchQueue.set(queueKey, []);
      }

      this.batchQueue.get(queueKey)!.push(queueItem);
      this.batchStats.totalQueued++;

      // Start processor if not already started
      if (!this.processingInterval) {
        this.startBatchProcessor();
      }

      // Set timeout for queue item (prevent indefinite waiting)
      setTimeout(() => {
        const queue = this.batchQueue.get(queueKey);
        if (queue) {
          const index = queue.findIndex(item => item === queueItem);
          if (index !== -1) {
            queue.splice(index, 1);
            reject(new AppError('Embedding request timeout', 504, 'QUEUE_TIMEOUT'));
          }
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Generate embedding for a text
   * @param text - Text to generate embedding for
   * @param model - Optional model override (defaults to configured model)
   * @param dimensions - Optional dimension override (only for text-embedding-3-* models)
   * @param useQueue - Whether to use batch queue (default: false for immediate processing)
   */
  static async generateEmbedding(
    text: string,
    model?: EmbeddingModel,
    dimensions?: number,
    useQueue: boolean = false
  ): Promise<number[]> {
    // If using queue, delegate to queue method
    if (useQueue) {
      return this.queueEmbedding(text, model, dimensions);
    }
    try {
      const embeddingModel = model || this.getCurrentModel();
      const modelSpec = getEmbeddingModelSpec(embeddingModel);
      const finalDimensions = dimensions || modelSpec.dimensions;

      // Generate cache key
      const cacheKey = this.generateEmbeddingCacheKey(text, embeddingModel, dimensions);

      // Check cache first
      const cached = await RedisCacheService.get<number[]>(cacheKey, {
        prefix: this.EMBEDDING_CACHE_PREFIX,
        ttl: this.EMBEDDING_CACHE_TTL,
      });

      if (cached) {
        RedisCacheService.recordEmbeddingHit();
        logger.debug('Embedding retrieved from cache', {
          model: embeddingModel,
          dimensions: finalDimensions,
          textLength: text.length,
        });
        return cached;
      }

      RedisCacheService.recordEmbeddingMiss();

      // Generate embedding if not in cache
      const client = this.getOpenAIClient();
      
      // Build request parameters
      const requestParams: any = {
        model: embeddingModel,
        input: text,
      };

      // For text-embedding-3-* models, we can optionally reduce dimensions
      if (supportsDimensionReduction(embeddingModel) && dimensions) {
        // Validate dimensions
        const maxDimensions = modelSpec.dimensions;
        if (dimensions > maxDimensions) {
          logger.warn('Requested dimensions exceed model max, using max', {
            requested: dimensions,
            max: maxDimensions,
            model: embeddingModel,
          });
          dimensions = maxDimensions;
        }
        // Minimum dimensions for text-embedding-3-* is typically 256
        if (dimensions < 256) {
          logger.warn('Requested dimensions below minimum, using minimum', {
            requested: dimensions,
            minimum: 256,
            model: embeddingModel,
          });
          dimensions = 256;
        }
        requestParams.dimensions = dimensions;
      }

      logger.debug('Generating embedding', {
        model: embeddingModel,
        dimensions: dimensions || modelSpec.dimensions,
        textLength: text.length,
      });

      // Use circuit breaker with retry service for embedding generation
      const circuitResult = await CircuitBreakerService.execute(
        'openai-embeddings',
        async () => {
          const retryResult = await RetryService.execute(
            async () => {
              const response = await client.embeddings.create(requestParams);
              if (!response.data || response.data.length === 0) {
                throw new AppError('Failed to generate embedding', 500, 'EMBEDDING_GENERATION_ERROR');
              }
              return response;
            },
            {
              maxRetries: 3,
              initialDelay: 1000,
              multiplier: 2,
              maxDelay: 10000,
              onRetry: (error, attempt, delay) => {
                logger.warn('Retrying embedding generation', {
                  attempt,
                  delay,
                  error: error.message,
                  model: embeddingModel,
                  textLength: text.length,
                });
              },
            }
          );
          return retryResult.result;
        },
        {
          failureThreshold: 5,
          resetTimeout: 60000,
          monitoringWindow: 60000,
          timeout: 30000,
          errorFilter: (error) => {
            return error.status >= 500 || error.status === 429 || error.code === 'rate_limit_exceeded';
          },
        }
      );

      const response = circuitResult.result;

      if (!response.data || response.data.length === 0) {
        throw new AppError('Failed to generate embedding', 500, 'EMBEDDING_GENERATION_ERROR');
      }

      const embedding = response.data[0].embedding;
      const actualDimensions = embedding.length;

      logger.debug('Embedding generated', {
        model: embeddingModel,
        expectedDimensions: dimensions || modelSpec.dimensions,
        actualDimensions,
      });

      // Cache the embedding
      try {
        await RedisCacheService.set(cacheKey, embedding, {
          prefix: this.EMBEDDING_CACHE_PREFIX,
          ttl: this.EMBEDDING_CACHE_TTL,
        });
        RedisCacheService.recordEmbeddingSet();
        logger.debug('Embedding cached', {
          model: embeddingModel,
          dimensions: actualDimensions,
        });
      } catch (cacheError: any) {
        // Don't fail if caching fails
        RedisCacheService.recordEmbeddingError();
        logger.warn('Failed to cache embedding', {
          error: cacheError.message,
        });
      }

      return embedding;
    } catch (error: any) {
      logger.error('Error generating embedding', {
        error: error.message,
        model: model || this.getCurrentModel(),
      });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to generate embedding', 500, 'EMBEDDING_GENERATION_ERROR');
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * Optimized for throughput with intelligent batching
   * @param texts - Array of texts to generate embeddings for
   * @param model - Optional model override
   * @param dimensions - Optional dimension override
   * @param useQueue - Whether to use batch queue (default: false for immediate processing)
   */
  static async generateEmbeddingsBatch(
    texts: string[],
    model?: EmbeddingModel,
    dimensions?: number,
    useQueue: boolean = false
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // If using queue and batch is small, use queue for better throughput
    if (useQueue && texts.length <= this.getOptimalBatchSize()) {
      return Promise.all(
        texts.map(text => this.queueEmbedding(text, model, dimensions))
      );
    }

    try {
      const embeddingModel = model || this.getCurrentModel();
      const modelSpec = getEmbeddingModelSpec(embeddingModel);
      const finalDimensions = dimensions || modelSpec.dimensions;
      const optimalBatchSize = this.getOptimalBatchSize();

      // Check cache for each text
      const cacheKeys = texts.map(text => 
        this.generateEmbeddingCacheKey(text, embeddingModel, dimensions)
      );
      
      const cachedResults: (number[] | null)[] = await Promise.all(
        cacheKeys.map(key => 
          RedisCacheService.get<number[]>(key, {
            prefix: this.EMBEDDING_CACHE_PREFIX,
            ttl: this.EMBEDDING_CACHE_TTL,
          })
        )
      );

      // Track cache hits/misses
      const cacheHits = cachedResults.filter(r => r !== null).length;
      const cacheMisses = cachedResults.length - cacheHits;
      
      for (let i = 0; i < cacheHits; i++) {
        RedisCacheService.recordEmbeddingHit();
      }
      for (let i = 0; i < cacheMisses; i++) {
        RedisCacheService.recordEmbeddingMiss();
      }

      // Find texts that need embedding generation
      const textsToGenerate: { index: number; text: string }[] = [];
      const results: (number[] | null)[] = [...cachedResults];

      cachedResults.forEach((cached, index) => {
        if (cached === null) {
          textsToGenerate.push({ index, text: texts[index] });
        } else {
          results[index] = cached;
        }
      });

      logger.debug('Batch embedding cache check', {
        model: embeddingModel,
        total: texts.length,
        cached: cacheHits,
        toGenerate: textsToGenerate.length,
      });

      // If all texts are cached, return cached results
      if (textsToGenerate.length === 0) {
        logger.debug('All embeddings retrieved from cache', {
          model: embeddingModel,
          count: results.length,
        });
        return results as number[][];
      }

      // Process in optimized batches
      const textsForGeneration = textsToGenerate.map(item => item.text);
      const batches: string[][] = [];
      
      // Split into optimal batch sizes
      for (let i = 0; i < textsForGeneration.length; i += optimalBatchSize) {
        batches.push(textsForGeneration.slice(i, i + optimalBatchSize));
      }

      logger.debug('Processing batch embeddings', {
        model: embeddingModel,
        dimensions: dimensions || modelSpec.dimensions,
        totalBatches: batches.length,
        batchSize: optimalBatchSize,
        totalToGenerate: textsForGeneration.length,
      });

      // Process batches in parallel (up to 3 concurrent batches for throughput)
      const batchPromises = batches.map(async (batch, batchIndex) => {
        const client = this.getOpenAIClient();
        
        const requestParams: any = {
          model: embeddingModel,
          input: batch,
        };

        if (supportsDimensionReduction(embeddingModel) && dimensions) {
          const maxDimensions = modelSpec.dimensions;
          const finalDimensions = Math.min(Math.max(dimensions, 256), maxDimensions);
          requestParams.dimensions = finalDimensions;
        }

        // Use circuit breaker with retry service for batch embedding generation
        const circuitResult = await CircuitBreakerService.execute(
          'openai-embeddings',
          async () => {
            const retryResult = await RetryService.execute(
              async () => {
                const response = await client.embeddings.create(requestParams);
                if (!response.data || response.data.length !== batch.length) {
                  throw new AppError(
                    `Failed to generate embeddings: expected ${batch.length}, got ${response.data?.length || 0}`,
                    500,
                    'EMBEDDING_GENERATION_ERROR'
                  );
                }
                return response.data.map(item => item.embedding);
              },
              {
                maxRetries: 3,
                initialDelay: 1000,
                multiplier: 2,
                maxDelay: 10000,
                onRetry: (error, attempt, delay) => {
                  logger.warn('Retrying batch embedding generation', {
                    attempt,
                    delay,
                    error: error.message,
                    batchSize: batch.length,
                    model: embeddingModel,
                  });
                },
              }
            );
            return retryResult.result;
          },
          {
            failureThreshold: 5,
            resetTimeout: 60000,
            monitoringWindow: 60000,
            timeout: 30000,
            errorFilter: (error) => {
              return error.status >= 500 || error.status === 429 || error.code === 'rate_limit_exceeded';
            },
          }
        );

        return circuitResult.result;
      });

      // Wait for all batches to complete (with concurrency limit)
      const batchResults = await Promise.all(batchPromises);
      const allGeneratedEmbeddings = batchResults.flat();

      // Store generated embeddings in results and cache
      await Promise.all(
        textsToGenerate.map(async (item, genIndex) => {
          const embedding = allGeneratedEmbeddings[genIndex];
          results[item.index] = embedding;
          
          // Cache the embedding
          try {
            const cacheKey = cacheKeys[item.index];
            await RedisCacheService.set(cacheKey, embedding, {
              prefix: this.EMBEDDING_CACHE_PREFIX,
              ttl: this.EMBEDDING_CACHE_TTL,
            });
            RedisCacheService.recordEmbeddingSet();
          } catch (cacheError: any) {
            // Don't fail if caching fails
            RedisCacheService.recordEmbeddingError();
            logger.warn('Failed to cache embedding in batch', {
              error: cacheError.message,
              index: item.index,
            });
          }
        })
      );

      logger.debug('Batch embeddings generated', {
        model: embeddingModel,
        total: results.length,
        cached: cacheHits,
        generated: allGeneratedEmbeddings.length,
        batches: batches.length,
        dimensions: allGeneratedEmbeddings[0]?.length || 0,
      });

      return results as number[][];
    } catch (error: any) {
      logger.error('Error generating batch embeddings', {
        error: error.message,
        batchSize: texts.length,
        model: model || this.getCurrentModel(),
      });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to generate batch embeddings', 500, 'EMBEDDING_GENERATION_ERROR');
    }
  }

  /**
   * Process document: chunk, generate embeddings, and store in Pinecone
   */
  static async processDocument(
    documentId: string,
    userId: string,
    text: string,
    chunkingOptions?: ChunkingOptions,
    topicId?: string
  ): Promise<{
    chunks: TextChunk[];
    embeddings: number[][];
    metadata: {
      totalChunks: number;
      totalTokens: number;
    };
  }> {
    try {
      // Chunk the text (handle both sync and async chunking)
      // If semantic chunking is requested, use async method; otherwise use sync
      let chunks: TextChunk[];
      const useSemantic = 
        chunkingOptions?.strategy === 'semantic' || 
        chunkingOptions?.strategy === 'hybrid' || 
        chunkingOptions?.enableSemanticChunking === true;
      
      if (useSemantic) {
        chunks = await ChunkingService.chunkTextAsync(text, chunkingOptions || {});
      } else {
        // Use sentence-based (synchronous) - ensure strategy is not semantic
        const sentenceOptions = chunkingOptions ? { ...chunkingOptions, strategy: 'sentence' as const } : undefined;
        chunks = ChunkingService.chunkText(text, sentenceOptions);
      }

      logger.info('Document chunked', {
        documentId,
        chunkCount: chunks.length,
        strategy: chunkingOptions?.strategy || chunkingOptions?.enableSemanticChunking ? 'semantic' : 'sentence',
      });

      // Generate embeddings for all chunks (use optimized batch for efficiency)
      const chunkTexts = chunks.map(chunk => chunk.content);
      // Use optimized batch processing (not queue) for document processing
      const embeddings = await this.generateEmbeddingsBatch(chunkTexts, undefined, undefined, false);

      logger.info('Embeddings generated', {
        documentId,
        embeddingCount: embeddings.length,
      });

      // Store embeddings in Pinecone
      // Generate chunk IDs for Pinecone
      const chunksWithIds = chunks.map((chunk, index) => ({
        id: `${documentId}_chunk_${index}`,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
      }));

      // Get current model dimensions for Pinecone
      const embeddingDimensions = this.getCurrentDimensions();

      await PineconeService.upsertVectors(
        documentId,
        chunksWithIds,
        embeddings,
        userId,
        topicId,
        embeddingDimensions
      );

      logger.info('Vectors stored in Pinecone', {
        documentId,
        vectorCount: embeddings.length,
      });

      // Index document for keyword search
      try {
        const { KeywordSearchService } = await import('./keyword-search.service');
        await KeywordSearchService.indexDocument(documentId, userId, topicId);
        logger.info('Document indexed for keyword search', { documentId });
      } catch (keywordError: any) {
        // Don't fail document processing if keyword indexing fails
        logger.warn('Failed to index document for keyword search', {
          documentId,
          error: keywordError.message,
        });
      }

      return {
        chunks: chunks, // chunks is already TextChunk[]
        embeddings,
        metadata: {
          totalChunks: chunks.length,
          totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
        },
      };
    } catch (error: any) {
      logger.error('Error processing document:', {
        documentId,
        error: error.message,
      });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to process document', 500, 'DOCUMENT_PROCESSING_ERROR');
    }
  }
}
