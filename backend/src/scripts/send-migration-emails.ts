/**
 * Send Migration Emails to Pesapal Users
 *
 * Sends the Pesapal → PayPal migration announcement (see PAYPAL_ONLY_MIGRATION_PLAN.md
 * and EmailService.sendMigrationAnnouncementEmail) to users in the migration list.
 *
 * Usage:
 *   npx tsx src/scripts/send-migration-emails.ts --dry-run
 *   npx tsx src/scripts/send-migration-emails.ts --input migration-list.json
 *   npx tsx src/scripts/send-migration-emails.ts --input migration-list.json --user-id <uuid> --limit 10
 *
 * Options:
 *   --input <path>   Migration list JSON (from identify-pesapal-users --output). If omitted, runs identify in-memory.
 *   --user-id <id>   Send only to this user.
 *   --limit <n>      Cap number of emails (default: all).
 *   --dry-run        Log only; do not send.
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { EmailService } from '../services/email.service';
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
  userId: string | null;
  limit: number;
  dryRun: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    inputPath: null,
    userId: null,
    limit: 0,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        options.inputPath = args[++i] ?? null;
        break;
      case '--user-id':
        options.userId = args[++i] ?? null;
        break;
      case '--limit':
        options.limit = parseInt(args[++i] ?? '0', 10) || 0;
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
  logger.info('Send migration emails', {
    input: options.inputPath,
    userId: options.userId,
    limit: options.limit,
    dryRun: options.dryRun,
  });

  const list = await loadMigrationList(options);
  let users = list.users;

  if (options.userId) {
    users = users.filter((u) => u.user_id === options.userId);
    if (!users.length) {
      logger.warn('No user found for --user-id', { userId: options.userId });
      return;
    }
  }

  if (options.limit > 0) users = users.slice(0, options.limit);

  logger.info('Sending migration emails', { count: users.length, dryRun: options.dryRun });

  let sent = 0;
  let failed = 0;

  for (const u of users) {
    const userName = u.full_name || u.email || 'User';
    const hasActive =
      (u.category === 'active' && u.subscription_tier !== 'free') || !!u.paypal_subscription_id;
    const renewalDate = u.current_period_end
      ? new Date(u.current_period_end).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : undefined;

    if (options.dryRun) {
      logger.info('Dry run: would send migration email', {
        user_id: u.user_id,
        email: u.email,
        hasActiveSubscription: hasActive,
        renewalDate,
      });
      sent++;
      continue;
    }

    const ok = await EmailService.sendMigrationAnnouncementEmail(u.email, userName, {
      hasActiveSubscription: hasActive,
      renewalDate,
    });
    if (ok) sent++;
    else failed++;
  }

  logger.info('Migration emails complete', { sent, failed, total: users.length });
}

main().catch((e) => {
  logger.error('Send migration emails failed', { error: e });
  process.exit(1);
});
