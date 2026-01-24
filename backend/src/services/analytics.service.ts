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
   * @param days - Number of days to look back (if provided, calculates stats for that period)
   */
  static async getQueryStatistics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    days?: number
  ): Promise<QueryStatistics> {
    try {
      const now = endDate || new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999); // End of day
      
      // If days is provided, calculate period-based stats
      let periodStart: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;
      
      if (days) {
        // Calculate period based on days parameter
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - days);
        periodStart.setHours(0, 0, 0, 0); // Start of day
        
        // Previous period (same length, before current period)
        previousPeriodEnd = new Date(periodStart);
        previousPeriodEnd.setMilliseconds(previousPeriodEnd.getMilliseconds() - 1);
        previousPeriodStart = new Date(previousPeriodEnd);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
        previousPeriodStart.setHours(0, 0, 0, 0);
      } else {
        // Default: use month-based calculations
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        previousPeriodEnd.setHours(23, 59, 59, 999);
      }

      // Total queries (all time)
      const totalQueries = await DatabaseService.getUserUsageCount(userId, 'query');

      // Current period (this month or selected days)
      const queriesThisPeriod = await this.getUsageCountInRange(
        userId,
        'query',
        periodStart,
        end
      );

      // Previous period (last month or previous N days)
      const queriesPreviousPeriod = await this.getUsageCountInRange(
        userId,
        'query',
        previousPeriodStart,
        previousPeriodEnd
      );

      // This week (always last 7 days from today)
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - 7);
      thisWeekStart.setHours(0, 0, 0, 0);
      const queriesThisWeek = await this.getUsageCountInRange(
        userId,
        'query',
        thisWeekStart,
        end
      );

      // Average per day (current period)
      const periodDays = days || now.getDate();
      const averagePerDay = periodDays > 0 ? queriesThisPeriod / periodDays : 0;

      // Peak day (current period)
      const peakDay = await this.getPeakDay(userId, 'query', periodStart, end);

      return {
        totalQueries,
        queriesThisMonth: queriesThisPeriod,
        queriesLastMonth: queriesPreviousPeriod,
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
   * @param days - Number of days to look back (if provided, calculates stats for that period)
   */
  static async getAPIUsageMetrics(
    userId: string,
    startDate?: Date,
    endDate?: Date,
    days?: number
  ): Promise<APIUsageMetrics> {
    try {
      const now = endDate || new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999); // End of day
      
      // If days is provided, calculate period-based stats
      let periodStart: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;
      
      if (days) {
        // Calculate period based on days parameter
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - days);
        periodStart.setHours(0, 0, 0, 0); // Start of day
        
        // Previous period (same length, before current period)
        previousPeriodEnd = new Date(periodStart);
        previousPeriodEnd.setMilliseconds(previousPeriodEnd.getMilliseconds() - 1);
        previousPeriodStart = new Date(previousPeriodEnd);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
        previousPeriodStart.setHours(0, 0, 0, 0);
      } else {
        // Default: use month-based calculations
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        previousPeriodEnd.setHours(23, 59, 59, 999);
      }

      // Total API calls (all time)
      const totalApiCalls = await DatabaseService.getUserUsageCount(userId, 'api_call');

      // Current period (this month or selected days)
      const apiCallsThisPeriod = await this.getUsageCountInRange(
        userId,
        'api_call',
        periodStart,
        end
      );

      // Previous period (last month or previous N days)
      const apiCallsPreviousPeriod = await this.getUsageCountInRange(
        userId,
        'api_call',
        previousPeriodStart,
        previousPeriodEnd
      );

      // This week (always last 7 days from today)
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - 7);
      thisWeekStart.setHours(0, 0, 0, 0);
      const apiCallsThisWeek = await this.getUsageCountInRange(
        userId,
        'api_call',
        thisWeekStart,
        end
      );

      // Average per day (current period)
      const periodDays = days || now.getDate();
      const averagePerDay = periodDays > 0 ? apiCallsThisPeriod / periodDays : 0;

      // By endpoint (current period)
      const byEndpoint = await this.getUsageByEndpoint(userId, periodStart, end);

      return {
        totalApiCalls,
        apiCallsThisMonth: apiCallsThisPeriod,
        apiCallsLastMonth: apiCallsPreviousPeriod,
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
      end.setHours(23, 59, 59, 999); // End of day
      const start = startDate || (() => {
        const s = new Date(end);
        s.setDate(s.getDate() - days);
        s.setHours(0, 0, 0, 0); // Start of day
        return s;
      })();

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
   * @param days - Number of days to look back (affects all statistics)
   */
  static async getAnalyticsOverview(
    userId: string,
    days: number = 30
  ): Promise<AnalyticsOverview> {
    try {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);

      const [queryStatistics, topQueries, apiUsageMetrics, usageByDate, documentUploads] =
        await Promise.all([
          this.getQueryStatistics(userId, start, end, days),
          this.getTopQueries(userId, 10, start, end),
          this.getAPIUsageMetrics(userId, start, end, days),
          this.getUsageByDate(userId, days, start, end),
          this.getDocumentUploadStats(userId, days),
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
   * @param days - Number of days to look back (if provided, calculates stats for that period)
   */
  private static async getDocumentUploadStats(userId: string, days?: number): Promise<{
    total: number;
    thisMonth: number;
    lastMonth: number;
  }> {
    try {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999); // End of day
      
      // If days is provided, calculate period-based stats
      let periodStart: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;
      
      if (days) {
        // Calculate period based on days parameter
        periodStart = new Date(now);
        periodStart.setDate(now.getDate() - days);
        periodStart.setHours(0, 0, 0, 0); // Start of day
        
        // Previous period (same length, before current period)
        previousPeriodEnd = new Date(periodStart);
        previousPeriodEnd.setMilliseconds(previousPeriodEnd.getMilliseconds() - 1);
        previousPeriodStart = new Date(previousPeriodEnd);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
        previousPeriodStart.setHours(0, 0, 0, 0);
      } else {
        // Default: use month-based calculations
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        previousPeriodEnd.setHours(23, 59, 59, 999);
      }

      const total = await DatabaseService.getUserUsageCount(userId, 'document_upload');
      const thisPeriod = await this.getUsageCountInRange(
        userId,
        'document_upload',
        periodStart,
        end
      );
      const previousPeriod = await this.getUsageCountInRange(
        userId,
        'document_upload',
        previousPeriodStart,
        previousPeriodEnd
      );

      return {
        total,
        thisMonth: thisPeriod,
        lastMonth: previousPeriod,
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
