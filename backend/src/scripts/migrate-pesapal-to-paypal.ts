/**
 * Migrate Pesapal Users to PayPal (Prep)
 *
 * Prepares for migration: optionally sets cancel_at_period_end on subscriptions
 * for active Pesapal users (no PayPal subscription yet) so they do not renew
 * via Pesapal. Does NOT create PayPal subscriptions (user approval required);
 * users resubscribe or update payment via dashboard.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-pesapal-to-paypal.ts --dry-run
 *   npx tsx src/scripts/migrate-pesapal-to-paypal.ts --input migration-list.json --set-cancel-at-period-end
 *   npx tsx src/scripts/migrate-pesapal-to-paypal.ts --set-cancel-at-period-end
 *
 * Options:
 *   --input <path>               Migration list JSON (from identify-pesapal-users --output). If omitted, runs identify in-memory.
 *   --set-cancel-at-period-end   Set cancel_at_period_end=true for active Pesapal users (no paypal_subscription_id).
 *   --dry-run                    No DB writes; log only.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface MigrationUser {
  user_id: string;
  email: string;
  full_name: string | null;
  category: string;
  subscription_id: string | null;
  subscription_tier: string;
  subscription_status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  paypal_subscription_id: string | null;
  pesapal_payment_count: number;
  pending_payment_count: number;
  last_pesapal_payment_at: string | null;
}

interface MigrationList {
  generated_at: string;
  total_users: number;
  by_category: { active: number; pending: number; cancelled: number };
  users: MigrationUser[];
}

interface Options {
  inputPath: string | null;
  setCancelAtPeriodEnd: boolean;
  dryRun: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    inputPath: null,
    setCancelAtPeriodEnd: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        options.inputPath = args[++i] ?? null;
        break;
      case '--set-cancel-at-period-end':
        options.setCancelAtPeriodEnd = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
    }
  }
  return options;
}

async function loadMigrationList(options: Options): Promise<MigrationList> {
  if (options.inputPath) {
    const p = path.resolve(options.inputPath);
    if (!fs.existsSync(p)) throw new Error(`Migration list not found: ${p}`);
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw) as MigrationList;
  }

  const { identifyPesapalUsers } = await import('./identify-pesapal-users');
  return identifyPesapalUsers();
}

async function main(): Promise<void> {
  const options = parseArgs();
  logger.info('Migrate Pesapal → PayPal (prep)', {
    input: options.inputPath,
    setCancelAtPeriodEnd: options.setCancelAtPeriodEnd,
    dryRun: options.dryRun,
  });

  const list = await loadMigrationList(options);
  const toUpdate = list.users.filter(
    (u) =>
      u.category === 'active' &&
      !u.paypal_subscription_id &&
      u.subscription_id &&
      !u.cancel_at_period_end
  );

  logger.info('Migration list loaded', {
    total_users: list.total_users,
    by_category: list.by_category,
    to_set_cancel_at_period_end: toUpdate.length,
  });

  if (!options.setCancelAtPeriodEnd) {
    logger.info('Nothing to do. Use --set-cancel-at-period-end to mark Pesapal subs as cancel-at-period-end.');
    return;
  }

  if (options.dryRun) {
    logger.info('Dry run: would set cancel_at_period_end=true', {
      user_ids: toUpdate.map((u) => u.user_id),
      subscription_ids: toUpdate.map((u) => u.subscription_id),
    });
    return;
  }

  for (const u of toUpdate) {
    if (!u.subscription_id) continue;
    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', u.subscription_id);

    if (error) {
      logger.error('Failed to update subscription', { subscription_id: u.subscription_id, user_id: u.user_id, error });
    } else {
      logger.info('Set cancel_at_period_end', { user_id: u.user_id, subscription_id: u.subscription_id });
    }
  }
}

main().catch((e) => {
  logger.error('Migrate script failed', { error: e });
  process.exit(1);
});
