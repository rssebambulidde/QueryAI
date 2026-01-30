# Phase 1.5: Email Communication System (Brevo) – Implementation Summary

## Overview

Payment and subscription email notifications implemented via **Brevo** in `backend/src/services/email.service.ts`, with wiring in payment routes, Pesapal webhook, payment-retry service, and renewal job.

---

## 1.5.1 Payment-Related Emails

### Previously Implemented ✅
- **Payment success** – `sendPaymentSuccessEmail`
- **Payment failure** – `sendPaymentFailureEmail`
- **Payment cancellation** – `sendPaymentCancellationEmail`

### Newly Implemented ✅

| Email | Method | Trigger |
|-------|--------|---------|
| **Payment reminder (7 days before renewal)** | `sendRenewalReminderEmail` (enhanced) | Renewal job (`processRenewalReminders`) – runs daily; sends when `current_period_end` is in 6.5–7.5 days. Includes amount, date, and “Update payment method” link. |
| **Payment retry notification** | `sendPaymentRetryNotificationEmail` | `PaymentRetryService.processPaymentRetry` when an automatic retry runs and the charge still fails. Includes retry count and “Update payment method” link. |
| **Payment method updated** | `sendPaymentMethodUpdatedEmail` | **Not yet triggered.** Call when the “update payment method” flow is implemented (e.g. after successful update in dashboard/API). |
| **Invoice (PDF attachment)** | `sendInvoiceEmail` | Right after payment success: payment callback + Pesapal webhook. Uses `InvoiceService.generateInvoice` and sends PDF via Brevo. |
| **Refund confirmation** | `sendRefundConfirmationEmail` | `POST /api/payment/refund` after a refund is processed. Includes amount and estimated refund time (5–7 business days). |

---

## 1.5.2 Subscription-Related Emails

### Previously Implemented ✅
- **Subscription cancellation** – `sendCancellationEmail`
- **Renewal reminder (7 days)** – `sendRenewalReminderEmail` (see 1.5.1)
- **Grace period warning** – `sendGracePeriodWarningEmail`

### Newly Implemented ✅

| Email | Method | Trigger |
|-------|--------|---------|
| **Renewal confirmation** | `sendRenewalConfirmationEmail` | `processRenewals` after successful auto-renewal. New period dates, amount charged. |
| **Failed renewal notification** | `sendFailedRenewalNotificationEmail` | `PaymentRetryService.checkGracePeriod` when grace period is first set (renewal payment failed). Reason, update-payment link, grace period info. |
| **Upgrade confirmation** | `sendUpgradeConfirmationEmail` | Payment callback + webhook when payment completes and tier increases; `PUT /api/subscription/upgrade`. New tier, features, optional prorated amount, new period. |
| **Downgrade confirmation** | `sendDowngradeConfirmationEmail` | `PUT /api/subscription/downgrade`. When downgrade takes effect, features lost. |
| **Expiration warning (3 days)** | `sendExpirationWarningEmail` | Renewal job `processExpirationWarnings`. Cancel-at-period-end subs with `current_period_end` in 2.5–3.5 days. Link to renew. |
| **Welcome (new paid)** | `sendWelcomeEmail` | Payment callback + webhook when first paid subscription (free → starter/premium/pro). Tier, key features, getting started. |
| **Reactivation confirmation** | `sendReactivationConfirmationEmail` | `POST /api/subscription/reactivate`. Confirm reactivation, current period end. |

### Grace Period Warnings

`processGracePeriodWarnings` runs daily in the renewal job. Sends `sendGracePeriodWarningEmail` when `grace_period_end` is set and days remaining are **3** or **1** (to avoid daily spam).

### Cancellation Email

`sendCancellationEmail` is sent from `POST /api/subscription/cancel` (immediate or at-period-end).

---

## 1.5.3 Email Service Enhancements

### Email Template System ✅
- **`backend/src/services/email-templates.service.ts`**
- Reusable templates per email type (`payment_success`, `welcome`, etc.).
- `{{variable}}` substitution and `{{#if var}}...{{/if}}` conditionals.
- `renderTemplate(id, vars)` → `{ subject, html, text }`.
- `htmlToPlainText`, `extractVariables`, `getTemplate`, `listTemplateIds`.

### Email Queue ✅
- **`backend/src/services/email-queue.service.ts`**
- `enqueueEmail({ to, toName, subject, html, text?, userId?, templateId?, metadata? })` → log id.
- `processEmailQueue(limit)` → send via Brevo, retry on failure, update status.
- `getEmailLogs({ userId?, limit?, status? })` for delivery tracking.
- Logs stored in `email_logs` (status: `pending` | `sent` | `failed` | `skipped`).

### Email Preferences ✅
- **Migration:** `backend/src/database/migrations/022_add_email_preferences.sql`
  - `email_preferences`: `user_id`, `opt_out_non_critical`, `opt_out_reminders`, `opt_out_marketing`.
  - `email_logs`: queue, status, retries, `brevo_message_id`, etc.
- **API:** `GET /api/subscription/email-preferences`, `PUT /api/subscription/email-preferences`.
- **DB helpers:** `DatabaseService.getEmailPreferences`, `DatabaseService.updateEmailPreferences`.

### Email Testing ✅
- **`backend/src/__tests__/email.service.test.ts`**
- Template system: `substituteVariables`, `extractVariables`, `renderTemplate`, `htmlToPlainText`, `getTemplate`, `listTemplateIds`.
- Queue: `enqueueEmail`, `processEmailQueue`, `getEmailLogs` (mocked DB).

---

## 1.5.4 Automated Email Scheduling

### Schedulers ✅
- **`payment-reminder.service`** – 7-day payment reminders (calls `processRenewalReminders`). Run daily.
- **`renewal-reminder.service`** – 3, 7, 14-day renewal reminders. Run daily.
- **`expiration-warning.service`** – 3-day expiration warnings for cancel-at-period-end. Run daily.

### Cron / HTTP ✅
- **`backend/src/cron/email-scheduler.ts`**
  - `runEmailScheduler()`: payment reminders → renewal reminders → expiration warnings → `processEmailQueue(100)`.
  - `runEmailSchedulerAndExit()` for run-and-exit cron.
- **`POST /api/jobs/email-scheduler`** – trigger via cron (e.g. Railway Cron, GitHub Actions). Call daily.

### Setup
- **Railway:** Add a cron service or scheduled task that `POST`s to `https://<api>/api/jobs/email-scheduler` daily.
- **GitHub Actions:** Schedule a workflow that hits the endpoint daily.
- **Renewal job** (`/api/jobs/renewals`) remains separate (renewals, retries, grace-period warnings). Use both jobs if you run reminder/scheduler logic via the email scheduler and lifecycle logic via the renewal job.

---

## 1.5.5 Email Integration Points

### Payment routes (`backend/src/routes/payment.routes.ts`)

| Integration | Email | Where |
|-------------|-------|--------|
| After payment completion | Payment success | Callback `GET /api/payment/callback` when `paymentStatus === 'completed'`. Also in Pesapal webhook (`pesapal.service`). |
| On failure | Payment failure | Callback when `paymentStatus === 'failed'`. Also in webhook. |
| On cancellation | Payment cancellation | Callback when `paymentStatus === 'cancelled'`; also `GET /api/payment/cancel` when payment found and status updated. Webhook on `cancelled`. |
| After payment | Invoice (PDF) | Callback + webhook right after success email when `paymentStatus === 'completed'`. |
| Refund processed | Refund confirmation | `POST /api/payment/refund` after refund is created and payment updated. |

**Note:** Payment retry email is sent from **Payment Retry Service** when an automatic retry runs and the charge still fails (not from payment routes).

### Subscription routes (`backend/src/routes/subscription.routes.ts`)

| Integration | Email | Where |
|-------------|-------|--------|
| On upgrade | Upgrade confirmation | `PUT /api/subscription/upgrade` after `updateSubscriptionTier`. |
| On downgrade | Downgrade confirmation | `PUT /api/subscription/downgrade` after `downgradeSubscription`. |
| On cancellation | Cancellation | `POST /api/subscription/cancel` after `cancelSubscription` (immediate or at period end). |
| On reactivation | Reactivation confirmation | `POST /api/subscription/reactivate` after `reactivateSubscription`. |

**Welcome email** is sent when a user’s **first paid subscription** is created via **payment** (free → starter/premium/pro), not from subscription routes. Triggered in payment callback and Pesapal webhook when `oldTier === 'free'` and `newTier !== 'free'`.

### Subscription service (`backend/src/services/subscription.service.ts`)

| Integration | Email | Where |
|-------------|-------|--------|
| On successful renewal | Renewal confirmation | `processRenewals()` after auto-renew: extend period, log history, then send email with new period dates and amount. |
| Before expiration | Expiration warning | `processExpirationWarnings()`: active, `cancel_at_period_end`, tier ≠ free, `current_period_end` in 2.5–3.5 days. |

**Failed renewal notification** is sent from **Payment Retry Service** when the grace period is first set (payment failed, retries exhausted). **Grace period warnings** are sent from `processGracePeriodWarnings()` (3 and 1 days remaining).

### Payment retry service (`backend/src/services/payment-retry.service.ts`)

| Integration | Email | Where |
|-------------|-------|--------|
| On retry attempt (charge still fails) | Retry notification | `processPaymentRetry()` when status remains `failed`: increment `retry_count`, then send email with retry count and “update payment method” link. |
| After all retries exhausted | Failed renewal | `checkGracePeriod()` when `grace_period_end` is first set (previous payment failed, retries exhausted). Sends failed renewal notification with grace period info and update-payment link. |

### Summary

- **Payment routes:** success, failure, cancellation, invoice, refund. Retry email is in retry service.
- **Subscription routes:** upgrade, downgrade, cancellation, reactivation. Welcome is on first paid sub via payment flow.
- **Subscription service:** renewal confirmation, expiration warning (and grace period warnings).
- **Payment retry service:** retry notification on each failed retry, failed renewal when entering grace period (final failure).

---

## 1.5.6 Email Template Examples

Templates aligned with the following examples (see `email.service.ts` and `email-templates.service.ts`).

### Payment Reminder Email

- **Subject:** `Your QueryAI Subscription Renews in X Day(s)`
- **Variables:** `userName`, `tier`, `renewalDate`, `amount`, `currency`, `paymentMethod`, `subscriptionUrl`
- **Body:** Greeting, tier renews on date, Amount, Payment Method, ensure up to date, [Update Payment Method].
- **Call sites:** `processRenewalReminders`, `renewal-reminder.service` (pass `amount`, `currency`, `paymentMethod` from last payment when available).

### Failed Renewal Email

- **Subject:** `Payment Failed - Action Required`
- **Variables:** `userName`, `failureReason`, `amount`, `currency`, `daysRemaining`, `subscriptionUrl`
- **Body:** Unable to process renewal, Reason (if any), Amount, grace period and days remaining, [Update Payment Method].
- **Call site:** `PaymentRetryService.checkGracePeriod` (passes `daysRemaining`, `amount`, `currency`, `failureReason` from payment/webhook when available).

### Subscription Upgrade Email

- **Subject:** `Subscription Upgraded to {{newTier}}`
- **Variables:** `userName`, `newTier`, `features` (bullet list), `amount`, `currency`, `startDate`, `endDate`, `subscriptionUrl`
- **Body:** Upgraded to new tier, New Features (bullets), Amount Charged, New Period, [View Subscription Dashboard].
- **Call sites:** Payment callback, webhook, `PUT /api/subscription/upgrade` (pass `proratedAmount`/`currency` when charged).

---

## Dashboard Links

All “Update payment method” / “subscription” links use a shared base URL:

- `getDashboardUrl()`: `FRONTEND_URL` → `CORS_ORIGIN` → production fallback → `http://localhost:3000`
- `getSubscriptionUrl()`: `{base}/dashboard?tab=subscription`

Existing emails that pointed at `API_BASE_URL` for the dashboard now use `getSubscriptionUrl()`.

---

## Renewal Job Changes

`backend/src/jobs/renewal-job.ts` now:

1. **`processRenewalReminders()`** – 7-day payment reminders (runs first).
2. **`processExpirationWarnings()`** – 3-day expiration warnings for cancel-at-period-end.
3. **`processGracePeriodWarnings()`** – Grace period warnings (3 and 1 days remaining).
4. **`processRenewals()`** – Subscription renewals (sends renewal confirmation emails).
5. **`processFailedPayments()`** – Payment retries.

Run the renewal job daily (e.g. cron). Reminders/warnings use the stated time windows.

---

## Payment Method Updated Email

`sendPaymentMethodUpdatedEmail(userEmail, userName, lastFourDigits)` is implemented but not called anywhere yet. When you add an “update payment method” feature:

1. After a successful update, resolve the user’s email and name.
2. Obtain the last 4 digits of the new payment method (from your provider if available).
3. Call `EmailService.sendPaymentMethodUpdatedEmail(email, name, lastFour)`.

---

## Brevo Configuration

Ensure these env vars are set (see `BREVO_API_SETUP.md`):

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL` (verified in Brevo)
- `BREVO_SENDER_NAME` (optional)

For correct links in emails, also set:

- `FRONTEND_URL` or `CORS_ORIGIN` to your frontend base URL.

---

## Files Touched

- `backend/src/services/email.service.ts` – Payment + subscription email methods, tier features, link helpers.
- `backend/src/services/email-templates.service.ts` – **New.** Template system, variables, HTML/text.
- `backend/src/services/email-queue.service.ts` – **New.** Queue, retry, logs, delivery status.
- `backend/src/services/payment-reminder.service.ts` – **New.** 7-day payment reminder scheduler.
- `backend/src/services/renewal-reminder.service.ts` – **New.** 3, 7, 14-day renewal reminder scheduler.
- `backend/src/services/expiration-warning.service.ts` – **New.** 3-day expiration warning scheduler.
- `backend/src/services/subscription.service.ts` – `processRenewalReminders`, `processExpirationWarnings`, `processGracePeriodWarnings`, renewal confirmation in `processRenewals`.
- `backend/src/services/payment-retry.service.ts` – Retry + failed-renewal emails.
- `backend/src/services/database.service.ts` – `getEmailPreferences`, `updateEmailPreferences`.
- `backend/src/services/pesapal.service.ts` – Invoice, welcome, upgrade on webhook success.
- `backend/src/routes/payment.routes.ts` – Invoice, welcome, upgrade, refund emails.
- `backend/src/routes/subscription.routes.ts` – Upgrade, downgrade, cancellation, reactivation, **email-preferences** (GET/PUT).
- `backend/src/jobs/renewal-job.ts` – Renewal + retry + reminder/warning steps.
- `backend/src/cron/email-scheduler.ts` – **New.** Runs payment/renewal/expiration schedulers + queue.
- `backend/src/server.ts` – `POST /api/jobs/email-scheduler` endpoint.
- `backend/src/database/migrations/022_add_email_preferences.sql` – **New.** `email_preferences`, `email_logs`.
- `backend/src/types/database.ts` – `EmailPreferences`, `EmailLog`.
- `backend/src/__tests__/email.service.test.ts` – **New.** Template + queue tests.
