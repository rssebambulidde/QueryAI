/**
 * Email Scheduler
 * Runs payment reminders, renewal reminders, expiration warnings, and email queue processing.
 * Configure for daily execution via Railway Cron, GitHub Actions, or POST /api/jobs/email-scheduler.
 */

import logger from '../config/logger';
import { runPaymentReminderScheduler } from '../services/payment-reminder.service';
import { runRenewalReminderScheduler } from '../services/renewal-reminder.service';
import { runExpirationWarningScheduler } from '../services/expiration-warning.service';
import { runSubscriptionLifecycleScheduler } from '../services/subscription-lifecycle.service';
import { runUsageAlertProcessor } from '../services/usage-alerts.service';
import { processEmailQueue } from '../services/email-queue.service';

export async function runEmailScheduler(): Promise<void> {
  logger.info('Email scheduler: starting');
  try {
    await runPaymentReminderScheduler();
    await runRenewalReminderScheduler();
    await runExpirationWarningScheduler();
    await runSubscriptionLifecycleScheduler();
    await runUsageAlertProcessor();
    const q = await processEmailQueue(100);
    logger.info('Email scheduler: queue processed', { processed: q.processed, sent: q.sent, failed: q.failed });
    logger.info('Email scheduler: done');
  } catch (error) {
    logger.error('Email scheduler failed', { error });
    throw error;
  }
}

export async function runEmailSchedulerAndExit(): Promise<void> {
  try {
    await runEmailScheduler();
    process.exit(0);
  } catch (error) {
    logger.error('Email scheduler exited with error', { error });
    process.exit(1);
  }
}
