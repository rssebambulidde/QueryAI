/**
 * Identify Existing Pesapal Users
 *
 * Queries the database for users with Pesapal payments (pesapal_order_tracking_id or
 * pesapal_merchant_reference), categorizes them by subscription status, and outputs
 * a migration list.
 *
 * Usage:
 *   npx tsx src/scripts/identify-pesapal-users.ts
 *   npx tsx src/scripts/identify-pesapal-users.ts --output migration-list.json
 *   npx tsx src/scripts/identify-pesapal-users.ts --dry-run
 *
 * Options:
 *   --output <path>  Write migration list JSON to file (default: stdout)
 *   --dry-run        Log only; do not write file
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '../config/database';
import logger from '../config/logger';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type Category = 'active' | 'pending' | 'cancelled';

interface MigrationUser {
  user_id: string;
  email: string;
  full_name: string | null;
  category: Category;
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
  outputPath: string | null;
  dryRun: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = { outputPath: null, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--output':
        options.outputPath = args[++i] ?? null;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
    }
  }
  return options;
}

export async function identifyPesapalUsers(): Promise<MigrationList> {
  // Payments with Pesapal references (columns exist pre–cleanup migration)
  const { data: pesapalPayments, error: payError } = await supabaseAdmin
    .from('payments')
    .select('id, user_id, status, created_at')
    .or('pesapal_order_tracking_id.not.is.null,pesapal_merchant_reference.not.is.null')
    .order('created_at', { ascending: false });

  if (payError) {
    logger.error('Failed to fetch Pesapal payments', { error: payError });
    throw payError;
  }

  if (!pesapalPayments?.length) {
    logger.info('No Pesapal payments found');
    return {
      generated_at: new Date().toISOString(),
      total_users: 0,
      by_category: { active: 0, pending: 0, cancelled: 0 },
      users: [],
    };
  }

  const userIds = [...new Set((pesapalPayments as { user_id: string }[]).map((p) => p.user_id))];
  logger.info('Pesapal users to process', { count: userIds.length });

  const users: MigrationUser[] = [];
  const byCategory = { active: 0, pending: 0, cancelled: 0 };

  for (const uid of userIds) {
    const userPayments = (pesapalPayments as { user_id: string; status: string; created_at: string }[]).filter(
      (p) => p.user_id === uid
    );
    const pendingCount = userPayments.filter((p) => p.status === 'pending').length;
    const lastAt = userPayments[0]?.created_at ?? null;

    const { data: profile, error: profError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, full_name')
      .eq('id', uid)
      .single();

    if (profError || !profile) {
      logger.warn('User profile not found, skipping', { user_id: uid });
      continue;
    }

    const { data: sub, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, tier, status, cancel_at_period_end, current_period_end, paypal_subscription_id')
      .eq('user_id', uid)
      .single();

    const tier = (sub as { tier?: string } | null)?.tier ?? 'free';
    const status = (sub as { status?: string } | null)?.status ?? 'active';
    const cancelAtPeriodEnd = !!(sub as { cancel_at_period_end?: boolean } | null)?.cancel_at_period_end;
    const periodEnd = (sub as { current_period_end?: string } | null)?.current_period_end ?? null;
    const paypalSubId = (sub as { paypal_subscription_id?: string } | null)?.paypal_subscription_id ?? null;

    let category: Category = 'cancelled';
    if (paypalSubId) {
      category = 'active'; // already on PayPal
    } else if (status === 'active' && tier !== 'free' && !cancelAtPeriodEnd) {
      category = 'active';
    } else if (pendingCount > 0) {
      category = 'pending';
    } else {
      category = 'cancelled';
    }

    byCategory[category]++;

    users.push({
      user_id: uid,
      email: (profile as { email?: string }).email ?? '',
      full_name: (profile as { full_name?: string | null }).full_name ?? null,
      category,
      subscription_id: (sub as { id?: string } | null)?.id ?? null,
      subscription_tier: tier,
      subscription_status: status,
      cancel_at_period_end: cancelAtPeriodEnd,
      current_period_end: periodEnd,
      paypal_subscription_id: paypalSubId,
      pesapal_payment_count: userPayments.length,
      pending_payment_count: pendingCount,
      last_pesapal_payment_at: lastAt,
    });
  }

  const list: MigrationList = {
    generated_at: new Date().toISOString(),
    total_users: users.length,
    by_category: byCategory,
    users,
  };

  return list;
}

async function main(): Promise<void> {
  const options = parseArgs();
  logger.info('Identify Pesapal users', { output: options.outputPath, dryRun: options.dryRun });

  const list = await identifyPesapalUsers();
  const json = JSON.stringify(list, null, 2);

  if (options.dryRun) {
    logger.info('Dry run: migration list (preview)', {
      total_users: list.total_users,
      by_category: list.by_category,
      sample_user_ids: list.users.slice(0, 5).map((u) => u.user_id),
    });
    console.log(json);
    return;
  }

  if (options.outputPath) {
    const outPath = path.resolve(options.outputPath);
    const dir = path.dirname(outPath);
    if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, json, 'utf-8');
    logger.info('Wrote migration list', { path: options.outputPath, total_users: list.total_users });
  } else {
    console.log(json);
  }
}

const isDirectRun = (process.argv[1] ?? '').includes('identify-pesapal-users');
if (isDirectRun) {
  main().catch((e) => {
    logger.error('Identify script failed', { error: e });
    process.exit(1);
  });
}
