import { DatabaseService } from './database.service';
import { SubscriptionService, TIER_LIMITS } from './subscription.service';
import { Database } from '../types/database';
import logger from '../config/logger';

/**
 * Usage Service
 * Provides usage monitoring and statistics
 */

export interface UsageStats {
  queries: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number; // 0-100, or -1 for unlimited
  };
  documentUploads: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
  };
  topics: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
  };
  apiCalls?: {
    used: number;
    limit: number | null;
    remaining: number | null;
    percentage: number;
  };
  periodStart: string;
  periodEnd: string;
  tier: 'free' | 'premium' | 'pro';
}

export interface UsageHistory {
  date: string;
  queries: number;
  documentUploads: number;
  apiCalls: number;
}

/**
 * Usage Service
 */
export class UsageService {
  /**
   * Get current usage statistics for a user
   */
  static async getCurrentUsage(userId: string): Promise<UsageStats | null> {
    try {
      const subscriptionData = await SubscriptionService.getUserSubscriptionWithLimits(userId);
      
      if (!subscriptionData) {
        return null;
      }

      const { subscription, limits } = subscriptionData;

      // Calculate current period (monthly)
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);

      // Get usage counts for current month
      const [queriesUsed, documentUploadsUsed, apiCallsUsed] = await Promise.all([
        DatabaseService.getUserUsageCount(userId, 'query', periodStart, periodEnd),
        DatabaseService.getUserUsageCount(userId, 'document_upload', periodStart, periodEnd),
        DatabaseService.getUserUsageCount(userId, 'api_call', periodStart, periodEnd),
      ]);

      // Get topic count
      const { TopicService } = await import('./topic.service');
      const topics = await TopicService.getUserTopics(userId);
      const topicsUsed = topics?.length || 0;

      // Calculate percentages and remaining
      const calculateUsage = (
        used: number,
        limit: number | null
      ): { used: number; limit: number | null; remaining: number | null; percentage: number } => {
        if (limit === null) {
          return {
            used,
            limit: null,
            remaining: null,
            percentage: -1, // Unlimited
          };
        }
        const remaining = Math.max(0, limit - used);
        const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        return {
          used,
          limit,
          remaining,
          percentage,
        };
      };

      return {
        queries: calculateUsage(queriesUsed, limits.queriesPerMonth),
        documentUploads: calculateUsage(documentUploadsUsed, limits.documentUploads),
        topics: calculateUsage(topicsUsed, limits.maxTopics),
        apiCalls: calculateUsage(apiCallsUsed, null), // API calls are unlimited for now
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        tier: subscription.tier,
      };
    } catch (error) {
      logger.error('Failed to get current usage:', error);
      return null;
    }
  }

  /**
   * Get usage history for a user (last 30 days)
   */
  static async getUsageHistory(userId: string, days: number = 30): Promise<UsageHistory[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all usage logs for the period
      const { supabaseAdmin } = await import('../config/database');
      const { data: usageLogs, error } = await supabaseAdmin
        .from('usage_logs')
        .select('type, created_at')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching usage history:', error);
        return [];
      }

      // Group by date
      const usageByDate = new Map<string, { queries: number; documentUploads: number; apiCalls: number }>();

      // Initialize all dates in range
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        usageByDate.set(dateKey, { queries: 0, documentUploads: 0, apiCalls: 0 });
      }

      // Count usage by date
      usageLogs?.forEach((log) => {
        const dateKey = new Date(log.created_at).toISOString().split('T')[0];
        const dayUsage = usageByDate.get(dateKey);
        if (dayUsage) {
          if (log.type === 'query') dayUsage.queries++;
          else if (log.type === 'document_upload') dayUsage.documentUploads++;
          else if (log.type === 'api_call') dayUsage.apiCalls++;
        }
      });

      // Convert to array
      return Array.from(usageByDate.entries())
        .map(([date, usage]) => ({
          date,
          ...usage,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      logger.error('Failed to get usage history:', error);
      return [];
    }
  }

  /**
   * Check if user is approaching limits (80% threshold)
   */
  static async isApproachingLimits(userId: string): Promise<{
    approaching: boolean;
    warnings: Array<{ type: 'queries' | 'documentUploads' | 'topics'; percentage: number }>;
  }> {
    try {
      const usage = await this.getCurrentUsage(userId);
      if (!usage) {
        return { approaching: false, warnings: [] };
      }

      const warnings: Array<{ type: 'queries' | 'documentUploads' | 'topics'; percentage: number }> = [];

      if (usage.queries.percentage >= 80 && usage.queries.percentage !== -1) {
        warnings.push({ type: 'queries', percentage: usage.queries.percentage });
      }

      if (usage.documentUploads.percentage >= 80 && usage.documentUploads.percentage !== -1) {
        warnings.push({ type: 'documentUploads', percentage: usage.documentUploads.percentage });
      }

      if (usage.topics.percentage >= 80 && usage.topics.percentage !== -1) {
        warnings.push({ type: 'topics', percentage: usage.topics.percentage });
      }

      return {
        approaching: warnings.length > 0,
        warnings,
      };
    } catch (error) {
      logger.error('Failed to check approaching limits:', error);
      return { approaching: false, warnings: [] };
    }
  }
}
