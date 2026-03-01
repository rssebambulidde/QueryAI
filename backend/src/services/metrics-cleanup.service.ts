/**
 * Metrics Cleanup Service
 *
 * Retention-based cleanup for monitoring tables to prevent unbounded growth.
 * Called daily by the email scheduler cron job and available via admin endpoint.
 */

import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

interface RetentionConfig {
  table: string;
  retentionDays: number;
  timestampColumn: string;
}

export class MetricsCleanupService {
  private static readonly RETENTION_CONFIGS: RetentionConfig[] = [
    { table: 'latency_metrics', retentionDays: 30, timestampColumn: 'timestamp' },
    { table: 'latency_alerts', retentionDays: 90, timestampColumn: 'timestamp' },
    { table: 'error_metrics', retentionDays: 30, timestampColumn: 'timestamp' },
    { table: 'error_rate_alerts', retentionDays: 90, timestampColumn: 'timestamp' },
  ];

  /**
   * Delete rows older than the retention period from all metrics tables.
   * Returns the count of deleted rows per table.
   */
  static async cleanup(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    for (const config of this.RETENTION_CONFIGS) {
      try {
        const cutoff = new Date(Date.now() - config.retentionDays * 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
          .from(config.table as any)
          .delete()
          .lt(config.timestampColumn, cutoff)
          .select('id');

        if (error) {
          logger.warn(`Metrics cleanup failed for ${config.table}`, { error: error.message });
          results[config.table] = 0;
        } else {
          const deleted = data?.length ?? 0;
          results[config.table] = deleted;
          if (deleted > 0) {
            logger.info(`Metrics cleanup: ${config.table}`, {
              deleted,
              retentionDays: config.retentionDays,
              cutoff,
            });
          }
        }
      } catch (err: any) {
        logger.error(`Metrics cleanup error for ${config.table}`, { error: err.message });
        results[config.table] = 0;
      }
    }

    logger.info('Metrics cleanup completed', { results });
    return results;
  }
}
