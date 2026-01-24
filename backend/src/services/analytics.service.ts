import { supabaseAdmin } from '../config/database';
import { Database } from '../types/database';
import logger from '../config/logger';
import { AppError } from '../types/error';
import { DatabaseService } from './database.service';

export interface QueryStatistics {
  totalQueries: number;
  queriesThisMonth: number;
  queriesLastMonth: number;
  queriesThisWeek: number;
  averagePerDay: number;
  peakDay: {
    date: string;
    count: number;
  };
}

export interface TopQuery {
  query: string;
  count: number;
  lastAsked: string;
  conversationId?: string;
}

export interface APIUsageMetrics {
  totalApiCalls: number;
  apiCallsThisMonth: number;
  apiCallsLastMonth: number;
  apiCallsThisWeek: number;
  averagePerDay: number;
  byEndpoint: Array<{
    endpoint: string;
    count: number;
  }>;
}

export interface UsageByDate {
  date: string;
  queries: number;
  apiCalls: number;
  documentUploads: number;
}

export interface AnalyticsOverview {
  queryStatistics: QueryStatistics;
  topQueries: TopQuery[];
  apiUsageMetrics: APIUsageMetrics;
  usageByDate: UsageByDate[];
  documentUploads: {
    total: number;
    thisMonth: number;
    lastMonth: number;
  };
}

/**
 * Analytics Service
 * Provides analytics and usage statistics for Premium/Pro users
 */
export class AnalyticsService {
  /**
   * Get query statistics for a user
   */
  static async getQueryStatistics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<QueryStatistics> {
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)

      // Total queries
      const totalQueries = await DatabaseService.getUserUsageCount(userId, 'query');

      // This month
      const queriesThisMonth = await DatabaseService.getUserUsageCount(
        userId,
        'query',
        thisMonthStart
      );

      // Last month
      const lastMonthCount = await this.getUsageCountInRange(
        userId,
        'query',
        lastMonthStart,
        lastMonthEnd
      );

      // This week
      const queriesThisWeek = await DatabaseService.getUserUsageCount(
        userId,
        'query',
        thisWeekStart
      );

      // Average per day (this month)
      const daysInMonth = now.getDate();
      const averagePerDay = daysInMonth > 0 ? queriesThisMonth / daysInMonth : 0;

      // Peak day
      const peakDay = await this.getPeakDay(userId, 'query', thisMonthStart, now);

      return {
        totalQueries,
        queriesThisMonth,
        queriesLastMonth: lastMonthCount,
        queriesThisWeek,
        averagePerDay: Math.round(averagePerDay * 100) / 100,
        peakDay,
      };
    } catch (error) {
      logger.error('Error getting query statistics:', error);
      throw new AppError('Failed to get query statistics', 500, 'ANALYTICS_ERROR');
    }
  }

  /**
   * Get top queries for a user
   */
  static async getTopQueries(
    userId: string,
    limit: number = 10,
    startDate?: Date,
    endDate?: Date
  ): Promise<TopQuery[]> {
    try {
      // Get all user messages (queries) from conversations
      const { data: conversations, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('user_id', userId);

      if (convError) {
        logger.error('Error fetching conversations:', convError);
        throw new AppError('Failed to fetch conversations', 500, 'ANALYTICS_ERROR');
      }

      if (!conversations || conversations.length === 0) {
        return [];
      }

      const conversationIds = conversations.map((c) => c.id);

      // Build query for messages
      let query = supabaseAdmin
        .from('messages')
        .select('content, created_at, conversation_id')
        .in('conversation_id', conversationIds)
        .eq('role', 'user');

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
      }

      const { data: messages, error: messagesError } = await query.order('created_at', {
        ascending: false,
      });

      if (messagesError) {
        logger.error('Error fetching messages:', messagesError);
        throw new AppError('Failed to fetch messages', 500, 'ANALYTICS_ERROR');
      }

      if (!messages || messages.length === 0) {
        return [];
      }

      // Count queries and get most recent
      const queryMap = new Map<string, { count: number; lastAsked: string; conversationId?: string }>();

      for (const message of messages) {
        const content = (message.content || '').trim();
        if (!content) continue;

        const existing = queryMap.get(content);
        if (existing) {
          existing.count++;
          // Keep the most recent date
          if (new Date(message.created_at) > new Date(existing.lastAsked)) {
            existing.lastAsked = message.created_at;
            existing.conversationId = message.conversation_id;
          }
        } else {
          queryMap.set(content, {
            count: 1,
            lastAsked: message.created_at,
            conversationId: message.conversation_id,
          });
        }
      }

      // Convert to array and sort by count
      const topQueries: TopQuery[] = Array.from(queryMap.entries())
        .map(([query, data]) => ({
          query,
          count: data.count,
          lastAsked: data.lastAsked,
          conversationId: data.conversationId,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return topQueries;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting top queries:', error);
      throw new AppError('Failed to get top queries', 500, 'ANALYTICS_ERROR');
    }
  }

  /**
   * Get API usage metrics
   */
  static async getAPIUsageMetrics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<APIUsageMetrics> {
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - now.getDay());

      // Total API calls
      const totalApiCalls = await DatabaseService.getUserUsageCount(userId, 'api_call');

      // This month
      const apiCallsThisMonth = await DatabaseService.getUserUsageCount(
        userId,
        'api_call',
        thisMonthStart
      );

      // Last month
      const apiCallsLastMonth = await this.getUsageCountInRange(
        userId,
        'api_call',
        lastMonthStart,
        lastMonthEnd
      );

      // This week
      const apiCallsThisWeek = await DatabaseService.getUserUsageCount(
        userId,
        'api_call',
        thisWeekStart
      );

      // Average per day
      const daysInMonth = now.getDate();
      const averagePerDay = daysInMonth > 0 ? apiCallsThisMonth / daysInMonth : 0;

      // By endpoint
      const byEndpoint = await this.getUsageByEndpoint(userId, thisMonthStart, now);

      return {
        totalApiCalls,
        apiCallsThisMonth,
        apiCallsLastMonth,
        apiCallsThisWeek,
        averagePerDay: Math.round(averagePerDay * 100) / 100,
        byEndpoint,
      };
    } catch (error) {
      logger.error('Error getting API usage metrics:', error);
      throw new AppError('Failed to get API usage metrics', 500, 'ANALYTICS_ERROR');
    }
  }

  /**
   * Get usage by date (for charts)
   */
  static async getUsageByDate(
    userId: string,
    days: number = 30,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageByDate[]> {
    try {
      const end = endDate || new Date();
      const start = startDate || new Date();
      start.setDate(start.getDate() - days);

      const { data: usageLogs, error } = await supabaseAdmin
        .from('usage_logs')
        .select('type, created_at')
        .eq('user_id', userId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching usage by date:', error);
        throw new AppError('Failed to fetch usage by date', 500, 'ANALYTICS_ERROR');
      }

      if (!usageLogs || usageLogs.length === 0) {
        return [];
      }

      // Group by date
      const dateMap = new Map<string, { queries: number; apiCalls: number; documentUploads: number }>();

      for (const log of usageLogs) {
        const date = new Date(log.created_at).toISOString().split('T')[0]; // YYYY-MM-DD
        const existing = dateMap.get(date) || { queries: 0, apiCalls: 0, documentUploads: 0 };

        if (log.type === 'query') {
          existing.queries++;
        } else if (log.type === 'api_call') {
          existing.apiCalls++;
        } else if (log.type === 'document_upload') {
          existing.documentUploads++;
        }

        dateMap.set(date, existing);
      }

      // Convert to array and sort by date
      const usageByDate: UsageByDate[] = Array.from(dateMap.entries())
        .map(([date, counts]) => ({
          date,
          ...counts,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return usageByDate;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error getting usage by date:', error);
      throw new AppError('Failed to get usage by date', 500, 'ANALYTICS_ERROR');
    }
  }

  /**
   * Get complete analytics overview
   */
  static async getAnalyticsOverview(
    userId: string,
    days: number = 30
  ): Promise<AnalyticsOverview> {
    try {
      const [queryStatistics, topQueries, apiUsageMetrics, usageByDate, documentUploads] =
        await Promise.all([
          this.getQueryStatistics(userId),
          this.getTopQueries(userId, 10),
          this.getAPIUsageMetrics(userId),
          this.getUsageByDate(userId, days),
          this.getDocumentUploadStats(userId),
        ]);

      return {
        queryStatistics,
        topQueries,
        apiUsageMetrics,
        usageByDate,
        documentUploads,
      };
    } catch (error) {
      logger.error('Error getting analytics overview:', error);
      throw error;
    }
  }

  /**
   * Get document upload statistics
   */
  private static async getDocumentUploadStats(userId: string): Promise<{
    total: number;
    thisMonth: number;
    lastMonth: number;
  }> {
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const total = await DatabaseService.getUserUsageCount(userId, 'document_upload');
      const thisMonth = await DatabaseService.getUserUsageCount(
        userId,
        'document_upload',
        thisMonthStart
      );
      const lastMonth = await this.getUsageCountInRange(
        userId,
        'document_upload',
        lastMonthStart,
        lastMonthEnd
      );

      return {
        total,
        thisMonth,
        lastMonth,
      };
    } catch (error) {
      logger.error('Error getting document upload stats:', error);
      return { total: 0, thisMonth: 0, lastMonth: 0 };
    }
  }

  /**
   * Get usage count in a date range
   */
  private static async getUsageCountInRange(
    userId: string,
    type: 'query' | 'api_call' | 'document_upload',
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('usage_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', type)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) {
        logger.error('Error getting usage count in range:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('Failed to get usage count in range:', error);
      return 0;
    }
  }

  /**
   * Get peak day for a usage type
   */
  private static async getPeakDay(
    userId: string,
    type: 'query' | 'api_call' | 'document_upload',
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; count: number }> {
    try {
      const { data: logs, error } = await supabaseAdmin
        .from('usage_logs')
        .select('created_at')
        .eq('user_id', userId)
        .eq('type', type)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error || !logs || logs.length === 0) {
        return { date: new Date().toISOString().split('T')[0], count: 0 };
      }

      // Count by date
      const dateCounts = new Map<string, number>();
      for (const log of logs) {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
      }

      // Find peak
      let peakDate = '';
      let peakCount = 0;
      for (const [date, count] of dateCounts.entries()) {
        if (count > peakCount) {
          peakCount = count;
          peakDate = date;
        }
      }

      return { date: peakDate || new Date().toISOString().split('T')[0], count: peakCount };
    } catch (error) {
      logger.error('Error getting peak day:', error);
      return { date: new Date().toISOString().split('T')[0], count: 0 };
    }
  }

  /**
   * Get usage by endpoint
   */
  private static async getUsageByEndpoint(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ endpoint: string; count: number }>> {
    try {
      const { data: logs, error } = await supabaseAdmin
        .from('usage_logs')
        .select('metadata')
        .eq('user_id', userId)
        .eq('type', 'api_call')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error || !logs || logs.length === 0) {
        return [];
      }

      // Count by endpoint
      const endpointCounts = new Map<string, number>();
      for (const log of logs) {
        const endpoint = (log.metadata as any)?.endpoint || 'unknown';
        endpointCounts.set(endpoint, (endpointCounts.get(endpoint) || 0) + 1);
      }

      // Convert to array and sort
      return Array.from(endpointCounts.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } catch (error) {
      logger.error('Error getting usage by endpoint:', error);
      return [];
    }
  }
}
