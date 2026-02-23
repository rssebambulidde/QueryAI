/**
 * Usage Alerts Service  (9.6.9)
 *
 * Scheduled processor (daily cron) that:
 * 1. Reads admin-configurable thresholds from system_settings
 *    (key = `usage_alert_thresholds`).
 * 2. For every active paid/free user, checks current-month usage
 *    against tier limits.
 * 3. When a threshold is crossed (e.g. 80 %, 100 %), sends an email
 *    **and** creates an in-app notification (user_notifications row).
 * 4. De-duplicates: never sends the same metric+threshold alert twice
 *    in the same billing period.
 *
 * Also exposes helpers consumed by the notification routes.
 */

import logger from '../config/logger';
import { z } from 'zod';

// ── Threshold config schema ──────────────────────────────────────────────────

const UsageAlertThresholdsSchema = z.object({
  /** Percentage thresholds that trigger alerts (e.g. [80, 100]). Sorted ascending. */
  thresholds: z.array(z.number().int().min(1).max(100)).min(1),
  /** Master enable/disable toggle. */
  enabled: z.boolean(),
  /** Which metrics to monitor. */
  metrics: z.array(z.enum(['queries', 'tavilySearches', 'collections'])),
});

export type UsageAlertThresholds = z.infer<typeof UsageAlertThresholdsSchema>;

const SETTINGS_KEY = 'usage_alert_thresholds';

const DEFAULT_THRESHOLDS: UsageAlertThresholds = {
  thresholds: [80, 100],
  enabled: true,
  metrics: ['queries', 'tavilySearches', 'collections'],
};

// ── Public helpers ───────────────────────────────────────────────────────────

export class UsageAlertsService {
  /** Read current thresholds (DB → fallback). */
  static async getThresholds(): Promise<UsageAlertThresholds> {
    try {
      const { SystemSettingsService } = await import('./system-settings.service');
      const raw = await SystemSettingsService.get<unknown>(SETTINGS_KEY);
      if (raw) {
        const parsed = UsageAlertThresholdsSchema.safeParse(raw);
        if (parsed.success) return parsed.data;
        logger.warn('usage_alert_thresholds failed Zod validation — using default', {
          issues: parsed.error.issues,
        });
      }
    } catch (err) {
      logger.warn('UsageAlertsService.getThresholds failed — using default', {
        error: (err as Error).message,
      });
    }
    return DEFAULT_THRESHOLDS;
  }

  /** Persist updated thresholds (admin action). */
  static async updateThresholds(
    value: unknown,
    updatedBy: string,
  ): Promise<UsageAlertThresholds> {
    const parsed = UsageAlertThresholdsSchema.parse(value);
    // Sort ascending for consistent processing
    parsed.thresholds.sort((a, b) => a - b);

    const { SystemSettingsService } = await import('./system-settings.service');
    await SystemSettingsService.set(SETTINGS_KEY, parsed, updatedBy);
    logger.info('Usage alert thresholds updated', { updatedBy, thresholds: parsed });
    return parsed;
  }

  /** Expose the Zod schema for route validation. */
  static get schema() {
    return UsageAlertThresholdsSchema;
  }

  // ── Notification CRUD (in-app) ──────────────────────────────────────────

  /** Get user's notifications (newest first, paginated). */
  static async getUserNotifications(
    userId: string,
    opts: { limit?: number; unreadOnly?: boolean } = {},
  ) {
    const { supabaseAdmin } = await import('../config/database');
    let query = supabaseAdmin
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50);

    if (opts.unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) {
      logger.error('getUserNotifications failed', { userId, error: error.message });
      throw error;
    }
    return data ?? [];
  }

  /** Count unread notifications. */
  static async getUnreadCount(userId: string): Promise<number> {
    const { supabaseAdmin } = await import('../config/database');
    const { count, error } = await supabaseAdmin
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      logger.error('getUnreadCount failed', { userId, error: error.message });
      return 0;
    }
    return count ?? 0;
  }

  /** Mark a single notification as read. */
  static async markRead(notificationId: string, userId: string): Promise<boolean> {
    const { supabaseAdmin } = await import('../config/database');
    const { error } = await supabaseAdmin
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId); // ownership guard

    if (error) {
      logger.error('markRead failed', { notificationId, error: error.message });
      return false;
    }
    return true;
  }

  /** Mark all user notifications as read. */
  static async markAllRead(userId: string): Promise<number> {
    const { supabaseAdmin } = await import('../config/database');
    const { data, error } = await supabaseAdmin
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      logger.error('markAllRead failed', { userId, error: error.message });
      return 0;
    }
    return data?.length ?? 0;
  }

  /** Create an in-app notification for a user. */
  static async createNotification(params: {
    userId: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { supabaseAdmin } = await import('../config/database');
    const { error } = await supabaseAdmin.from('user_notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? {},
    });

    if (error) {
      logger.error('createNotification failed', { error: error.message, params });
    }
  }
}

// ── Scheduled processor ─────────────────────────────────────────────────────

/**
 * Check all active users against their tier limits and send alerts.
 * Called from the daily email-scheduler cron.
 */
export async function runUsageAlertProcessor(): Promise<void> {
  logger.info('Usage alert processor: starting');

  const config = await UsageAlertsService.getThresholds();
  if (!config.enabled) {
    logger.info('Usage alert processor: disabled by admin');
    return;
  }

  try {
    const { supabaseAdmin } = await import('../config/database');
    const { DatabaseService } = await import('./database.service');
    const { SubscriptionService } = await import('./subscription.service');
    const { EmailService } = await import('./email.service');
    const { TierConfigService } = await import('./tier-config.service');

    // Sorted thresholds ascending
    const thresholds = [...config.thresholds].sort((a, b) => a - b);

    // Current billing period (calendar month)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    periodEnd.setHours(23, 59, 59, 999);
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Fetch all active subscriptions (non-enterprise unlimited users are the main target,
    // but we check everyone with finite limits)
    const { data: subscriptions, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, tier')
      .eq('status', 'active');

    if (subErr || !subscriptions?.length) {
      if (subErr) logger.error('Usage alert processor: fetch subs failed', { error: subErr });
      return;
    }

    const allLimits = await TierConfigService.getAllLimits();
    let alertsSent = 0;

    for (const sub of subscriptions) {
      try {
        const tierLimits = allLimits[sub.tier as keyof typeof allLimits];
        if (!tierLimits) continue;

        // Build usage map for configured metrics
        const usageChecks: {
          metric: string;
          label: string;
          used: number;
          limit: number;
        }[] = [];

        if (config.metrics.includes('queries') && tierLimits.queriesPerMonth !== null) {
          const used = await DatabaseService.getUserUsageCount(
            sub.user_id, 'query', periodStart, periodEnd,
          );
          usageChecks.push({
            metric: 'queries',
            label: 'Queries',
            used,
            limit: tierLimits.queriesPerMonth,
          });
        }

        if (config.metrics.includes('tavilySearches') && tierLimits.tavilySearchesPerMonth !== null) {
          const used = await SubscriptionService.getTavilyUsageCount(
            sub.user_id, periodStart, periodEnd,
          );
          usageChecks.push({
            metric: 'tavilySearches',
            label: 'Web Searches',
            used,
            limit: tierLimits.tavilySearchesPerMonth,
          });
        }

        if (config.metrics.includes('collections') && tierLimits.maxCollections !== null) {
          const { count } = await supabaseAdmin
            .from('collections')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', sub.user_id);
          usageChecks.push({
            metric: 'collections',
            label: 'Collections',
            used: count ?? 0,
            limit: tierLimits.maxCollections,
          });
        }

        // For each metric, find the highest threshold crossed
        for (const check of usageChecks) {
          const pct = check.limit > 0 ? Math.round((check.used / check.limit) * 100) : 0;
          // Find highest threshold that's been crossed
          let crossedThreshold: number | null = null;
          for (const t of thresholds) {
            if (pct >= t) crossedThreshold = t;
          }
          if (crossedThreshold === null) continue;

          // De-dup: check if we already sent this alert this period
          const dedup = await supabaseAdmin
            .from('user_notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', sub.user_id)
            .eq('type', crossedThreshold >= 100 ? 'usage_limit' : 'usage_warning')
            .gte('created_at', periodStart.toISOString())
            .contains('metadata', { metric: check.metric, threshold: crossedThreshold } as any);

          if ((dedup.count ?? 0) > 0) continue; // already alerted

          // Determine alert severity
          const isLimit = crossedThreshold >= 100;
          const type = isLimit ? 'usage_limit' : 'usage_warning';
          const title = isLimit
            ? `${check.label} Limit Reached`
            : `${check.label} Usage at ${crossedThreshold}%`;
          const message = isLimit
            ? `You've used ${check.used.toLocaleString()} of your ${check.limit.toLocaleString()} ${check.label.toLowerCase()} this month.`
            : `You've used ${check.used.toLocaleString()} of ${check.limit.toLocaleString()} ${check.label.toLowerCase()} (${pct}%). Consider upgrading for more capacity.`;

          // Create in-app notification
          await UsageAlertsService.createNotification({
            userId: sub.user_id,
            type,
            title,
            message,
            metadata: {
              metric: check.metric,
              threshold: crossedThreshold,
              percentage: pct,
              used: check.used,
              limit: check.limit,
              period: periodKey,
              tier: sub.tier,
            },
          });

          // Send email
          try {
            const user = await DatabaseService.getUserProfile(sub.user_id);
            if (user) {
              await EmailService.sendUsageAlertEmail(
                user.email,
                user.full_name || user.email,
                {
                  metric: check.label,
                  used: check.used,
                  limit: check.limit,
                  percentage: pct,
                  isLimit,
                  tier: sub.tier,
                },
              );
            }
          } catch (emailErr) {
            logger.error('Usage alert email failed', {
              userId: sub.user_id,
              metric: check.metric,
              error: (emailErr as Error).message,
            });
          }

          alertsSent++;
        }
      } catch (userErr) {
        logger.error('Usage alert check failed for user', {
          userId: sub.user_id,
          error: (userErr as Error).message,
        });
      }
    }

    logger.info('Usage alert processor: done', { alertsSent, usersChecked: subscriptions.length });
  } catch (err) {
    logger.error('Usage alert processor failed', { error: err });
  }
}
