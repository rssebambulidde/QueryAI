/**
 * Subscription Lifecycle Service  (9.6.5)
 *
 * Three scheduled processors that run via the daily email-scheduler cron:
 *
 * 1. **Trial-ending reminders** — 3 days before `trial_end`.
 * 2. **Annual-discount upsell** — monthly subscribers 7 days before renewal.
 * 3. **Win-back emails** — users who cancelled 14-30 days ago.
 *
 * Each processor queries Supabase, fetches user profiles, and delegates to
 * the corresponding `EmailService.send*` method.  Failures are logged and
 * skipped (no throw) so one bad row doesn't block the rest.
 */

import logger from '../config/logger';
import { Database } from '../types/database';

// ── 1. Trial-ending reminders ───────────────────────────────────────────────

/**
 * Send trial-ending emails to users whose trial ends within ~3 days.
 * Window: 2.5–3.5 days from now (±12 h to avoid double-sends).
 */
export async function processTrialEndingReminders(): Promise<void> {
  try {
    const { supabaseAdmin } = await import('../config/database');
    const { EmailService } = await import('./email.service');
    const { DatabaseService } = await import('./database.service');

    const now = new Date();
    const minEnd = new Date(now.getTime() + 2.5 * 24 * 60 * 60 * 1000);
    const maxEnd = new Date(now.getTime() + 3.5 * 24 * 60 * 60 * 1000);

    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .neq('tier', 'free')
      .not('trial_end', 'is', null)
      .gte('trial_end', minEnd.toISOString())
      .lte('trial_end', maxEnd.toISOString());

    if (error) {
      logger.error('processTrialEndingReminders: fetch failed', { error });
      return;
    }
    if (!subscriptions?.length) {
      logger.info('processTrialEndingReminders: no trials ending soon');
      return;
    }

    for (const sub of subscriptions as Database.Subscription[]) {
      try {
        const user = await DatabaseService.getUserProfile(sub.user_id);
        if (!user) continue;

        await EmailService.sendTrialEndingEmail(
          user.email,
          user.full_name || user.email,
          sub,
          3,
        );
        logger.info('Trial ending reminder sent', { userId: sub.user_id, tier: sub.tier });
      } catch (e) {
        logger.error('processTrialEndingReminders: email failed', {
          subscriptionId: sub.id,
          error: e,
        });
      }
    }
  } catch (err) {
    logger.error('processTrialEndingReminders failed', { error: err });
  }
}

// ── 2. Annual-discount upsell ───────────────────────────────────────────────

/**
 * For monthly subscribers whose renewal is ~7 days away, send a "switch to
 * annual and save" email.  Only targets active, non-cancelled monthly subs.
 */
export async function processAnnualUpsell(): Promise<void> {
  try {
    const { supabaseAdmin } = await import('../config/database');
    const { EmailService } = await import('./email.service');
    const { DatabaseService } = await import('./database.service');
    const { PricingConfigService } = await import('./pricing-config.service');

    const now = new Date();
    const minEnd = new Date(now.getTime() + 6.5 * 24 * 60 * 60 * 1000);
    const maxEnd = new Date(now.getTime() + 7.5 * 24 * 60 * 60 * 1000);

    // Fetch monthly subscribers renewing in ~7 days
    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .eq('cancel_at_period_end', false)
      .in('tier', ['pro', 'enterprise'])
      .gte('current_period_end', minEnd.toISOString())
      .lte('current_period_end', maxEnd.toISOString());

    if (error) {
      logger.error('processAnnualUpsell: fetch failed', { error });
      return;
    }
    if (!subscriptions?.length) {
      logger.info('processAnnualUpsell: no eligible monthly subscribers');
      return;
    }

    // Only keep monthly subscribers (skip annual ones)
    const monthlyOnly = (subscriptions as Database.Subscription[]).filter(
      (s) => (s.billing_period ?? 'monthly') === 'monthly',
    );
    if (!monthlyOnly.length) return;

    // Get pricing config for upsell amounts
    const pricing = await PricingConfigService.getAll();

    for (const sub of monthlyOnly) {
      try {
        const user = await DatabaseService.getUserProfile(sub.user_id);
        if (!user) continue;

        const tierPricing = pricing.tiers[sub.tier as 'pro' | 'enterprise'];
        // Only upsell if annual price is configured and provides savings
        if (!tierPricing || tierPricing.annual <= 0) continue;
        if (tierPricing.annual >= tierPricing.monthly * 12) continue; // no real savings

        await EmailService.sendAnnualUpsellEmail(
          user.email,
          user.full_name || user.email,
          sub,
          {
            monthlyPrice: tierPricing.monthly,
            annualPrice: tierPricing.annual,
            currency: 'USD',
          },
        );
        logger.info('Annual upsell email sent', { userId: sub.user_id, tier: sub.tier });
      } catch (e) {
        logger.error('processAnnualUpsell: email failed', {
          subscriptionId: sub.id,
          error: e,
        });
      }
    }
  } catch (err) {
    logger.error('processAnnualUpsell failed', { error: err });
  }
}

// ── 3. Win-back emails ──────────────────────────────────────────────────────

/**
 * Sends a win-back email to users who cancelled their paid subscription
 * 14–30 days ago.  Looks at `subscription_history` for cancellation events.
 * Uses a de-dup guard: skips users who already received a win-back email
 * (tracked via `email_logs` with subject containing "Come Back").
 */
export async function processWinBackEmails(): Promise<void> {
  try {
    const { supabaseAdmin } = await import('../config/database');
    const { EmailService } = await import('./email.service');
    const { DatabaseService } = await import('./database.service');

    const now = new Date();
    const minDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Find cancellation events from 14–30 days ago
    const { data: history, error } = await supabaseAdmin
      .from('subscription_history')
      .select('user_id, previous_state')
      .eq('change_type', 'cancellation')
      .gte('created_at', minDate.toISOString())
      .lte('created_at', maxDate.toISOString());

    if (error) {
      logger.error('processWinBackEmails: fetch history failed', { error });
      return;
    }
    if (!history?.length) {
      logger.info('processWinBackEmails: no recent cancellations');
      return;
    }

    // Deduplicate by user_id — only process each user once
    const seenUsers = new Set<string>();
    const candidates: { userId: string; previousTier: string }[] = [];

    for (const row of history) {
      if (seenUsers.has(row.user_id)) continue;
      seenUsers.add(row.user_id);

      // Extract previous tier from previous_state JSONB
      const prev = row.previous_state as Record<string, unknown> | null;
      const tier = (prev?.tier as string) ?? 'pro';
      if (tier === 'free') continue; // skip free→free

      candidates.push({ userId: row.user_id, previousTier: tier });
    }

    if (!candidates.length) return;

    // Check that these users are currently on free (actually churned, not re-subscribed)
    for (const candidate of candidates) {
      try {
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('tier')
          .eq('user_id', candidate.userId)
          .single();

        // Skip if user re-subscribed to a paid tier
        if (sub && sub.tier !== 'free') continue;

        // Check if we already sent a win-back email to this user (de-dup)
        const { count } = await supabaseAdmin
          .from('email_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', candidate.userId)
          .ilike('subject', '%Come Back%')
          .gte('created_at', minDate.toISOString());

        if (count && count > 0) continue; // already sent

        const user = await DatabaseService.getUserProfile(candidate.userId);
        if (!user) continue;

        const sent = await EmailService.sendWinBackEmail(
          user.email,
          user.full_name || user.email,
          candidate.previousTier,
        );

        if (sent) {
          // Log to email_logs for de-dup tracking
          await supabaseAdmin.from('email_logs').insert({
            user_id: candidate.userId,
            subject: 'We Miss You — Come Back to QueryAI!',
            status: 'sent',
            created_at: new Date().toISOString(),
          }).then(({ error: logErr }) => {
            if (logErr) logger.warn('Win-back email_logs insert failed', { error: logErr });
          });

          logger.info('Win-back email sent', {
            userId: candidate.userId,
            previousTier: candidate.previousTier,
          });
        }
      } catch (e) {
        logger.error('processWinBackEmails: email failed', {
          userId: candidate.userId,
          error: e,
        });
      }
    }
  } catch (err) {
    logger.error('processWinBackEmails failed', { error: err });
  }
}

// ── Aggregate scheduler ─────────────────────────────────────────────────────

/**
 * Run all subscription lifecycle processors.
 * Called from `cron/email-scheduler.ts` during the daily cron job.
 */
export async function runSubscriptionLifecycleScheduler(): Promise<void> {
  logger.info('Subscription lifecycle scheduler: starting');
  await processTrialEndingReminders();
  await processAnnualUpsell();
  await processWinBackEmails();
  logger.info('Subscription lifecycle scheduler: done');
}
