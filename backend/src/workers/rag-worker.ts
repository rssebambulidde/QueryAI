/**
 * RAG Worker
 * Processes RAG requests from the queue
 */

import { Worker, WorkerOptions, Job } from 'bullmq';
import logger from '../config/logger';
import { AIService } from '../services/ai.service';
import { RAGRequestJobData, RAGRequestJobResult } from '../services/request-queue.service';

/**
 * RAG Worker
 * Processes queued RAG requests with priority support
 */
export class RAGWorker {
  private static worker: Worker<RAGRequestJobData, RAGRequestJobResult> | null = null;
  private static readonly QUEUE_NAME = 'rag-requests';
  private static readonly CONCURRENCY = 5; // Process up to 5 jobs concurrently

  /**
   * Get Redis connection configuration
   */
  private static getRedisConnection(): any {
    if (process.env.REDIS_URL) {
      return process.env.REDIS_URL;
    }

    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      username: process.env.REDIS_USERNAME,
      db: parseInt(process.env.REDIS_DATABASE || '0', 10),
    };
  }

  /**
   * Initialize the worker
   */
  static async initialize(): Promise<void> {
    if (this.worker) {
      return; // Already initialized
    }

    try {
      const connection = this.getRedisConnection();
      
      const workerOptions: WorkerOptions = {
        connection,
        concurrency: this.CONCURRENCY,
        limiter: {
          max: 10, // Max 10 jobs per interval
          duration: 1000, // Per second
        },
      };

      this.worker = new Worker<RAGRequestJobData, RAGRequestJobResult>(
        this.QUEUE_NAME,
        this.processJob,
        workerOptions
      );

      // Set up event handlers
      this.setupEventHandlers();

      logger.info('RAG worker initialized', {
        queueName: this.QUEUE_NAME,
        concurrency: this.CONCURRENCY,
      });
    } catch (error: any) {
      logger.error('Failed to initialize RAG worker', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process a RAG request job
   */
  private static async processJob(
    job: Job<RAGRequestJobData, RAGRequestJobResult>
  ): Promise<RAGRequestJobResult> {
    const startTime = Date.now();
    const { userId, request, metadata } = job.data;

    logger.info('Processing RAG request job', {
      jobId: job.id,
      userId,
      questionLength: request.question.length,
      priority: job.opts.priority,
    });

    try {
      // Update job progress
      await job.updateProgress(10);

      // Process the RAG request
      const result = await AIService.answerQuestion(request, userId);

      // Update job progress
      await job.updateProgress(90);

      const processingTime = Date.now() - startTime;

      logger.info('RAG request job completed', {
        jobId: job.id,
        userId,
        processingTime,
        hasAnswer: !!result.answer,
        sourcesCount: result.sources?.length || 0,
      });

      // Update job progress to 100%
      await job.updateProgress(100);

      return {
        success: true,
        answer: result.answer,
        sources: result.sources,
        processingTime,
      };
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      logger.error('RAG request job failed', {
        jobId: job.id,
        userId,
        error: error.message,
        processingTime,
        attempt: job.attemptsMade + 1,
      });

      return {
        success: false,
        error: error.message || 'Unknown error',
        processingTime,
      };
    }
  }

  /**
   * Set up event handlers for the worker
   */
  private static setupEventHandlers(): void {
    if (!this.worker) {
      return;
    }

    this.worker.on('completed', (job: Job<RAGRequestJobData, RAGRequestJobResult>) => {
      logger.info('Job completed', {
        jobId: job.id,
        userId: job.data.userId,
        processingTime: job.returnvalue?.processingTime,
      });
    });

    this.worker.on('failed', (job: Job<RAGRequestJobData, RAGRequestJobResult> | undefined, error: Error) => {
      logger.error('Job failed', {
        jobId: job?.id,
        userId: job?.data.userId,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('error', (error: Error) => {
      logger.error('Worker error', {
        error: error.message,
        stack: error.stack,
      });
    });

    this.worker.on('stalled', (jobId: string) => {
      logger.warn('Job stalled', { jobId });
    });

    this.worker.on('active', (job: Job<RAGRequestJobData, RAGRequestJobResult>) => {
      logger.debug('Job active', {
        jobId: job.id,
        userId: job.data.userId,
        priority: job.opts.priority,
      });
    });
  }

  /**
   * Get the worker instance
   */
  static getWorker(): Worker<RAGRequestJobData, RAGRequestJobResult> | null {
    return this.worker;
  }

  /**
   * Close the worker
   */
  static async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info('RAG worker closed');
    }
  }

  /**
   * Get worker status
   */
  static getWorkerStatus(): {
    isRunning: boolean;
    concurrency: number;
    queueName: string;
  } {
    return {
      isRunning: this.worker !== null,
      concurrency: this.CONCURRENCY,
      queueName: this.QUEUE_NAME,
    };
  }
}

export default RAGWorker;
