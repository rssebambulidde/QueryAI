/**
 * Renewal Reminder Scheduler
 * Sends renewal reminders 3, 7, and 14 days before period end. Run via daily cron.
 */

import { Database } from '../types/database';
import { DatabaseService } from './database.service';
import logger from '../config/logger';

const REMINDER_DAYS = [3, 7, 14] as const;

export async function runRenewalReminderScheduler(): Promise<void> {
  logger.info('Renewal reminder scheduler: starting');
  try {
    const { supabaseAdmin } = await import('../config/database');
    const { getPricing } = await import('../constants/pricing');
    const { EmailService } = await import('./email.service');

    const now = new Date();

    for (const days of REMINDER_DAYS) {
      const minEnd = new Date(now.getTime() + (days - 0.5) * 24 * 60 * 60 * 1000);
      const maxEnd = new Date(now.getTime() + (days + 0.5) * 24 * 60 * 60 * 1000);

      const { data: subscriptions, error } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .neq('tier', 'free')
        .eq('cancel_at_period_end', false)
        .gte('current_period_end', minEnd.toISOString())
        .lte('current_period_end', maxEnd.toISOString());

      if (error) {
        logger.error('Renewal reminder scheduler: fetch failed', { days, error });
        continue;
      }
      if (!subscriptions?.length) continue;

      for (const sub of subscriptions as Database.Subscription[]) {
        try {
          const user = await DatabaseService.getUserProfile(sub.user_id);
          if (!user) continue;

          const currency = 'USD' as const;
          const amount = getPricing(sub.tier as 'pro', 'monthly');
          const payments = await DatabaseService.getUserPayments(sub.user_id, 5);
          const lastForTier = payments.find(
            (p) => p.tier === sub.tier && p.status === 'completed'
          );
          const paymentMethod = lastForTier?.payment_method?.trim() || undefined;
          await EmailService.sendRenewalReminderEmail(
            user.email,
            user.full_name || user.email,
            sub,
            days,
            { amount, currency, paymentMethod }
          );
          logger.info('Renewal reminder sent', { userId: sub.user_id, tier: sub.tier, days });
        } catch (e) {
          logger.error('Renewal reminder failed', { subscriptionId: sub.id, days, error: e });
        }
      }
    }

    logger.info('Renewal reminder scheduler: done');
  } catch (e) {
    logger.error('Renewal reminder scheduler failed', { error: e });
    throw e;
  }
}
