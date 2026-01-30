# Pesapal → PayPal Migration Scripts (6.2)

Scripts to identify Pesapal users, prepare subscriptions for migration, and send migration emails. See **PAYPAL_ONLY_MIGRATION_PLAN.md** for the overall plan.

**Run all commands from `backend/`** (e.g. `cd backend`).

---

## 1. Identify Existing Pesapal Users

**Script:** `backend/src/scripts/identify-pesapal-users.ts`

Queries the database for users with Pesapal payments (`pesapal_order_tracking_id` or `pesapal_merchant_reference`), categorizes them (active / pending / cancelled), and outputs a migration list.

```bash
npm run identify-pesapal-users
npm run identify-pesapal-users -- --output migration-list.json
npm run identify-pesapal-users -- --dry-run
```

**Options:**

| Option | Description |
|--------|-------------|
| `--output <path>` | Write migration list JSON to file (default: stdout) |
| `--dry-run` | Log only; do not write file |

**Output:** JSON with `total_users`, `by_category` (active, pending, cancelled), and `users[]` (user_id, email, category, subscription details, etc.).

---

## 2. Migrate Pesapal → PayPal (Prep)

**Script:** `backend/src/scripts/migrate-pesapal-to-paypal.ts`

Prepares for migration by optionally setting `cancel_at_period_end = true` on subscriptions for **active** Pesapal users who do **not** yet have a PayPal subscription. This avoids renewing via Pesapal. The script does **not** create PayPal subscriptions (user approval is required); users resubscribe or update payment via the dashboard.

```bash
npm run migrate-pesapal-to-paypal -- --dry-run
npm run migrate-pesapal-to-paypal -- --input migration-list.json --set-cancel-at-period-end
npm run migrate-pesapal-to-paypal -- --set-cancel-at-period-end
```

**Options:**

| Option | Description |
|--------|-------------|
| `--input <path>` | Migration list JSON (from `identify-pesapal-users --output`). If omitted, runs identify in-memory. |
| `--set-cancel-at-period-end` | Set `cancel_at_period_end=true` for active Pesapal users (no `paypal_subscription_id`). |
| `--dry-run` | No DB writes; log only. |

---

## 3. Send Migration Emails

**Script:** `backend/src/scripts/send-migration-emails.ts`

Sends the Pesapal → PayPal migration announcement (see **PAYPAL_ONLY_MIGRATION_PLAN.md** and `EmailService.sendMigrationAnnouncementEmail`) to users in the migration list. Uses Brevo when `BREVO_API_KEY` is set.

```bash
npm run send-migration-emails -- --dry-run
npm run send-migration-emails -- --input migration-list.json
npm run send-migration-emails -- --input migration-list.json --user-id <uuid> --limit 10
```

**Options:**

| Option | Description |
|--------|-------------|
| `--input <path>` | Migration list JSON. If omitted, runs identify in-memory. |
| `--user-id <uuid>` | Send only to this user. |
| `--limit <n>` | Cap number of emails. |
| `--dry-run` | Log only; do not send. |

---

## Execution Order

1. **Identify:** `npm run identify-pesapal-users -- --output migration-list.json`
2. **Review** `migration-list.json` and confirm counts.
3. **Prep (optional):** `npm run migrate-pesapal-to-paypal -- --input migration-list.json --set-cancel-at-period-end --dry-run` then without `--dry-run` when ready.
4. **Notify:** `npm run send-migration-emails -- --input migration-list.json --dry-run` then without `--dry-run` when ready.
5. Users update payment / resubscribe via dashboard (PayPal).
6. After migration, run **Verify** (below) and optionally **Rollback** if you need to revert prep.

---

## Rollback Plan

If you ran `--set-cancel-at-period-end` and need to revert:

1. **Identify affected users** from your migration list (those with `category === 'active'`, no `paypal_subscription_id`, and whose subscriptions were updated).
2. **Manual DB update** (use your migration list or query):

   ```sql
   UPDATE subscriptions
   SET cancel_at_period_end = false,
       updated_at = NOW()
   WHERE user_id IN (
     -- user IDs you updated
   )
     AND cancel_at_period_end = true;
   ```

3. Run `identify-pesapal-users` again and confirm counts.

**Note:** Rollback only restores `cancel_at_period_end`. It does not undo migration emails or any PayPal changes users made.

---

## Verify Migration

- **Identify:** Re-run `identify-pesapal-users` and check `by_category`. Users who have completed PayPal flow will have `paypal_subscription_id`; they remain "active" but are migrated.
- **DB check:** `SELECT user_id, tier, paypal_subscription_id, cancel_at_period_end FROM subscriptions WHERE user_id IN (...);` for users from your list.
- **Optional script:** Add a `--verify` mode to `migrate-pesapal-to-paypal` that reports who still has no `paypal_subscription_id` (active Pesapal users not yet migrated).

---

## Testing

1. **Sandbox DB:** Use a copy of production or a sandbox DB with test Pesapal rows.
2. **Identify:** Run `identify-pesapal-users --output migration-list.json` and inspect output.
3. **Migrate prep:** Run `migrate-pesapal-to-paypal --input migration-list.json --set-cancel-at-period-end --dry-run`, then without `--dry-run` and verify `subscriptions.cancel_at_period_end` for affected users.
4. **Emails:** Run `send-migration-emails --input migration-list.json --dry-run`, then `--limit 1` or `--user-id <test-user>` and confirm delivery.
5. **Rollback:** Revert `cancel_at_period_end` for a test user and confirm.

---

## Acceptance Criteria (6.2)

- [x] All Pesapal users identified (`identify-pesapal-users`)
- [x] Migration script ready and tested (`migrate-pesapal-to-paypal`, `send-migration-emails`)
- [x] User communication sent (`send-migration-emails` + `EmailService.sendMigrationAnnouncementEmail`)
- [ ] All users migrated successfully (execute scripts, then verify)
- [ ] No service interruption (prep + communicate before cutoff)
- [x] Rollback plan in place (see **Rollback Plan** above)
