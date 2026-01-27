/**
 * Database Connection Pool Configuration
 * Manages Supabase connection pooling and monitoring
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './env';
import logger from './logger';

export interface DatabasePoolConfig {
  maxConnections?: number;
  minConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageResponseTime: number;
  lastQueryTime?: number;
}

/**
 * Database Connection Pool Manager
 * Manages Supabase client connections with pooling and monitoring
 */
export class DatabasePool {
  private static adminClient: SupabaseClient | null = null;
  private static userClient: SupabaseClient | null = null;
  private static poolConfig: DatabasePoolConfig;
  private static stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    averageResponseTime: 0,
  };
  private static responseTimes: number[] = [];
  private static readonly MAX_RESPONSE_TIME_SAMPLES = 1000;

  /**
   * Initialize database connection pool
   */
  static initialize(poolConfig?: DatabasePoolConfig): void {
    this.poolConfig = {
      maxConnections: poolConfig?.maxConnections || 20,
      minConnections: poolConfig?.minConnections || 5,
      connectionTimeout: poolConfig?.connectionTimeout || 30000,
      idleTimeout: poolConfig?.idleTimeout || 60000,
      maxRetries: poolConfig?.maxRetries || 3,
      retryDelay: poolConfig?.retryDelay || 1000,
    };

    // Clean URL - remove trailing slash if present
    const cleanedUrl = config.SUPABASE_URL.trim().replace(/\/+$/, '');

    // Create admin client (singleton)
    if (!this.adminClient) {
      this.adminClient = createClient(cleanedUrl, config.SUPABASE_SERVICE_ROLE_KEY.trim(), {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        // Connection pooling options
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-client-info': 'queryai-backend',
          },
        },
      });

      logger.info('Database admin client initialized', {
        url: `${cleanedUrl.substring(0, 30)}...`,
        poolConfig: this.poolConfig,
      });
    }

    // Create user client (singleton)
    if (!this.userClient) {
      this.userClient = createClient(cleanedUrl, config.SUPABASE_ANON_KEY.trim(), {
        auth: {
          autoRefreshToken: true,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-client-info': 'queryai-backend',
          },
        },
      });

      logger.info('Database user client initialized', {
        url: `${cleanedUrl.substring(0, 30)}...`,
      });
    }

    // Note: Supabase JS client handles connection pooling internally
    // We track statistics and provide monitoring
    this.stats.totalConnections = 2; // Admin + User client
    this.stats.idleConnections = 2;
  }

  /**
   * Get admin client (for backend operations)
   */
  static getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      this.initialize();
    }
    return this.adminClient!;
  }

  /**
   * Get user client (for user operations)
   */
  static getUserClient(): SupabaseClient {
    if (!this.userClient) {
      this.initialize();
    }
    return this.userClient!;
  }

  /**
   * Execute query with monitoring
   */
  static async executeQuery<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    isAdmin: boolean = true
  ): Promise<{ data: T | null; error: any }> {
    const startTime = Date.now();
    this.stats.totalQueries++;
    this.stats.activeConnections++;

    try {
      const result = await queryFn();
      const responseTime = Date.now() - startTime;

      if (result.error) {
        this.stats.failedQueries++;
      } else {
        this.stats.successfulQueries++;
      }

      // Track response time
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > this.MAX_RESPONSE_TIME_SAMPLES) {
        this.responseTimes.shift();
      }

      // Update average response time
      const sum = this.responseTimes.reduce((a, b) => a + b, 0);
      this.stats.averageResponseTime = sum / this.responseTimes.length;
      this.stats.lastQueryTime = Date.now();

      return result;
    } catch (error: any) {
      this.stats.failedQueries++;
      const responseTime = Date.now() - startTime;

      // Track response time even for errors
      this.responseTimes.push(responseTime);
      if (this.responseTimes.length > this.MAX_RESPONSE_TIME_SAMPLES) {
        this.responseTimes.shift();
      }

      logger.error('Database query error', {
        error: error.message,
        responseTime,
      });

      throw error;
    } finally {
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
      this.stats.idleConnections = this.stats.totalConnections - this.stats.activeConnections;
    }
  }

  /**
   * Get connection statistics
   */
  static getStats(): ConnectionStats {
    return {
      ...this.stats,
      // Calculate percentiles
      averageResponseTime: this.stats.averageResponseTime,
    };
  }

  /**
   * Get pool configuration
   */
  static getPoolConfig(): DatabasePoolConfig {
    return { ...this.poolConfig };
  }

  /**
   * Reset statistics
   */
  static resetStats(): void {
    this.stats = {
      totalConnections: this.stats.totalConnections,
      activeConnections: 0,
      idleConnections: this.stats.totalConnections,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
    };
    this.responseTimes = [];
  }

  /**
   * Health check
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    stats: ConnectionStats;
  }> {
    try {
      const client = this.getAdminClient();
      const startTime = Date.now();

      const { error } = await client.from('user_profiles').select('id').limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        // Table might not exist, but connection works
        if (error.code === '42P01' || error.code === 'PGRST116') {
          return {
            healthy: true,
            message: 'Database connected (tables not yet created)',
            stats: this.getStats(),
          };
        }

        return {
          healthy: false,
          message: `Database query failed: ${error.message}`,
          stats: this.getStats(),
        };
      }

      return {
        healthy: true,
        message: `Database healthy (response time: ${responseTime}ms)`,
        stats: this.getStats(),
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: `Database health check failed: ${error.message}`,
        stats: this.getStats(),
      };
    }
  }

  /**
   * Close all connections
   */
  static async close(): Promise<void> {
    // Supabase clients don't need explicit closing, but we can reset stats
    this.resetStats();
    logger.info('Database connection pool closed');
  }
}

// Initialize pool on module load
DatabasePool.initialize();

// Export singleton clients for backward compatibility
export const supabaseAdmin = DatabasePool.getAdminClient();
export const supabase = DatabasePool.getUserClient();

// Export pool manager
export default DatabasePool;
