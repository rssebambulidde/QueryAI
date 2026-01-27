/**
 * Request Queue Service
 * Manages queuing system for RAG operations using BullMQ
 */

import { Queue, QueueOptions, Job, JobOptions } from 'bullmq';
import logger from '../config/logger';
import { QuestionRequest } from './ai.service';

/**
 * Priority levels for queue jobs
 */
export enum QueuePriority {
  LOW = 10,
  NORMAL = 5,
  HIGH = 1,
  URGENT = 0,
}

/**
 * RAG request job data
 */
export interface RAGRequestJobData {
  userId: string;
  request: QuestionRequest;
  jobId?: string;
  priority?: QueuePriority;
  metadata?: {
    conversationId?: string;
    topicId?: string;
    documentIds?: string[];
    [key: string]: any;
  };
}

/**
 * RAG request job result
 */
export interface RAGRequestJobResult {
  success: boolean;
  answer?: string;
  sources?: any[];
  error?: string;
  processingTime?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  total: number;
}

/**
 * Request Queue Service
 * Manages RAG request queuing with priority support
 */
export class RequestQueueService {
  private static ragQueue: Queue<RAGRequestJobData, RAGRequestJobResult> | null = null;
  private static readonly QUEUE_NAME = 'rag-requests';
  private static readonly DEFAULT_PRIORITY = QueuePriority.NORMAL;
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly ATTEMPT_DELAY = 5000; // 5 seconds

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
   * Initialize the queue
   */
  static async initialize(): Promise<void> {
    if (this.ragQueue) {
      return; // Already initialized
    }

    try {
      const connection = this.getRedisConnection();
      
      const queueOptions: QueueOptions = {
        connection,
        defaultJobOptions: {
          attempts: this.MAX_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: this.ATTEMPT_DELAY,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep last 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      };

      this.ragQueue = new Queue<RAGRequestJobData, RAGRequestJobResult>(
        this.QUEUE_NAME,
        queueOptions
      );

      logger.info('Request queue initialized', {
        queueName: this.QUEUE_NAME,
      });
    } catch (error: any) {
      logger.error('Failed to initialize request queue', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get the queue instance
   */
  static getQueue(): Queue<RAGRequestJobData, RAGRequestJobResult> {
    if (!this.ragQueue) {
      throw new Error('Queue not initialized. Call initialize() first.');
    }
    return this.ragQueue;
  }

  /**
   * Add a RAG request to the queue
   */
  static async addRAGRequest(
    userId: string,
    request: QuestionRequest,
    options?: {
      priority?: QueuePriority;
      delay?: number; // Delay in milliseconds
      jobId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Job<RAGRequestJobData, RAGRequestJobResult>> {
    const queue = this.getQueue();

    const jobData: RAGRequestJobData = {
      userId,
      request,
      priority: options?.priority || this.DEFAULT_PRIORITY,
      metadata: {
        conversationId: request.conversationId,
        topicId: request.topicId,
        documentIds: request.documentIds,
        ...options?.metadata,
      },
    };

    const jobOptions: JobOptions = {
      priority: options?.priority || this.DEFAULT_PRIORITY,
      jobId: options?.jobId,
      delay: options?.delay,
    };

    const job = await queue.add('rag-request', jobData, jobOptions);

    logger.info('RAG request added to queue', {
      jobId: job.id,
      userId,
      priority: jobData.priority,
      questionLength: request.question.length,
    });

    return job;
  }

  /**
   * Get job by ID
   */
  static async getJob(jobId: string): Promise<Job<RAGRequestJobData, RAGRequestJobResult> | undefined> {
    const queue = this.getQueue();
    return queue.getJob(jobId);
  }

  /**
   * Get job status
   */
  static async getJobStatus(jobId: string): Promise<{
    id: string;
    state: string;
    progress?: number;
    result?: RAGRequestJobResult;
    error?: string;
    timestamp?: number;
  } | null> {
    const job = await this.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id!,
      state,
      progress: typeof progress === 'number' ? progress : undefined,
      result,
      error: failedReason,
      timestamp: job.timestamp,
    };
  }

  /**
   * Cancel a job
   */
  static async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.remove();
      logger.info('Job cancelled', { jobId });
      return true;
    } catch (error: any) {
      logger.error('Failed to cancel job', {
        jobId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<QueueStats> {
    const queue = this.getQueue();

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.getPausedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + completed + failed + delayed + paused,
    };
  }

  /**
   * Get jobs by state
   */
  static async getJobsByState(
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused',
    start = 0,
    end = 9
  ): Promise<Job<RAGRequestJobData, RAGRequestJobResult>[]> {
    const queue = this.getQueue();

    switch (state) {
      case 'waiting':
        return queue.getWaiting(start, end);
      case 'active':
        return queue.getActive(start, end);
      case 'completed':
        return queue.getCompleted(start, end);
      case 'failed':
        return queue.getFailed(start, end);
      case 'delayed':
        return queue.getDelayed(start, end);
      case 'paused':
        return queue.getPaused(start, end);
      default:
        return [];
    }
  }

  /**
   * Pause the queue
   */
  static async pauseQueue(): Promise<void> {
    const queue = this.getQueue();
    await queue.pause();
    logger.info('Queue paused');
  }

  /**
   * Resume the queue
   */
  static async resumeQueue(): Promise<void> {
    const queue = this.getQueue();
    await queue.resume();
    logger.info('Queue resumed');
  }

  /**
   * Clean the queue (remove old jobs)
   */
  static async cleanQueue(
    grace: number = 1000,
    limit: number = 1000,
    status: 'completed' | 'wait' | 'active' | 'paused' | 'delayed' | 'failed' = 'completed'
  ): Promise<number> {
    const queue = this.getQueue();
    const cleaned = await queue.clean(grace, limit, status);
    logger.info('Queue cleaned', {
      status,
      cleaned: cleaned.length,
    });
    return cleaned.length;
  }

  /**
   * Close the queue
   */
  static async close(): Promise<void> {
    if (this.ragQueue) {
      await this.ragQueue.close();
      this.ragQueue = null;
      logger.info('Queue closed');
    }
  }

  /**
   * Get queue health
   */
  static async getQueueHealth(): Promise<{
    healthy: boolean;
    connected: boolean;
    stats: QueueStats;
    error?: string;
  }> {
    try {
      const stats = await this.getQueueStats();
      const queue = this.getQueue();
      
      // Check if queue is connected by trying to get waiting count
      await queue.getWaitingCount();

      return {
        healthy: true,
        connected: true,
        stats,
      };
    } catch (error: any) {
      return {
        healthy: false,
        connected: false,
        stats: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
          total: 0,
        },
        error: error.message,
      };
    }
  }
}

export default RequestQueueService;
