/**
 * Payment Reminder Scheduler
 * Sends payment reminders 7 days before renewal. Run via daily cron.
 */

import { SubscriptionService } from './subscription.service';
import logger from '../config/logger';

export async function runPaymentReminderScheduler(): Promise<void> {
  logger.info('Payment reminder scheduler: starting');
  try {
    await SubscriptionService.processRenewalReminders();
    logger.info('Payment reminder scheduler: done');
  } catch (e) {
    logger.error('Payment reminder scheduler failed', { error: e });
    throw e;
  }
}
