/**
 * Renewal Job
 * Scheduled job to process subscription renewals
 * 
 * This should be called by a cron job or scheduled task
 * Example: Run daily at midnight UTC
 * 
 * Setup options:
 * 1. Railway Cron Jobs (using Cron Schedule field)
 * 2. GitHub Actions Scheduled Workflows
 * 3. External cron service (cron-job.org, etc.)
 * 4. Node-cron library (for single-instance deployments)
 * 
 * For Railway cron jobs:
 * - Set RAILWAY_CRON=true environment variable
 * - Set Cron Schedule in Railway service settings
 * - Service will run job and exit
 */

import { SubscriptionService } from '../services/subscription.service';
import { PaymentRetryService } from '../services/payment-retry.service';
import logger from '../config/logger';

/**
 * Main renewal job function
 * Processes subscription renewals and payment retries
 */
export async function runRenewalJob(): Promise<void> {
  logger.info('Starting renewal job...');
  
  try {
    // Process subscription renewals
    await SubscriptionService.processRenewals();
    logger.info('Subscription renewals processed');

    // Process failed payment retries
    await PaymentRetryService.processFailedPayments();
    logger.info('Payment retries processed');

    logger.info('Renewal job completed successfully');
  } catch (error) {
    logger.error('Renewal job failed:', error);
    throw error;
  }
}

/**
 * Entry point for Railway cron jobs
 * This function exits the process after completion
 */
export async function runRenewalJobAndExit(): Promise<void> {
  try {
    await runRenewalJob();
    logger.info('Renewal job completed, exiting...');
    process.exit(0);
  } catch (error) {
    logger.error('Renewal job failed, exiting with error:', error);
    process.exit(1);
  }
}

/**
 * Health check for renewal job
 */
export async function checkRenewalJobHealth(): Promise<{
  healthy: boolean;
  message: string;
}> {
  try {
    // Check if services are accessible
    const paymentsNeedingRetry = await PaymentRetryService.getPaymentsNeedingRetry();
    
    return {
      healthy: true,
      message: `Renewal job is healthy. ${paymentsNeedingRetry.length} payments need retry.`,
    };
  } catch (error) {
    return {
      healthy: false,
      message: `Renewal job health check failed: ${error}`,
    };
  }
}
