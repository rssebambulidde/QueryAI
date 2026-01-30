/**
 * Expiration Warning Scheduler
 * Sends expiration warnings 3 days before period end for cancel_at_period_end subscriptions. Run via daily cron.
 */

import { SubscriptionService } from './subscription.service';
import logger from '../config/logger';

export async function runExpirationWarningScheduler(): Promise<void> {
  logger.info('Expiration warning scheduler: starting');
  try {
    await SubscriptionService.processExpirationWarnings();
    logger.info('Expiration warning scheduler: done');
  } catch (e) {
    logger.error('Expiration warning scheduler failed', { error: e });
    throw e;
  }
}
