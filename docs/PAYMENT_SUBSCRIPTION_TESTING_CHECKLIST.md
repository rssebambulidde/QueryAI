# Payment & Subscription System Testing Checklist

This document provides a comprehensive testing checklist for verifying all payment and subscription fixes implemented in the gap analysis remediation.

**Last Updated:** January 31, 2026  
**Status:** Ready for Testing

---

## Prerequisites

Before testing, ensure:
- [ ] PayPal sandbox/test environment is configured
- [ ] PayPal webhook URL is configured in PayPal dashboard
- [ ] Database migrations are up to date (especially `029_verify_tier_constraints.sql`)
- [ ] Backend server is running and connected to database
- [ ] Frontend is running and connected to backend
- [ ] Test PayPal accounts (buyer and seller) are available

---

## Test Scenarios

### 1. One-Time Payment: Full Flow ✅

**Objective:** Verify one-time payment completes successfully and updates user tier correctly.

**Steps:**
1. [ ] Log in as a test user (any tier)
2. [ ] Navigate to Subscription settings
3. [ ] Select a tier (e.g., Premium)
4. [ ] Choose "One-time payment" option
5. [ ] Select billing period (Monthly or Annual)
6. [ ] Click "Pay with PayPal"
7. [ ] Complete payment in PayPal (use test card or PayPal account)
8. [ ] Return to application after payment

**Expected Results:**
- [ ] Payment completes successfully
- [ ] User is redirected to dashboard with success message
- [ ] User's tier is updated to the selected tier
- [ ] Billing history shows payment as "completed" (not "pending")
- [ ] Subscription period dates are correct:
  - Monthly: `current_period_end` = `current_period_start` + 30 days
  - Annual: `current_period_end` = `current_period_start` + 365 days
- [ ] `billing_period` is stored correctly in payment `callback_data`
- [ ] User receives payment success email
- [ ] User receives invoice email
- [ ] If upgrading from free, user receives welcome email
- [ ] If upgrading tier, user receives upgrade confirmation email

**Database Verification:**
```sql
-- Check payment record
SELECT id, tier, status, amount, currency, billing_period, completed_at 
FROM payments 
WHERE user_id = '<test_user_id>' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check subscription
SELECT tier, status, current_period_start, current_period_end, billing_period 
FROM subscriptions 
WHERE user_id = '<test_user_id>';
```

---

### 2. Recurring Payment: Full Flow ✅

**Objective:** Verify recurring subscription completes successfully and activates correctly.

**Steps:**
1. [ ] Log in as a test user
2. [ ] Navigate to Subscription settings
3. [ ] Select a tier (e.g., Pro)
4. [ ] Choose "Recurring subscription" option
5. [ ] Select billing period (Monthly or Annual)
6. [ ] Click "Subscribe with PayPal"
7. [ ] Approve subscription in PayPal
8. [ ] Return to application after approval

**Expected Results:**
- [ ] Subscription approval completes successfully
- [ ] User is redirected to dashboard with success message
- [ ] User's tier is updated to the selected tier
- [ ] Billing history shows payment as "completed" (not "pending")
- [ ] Subscription status is "active"
- [ ] `paypal_subscription_id` is stored in subscription
- [ ] `auto_renew` is set to `true`
- [ ] Subscription period dates are correct
- [ ] User receives payment success email
- [ ] User receives invoice email
- [ ] If upgrading from free, user receives welcome email
- [ ] If upgrading tier, user receives upgrade confirmation email

**Database Verification:**
```sql
-- Check payment record
SELECT id, tier, status, paypal_subscription_id, completed_at 
FROM payments 
WHERE user_id = '<test_user_id>' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check subscription
SELECT tier, status, paypal_subscription_id, auto_renew, current_period_start, current_period_end 
FROM subscriptions 
WHERE user_id = '<test_user_id>';
```

---

### 3. Recurring with Auto Return OFF: Sync-Subscription Resolves Pending ✅

**Objective:** Verify that when PayPal Auto Return is OFF, the sync-subscription endpoint resolves pending payments.

**Prerequisites:**
- [ ] PayPal dashboard: "Auto return for website payments" is OFF
- [ ] A recurring subscription payment was initiated but callback didn't run

**Steps:**
1. [ ] Initiate a recurring subscription payment
2. [ ] Complete approval in PayPal
3. [ ] Note that callback may not run (due to Auto Return OFF)
4. [ ] Check billing history - payment should show as "pending"
5. [ ] Navigate to Subscription settings
6. [ ] Click "Sync billing status" button
7. [ ] OR: Visit `/dashboard?payment=success` (triggers auto-sync)

**Expected Results:**
- [ ] Sync operation completes successfully
- [ ] Payment status changes from "pending" to "completed"
- [ ] User's tier is updated correctly
- [ ] Subscription is activated
- [ ] Success message is displayed
- [ ] Billing history shows payment as "completed"

**API Verification:**
```bash
# Manual sync call
POST /api/payment/sync-subscription
Authorization: Bearer <user_token>

# Expected response
{
  "success": true,
  "data": {
    "synced": true,
    "message": "Subscription synced"
  }
}
```

---

### 4. Recurring with APPROVED Status: Sync-Subscription Succeeds ✅

**Objective:** Verify that sync-subscription handles APPROVED status correctly (Gap 1 fix).

**Steps:**
1. [ ] Create a payment record with `paypal_subscription_id` pointing to a subscription in APPROVED status
2. [ ] Call sync-subscription endpoint
3. [ ] Verify subscription is activated

**Expected Results:**
- [ ] Sync-subscription accepts subscriptions with status: `ACTIVE`, `APPROVAL_PENDING`, or `APPROVED`
- [ ] Payment is marked as completed
- [ ] Subscription is activated
- [ ] Tier is updated correctly

**Database Setup:**
```sql
-- Create test payment with APPROVED subscription
-- (This would typically come from PayPal, but for testing we can simulate)
```

---

### 5. Webhook PAYMENT.CAPTURE.COMPLETED: Payment Found and Completed ✅

**Objective:** Verify webhook handler correctly processes one-time payment completions.

**Steps:**
1. [ ] Initiate a one-time payment
2. [ ] Complete payment in PayPal
3. [ ] Simulate or wait for PayPal to send `PAYMENT.CAPTURE.COMPLETED` webhook
4. [ ] Verify webhook is processed

**Expected Results:**
- [ ] Webhook is received and verified (signature check passes)
- [ ] Payment is found by `paypal_order_id` or `paypal_payment_id`
- [ ] Payment status is updated to "completed"
- [ ] `billing_period` is preserved in `callback_data`
- [ ] Subscription tier is updated (if not already updated by callback)
- [ ] Webhook returns 200 OK

**Webhook Payload Example:**
```json
{
  "event_type": "PAYMENT.CAPTURE.COMPLETED",
  "resource": {
    "id": "CAPTURE_ID",
    "status": "COMPLETED",
    "amount": {
      "value": "29.99",
      "currency_code": "USD"
    }
  }
}
```

**Database Verification:**
```sql
-- Check payment was updated
SELECT status, paypal_payment_id, completed_at, callback_data 
FROM payments 
WHERE paypal_order_id = '<order_id>';
```

---

### 6. Webhook BILLING.SUBSCRIPTION.ACTIVATED: Subscription Activated ✅

**Objective:** Verify webhook handler activates subscriptions correctly.

**Steps:**
1. [ ] Create a pending payment with `paypal_subscription_id`
2. [ ] Simulate or wait for PayPal to send `BILLING.SUBSCRIPTION.ACTIVATED` webhook
3. [ ] Verify webhook is processed

**Expected Results:**
- [ ] Webhook is received and verified
- [ ] Payment is found by `paypal_subscription_id`
- [ ] Payment status is updated to "completed"
- [ ] Subscription is activated with correct tier
- [ ] Subscription period dates are set correctly
- [ ] `paypal_subscription_id` is stored in subscription
- [ ] `auto_renew` is set to `true`
- [ ] Subscription tier is updated

**Webhook Payload Example:**
```json
{
  "event_type": "BILLING.SUBSCRIPTION.ACTIVATED",
  "resource": {
    "id": "I-XXXXXXXXXXXXX",
    "status": "ACTIVE"
  }
}
```

---

### 7. Webhook PAYMENT.SALE.COMPLETED: Subscription Renewal ✅

**Objective:** Verify webhook handler processes subscription renewals correctly (Gap 4 fix).

**Steps:**
1. [ ] Have an active recurring subscription
2. [ ] Wait for renewal period or simulate renewal
3. [ ] Simulate or wait for PayPal to send `PAYMENT.SALE.COMPLETED` webhook
4. [ ] Verify webhook is processed

**Expected Results:**
- [ ] Webhook is received and verified
- [ ] Subscription is found by `billing_agreement_id`, `subscription_id`, or `id` (if I-xxx format)
- [ ] `handlePayPalSubscriptionRenewal` is called
- [ ] New payment record is created for renewal
- [ ] Subscription period is extended
- [ ] Renewal is logged in subscription history

**Webhook Payload Example:**
```json
{
  "event_type": "PAYMENT.SALE.COMPLETED",
  "resource": {
    "billing_agreement_id": "I-XXXXXXXXXXXXX",
    "id": "SALE_ID",
    "amount": {
      "value": "29.99",
      "currency_code": "USD"
    }
  }
}
```

---

### 8. Webhook BILLING.SUBSCRIPTION.PAYMENT.FAILED: Failed Payment Handling ✅

**Objective:** Verify webhook handler processes failed subscription payments (Gap 5 fix).

**Steps:**
1. [ ] Have an active recurring subscription
2. [ ] Simulate payment failure (e.g., insufficient funds, expired card)
3. [ ] Simulate or wait for PayPal to send `BILLING.SUBSCRIPTION.PAYMENT.FAILED` webhook
4. [ ] Verify webhook is processed

**Expected Results:**
- [ ] Webhook is received and verified
- [ ] Subscription is found by `resource.id`
- [ ] Grace period is set (7 days) if not already set
- [ ] Failed payment record is created or updated
- [ ] Payment status is "failed"
- [ ] Failure reason is stored
- [ ] User receives failed renewal notification email
- [ ] Subscription remains active during grace period

**Webhook Payload Example:**
```json
{
  "event_type": "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "resource": {
    "id": "I-XXXXXXXXXXXXX",
    "billing_info": {
      "outstanding_balance": {
        "value": "29.99",
        "currency_code": "USD"
      },
      "failed_payment_reason": "INSUFFICIENT_FUNDS"
    }
  }
}
```

**Database Verification:**
```sql
-- Check grace period was set
SELECT grace_period_end 
FROM subscriptions 
WHERE paypal_subscription_id = '<subscription_id>';

-- Check failed payment record
SELECT status, amount, currency 
FROM payments 
WHERE paypal_subscription_id = '<subscription_id>' 
  AND status = 'failed' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

### 9. Webhook BILLING.SUBSCRIPTION.EXPIRED: Expired Subscription Handling ✅

**Objective:** Verify webhook handler processes expired subscriptions (Gap 13 fix).

**Steps:**
1. [ ] Have an active subscription that expires
2. [ ] Simulate or wait for PayPal to send `BILLING.SUBSCRIPTION.EXPIRED` webhook
3. [ ] Verify webhook is processed

**Expected Results:**
- [ ] Webhook is received and verified
- [ ] Subscription is found by `resource.id`
- [ ] Subscription status is changed to "expired"
- [ ] Tier is downgraded to "free"
- [ ] `paypal_subscription_id` is cleared
- [ ] `auto_renew` is set to `false`
- [ ] `current_period_end` is updated to now
- [ ] Subscription history is logged

**Webhook Payload Example:**
```json
{
  "event_type": "BILLING.SUBSCRIPTION.EXPIRED",
  "resource": {
    "id": "I-XXXXXXXXXXXXX",
    "status": "EXPIRED"
  }
}
```

**Database Verification:**
```sql
-- Check subscription was expired and downgraded
SELECT tier, status, paypal_subscription_id, auto_renew 
FROM subscriptions 
WHERE paypal_subscription_id = '<subscription_id>';
```

---

### 10. Duplicate Callback: No Double Emails, Idempotent ✅

**Objective:** Verify idempotency - callback doesn't send duplicate emails or update database twice (Gap 9 fix).

**Steps:**
1. [ ] Complete a payment (one-time or recurring)
2. [ ] Payment is marked as "completed"
3. [ ] Manually trigger callback URL again (simulate duplicate callback)
4. [ ] Verify idempotency behavior

**Expected Results:**
- [ ] Callback handler checks `payment.status === 'completed'`
- [ ] If already completed, skips database updates
- [ ] If already completed, skips email sending
- [ ] Still redirects to success page (good UX)
- [ ] Logs idempotency skip message
- [ ] No duplicate emails are sent
- [ ] No duplicate database updates occur

**Test URLs:**
```
# Simulate duplicate callback
GET /api/payment/callback?token=<token>&orderId=<order_id>
GET /api/payment/callback?subscription_id=<subscription_id>
```

**Log Verification:**
```
# Should see log message:
"Payment already completed, skipping duplicate processing"
"Skipping email sends - payment already completed (idempotency)"
```

---

### 11. Payment Not Found: User Sees Actionable Message ✅

**Objective:** Verify improved UX when payment is not found (Gap 10 fix).

**Steps:**
1. [ ] Navigate to callback URL with invalid/missing payment parameters
2. [ ] OR: Complete payment but payment record doesn't exist in database
3. [ ] Verify error handling

**Expected Results:**
- [ ] User is redirected to `/dashboard/settings/subscription?payment=error&reason=payment_not_found`
- [ ] Toast message displays: "We couldn't find your payment record. Click 'Sync billing status' in Subscription settings to retry, or contact support."
- [ ] Toast duration is longer (8 seconds) for visibility
- [ ] User is on subscription settings page where "Sync billing status" button is visible
- [ ] User can click "Sync billing status" to retry

**Test URL:**
```
GET /api/payment/callback?token=invalid_token
# Expected redirect: /dashboard/settings/subscription?payment=error&reason=payment_not_found
```

---

### 12. Webhook Verification Failure: Rejected ✅

**Objective:** Verify webhooks with invalid signatures are rejected (Gap 7 fix).

**Steps:**
1. [ ] Send webhook with invalid signature
2. [ ] Send webhook without verification headers (production)
3. [ ] Send webhook without verification headers (development)
4. [ ] Verify rejection behavior

**Expected Results:**

**Invalid Signature (Production & Development):**
- [ ] Webhook returns `403 Forbidden`
- [ ] Error message: "Webhook verification failed"
- [ ] Webhook is NOT processed
- [ ] Error is logged

**Missing Headers (Production):**
- [ ] Webhook returns `401 Unauthorized`
- [ ] Error message: "Webhook verification headers required"
- [ ] Webhook is NOT processed

**Missing Headers (Development):**
- [ ] Webhook logs warning but allows processing
- [ ] Warning: "PayPal webhook missing verification headers (development mode - allowing)"
- [ ] Webhook is processed (for development convenience)

**Test Payload:**
```bash
# Invalid signature
curl -X POST https://your-api.com/api/payment/webhook \
  -H "Content-Type: application/json" \
  -H "paypal-transmission-sig: invalid_signature" \
  -d '{"event_type": "PAYMENT.CAPTURE.COMPLETED", ...}'
```

---

### 13. Callback Token Lookup: Subscription Parameter Extraction ✅

**Objective:** Verify callback handler correctly extracts subscription parameters (Gap 2 fix).

**Steps:**
1. [ ] Complete recurring subscription approval
2. [ ] PayPal redirects with various parameter formats:
   - `?subscription_id=I-XXX`
   - `?subscriptionId=I-XXX`
   - `?subscriptionID=I-XXX`
   - `?token=<approval_token>&ba_token=<token>`
3. [ ] Verify payment is found correctly

**Expected Results:**
- [ ] Callback handler extracts `subscription_id` from multiple possible names
- [ ] Payment lookup prioritizes `subscriptionId` for recurring payments
- [ ] Payment lookup falls back to `orderId`/`token` for one-time payments
- [ ] Payment is found successfully
- [ ] Appropriate logging shows which parameters were found

**Test URLs:**
```
GET /api/payment/callback?subscription_id=I-XXXXXXXXXXXXX
GET /api/payment/callback?subscriptionId=I-XXXXXXXXXXXXX
GET /api/payment/callback?token=<token>&ba_token=<ba_token>
```

---

### 14. Billing Period Preservation: One-Time Payments ✅

**Objective:** Verify `billing_period` is stored and preserved for one-time payments (Gap 3 fix).

**Steps:**
1. [ ] Create one-time payment with `billing_period` (monthly or annual)
2. [ ] Complete payment
3. [ ] Verify `billing_period` is stored in `callback_data`
4. [ ] Verify `billing_period` is preserved during payment updates
5. [ ] Verify `updateSubscriptionTier` uses `billing_period` correctly

**Expected Results:**
- [ ] `billing_period` is stored in payment `callback_data` during creation
- [ ] `billing_period` is preserved when payment is updated (callback, webhook, status check)
- [ ] `updateSubscriptionTier` accepts `billingPeriod` parameter
- [ ] Subscription period calculation uses correct `billing_period`

**Database Verification:**
```sql
-- Check billing_period in callback_data
SELECT callback_data->>'billing_period' as billing_period 
FROM payments 
WHERE id = '<payment_id>';
```

---

### 15. Duplicate updateSubscriptionTier: Prevented ✅

**Objective:** Verify `updateSubscriptionTier` is not called twice for recurring subscriptions (Gap 6 fix).

**Steps:**
1. [ ] Complete recurring subscription approval
2. [ ] Monitor logs for `updateSubscriptionTier` calls
3. [ ] Verify only one call is made

**Expected Results:**
- [ ] `updateSubscriptionTier` is called once in recurring block
- [ ] `tierAlreadyUpdated` flag is set to `true`
- [ ] `updateSubscriptionTier` is NOT called again in completion block
- [ ] No duplicate tier updates occur

**Log Verification:**
```
# Should see only ONE call to updateSubscriptionTier for recurring subscriptions
```

---

## Edge Cases & Error Scenarios

### EC1: Payment Already Completed (Callback + Webhook Race)
- [ ] Webhook completes payment first
- [ ] Callback arrives later
- [ ] Callback skips processing (idempotent)
- [ ] No duplicate emails

### EC2: Subscription Not Found in Webhook
- [ ] Webhook received for unknown subscription ID
- [ ] Appropriate warning logged
- [ ] Webhook returns 200 OK (don't fail webhook processing)

### EC3: Multiple Pending Payments Match Amount
- [ ] Multiple pending payments with same amount/currency
- [ ] Webhook handler logs warning
- [ ] Payment matching is attempted but may be ambiguous

### EC4: Grace Period Already Set
- [ ] Failed payment webhook received
- [ ] Grace period already exists
- [ ] Grace period is not overwritten
- [ ] Payment record is still created/updated

---

## Database Schema Verification

### Tier Constraints ✅
- [ ] Run migration `029_verify_tier_constraints.sql`
- [ ] Verify all tier constraints include: `'free', 'starter', 'premium', 'pro', 'enterprise'`
- [ ] Check `subscriptions.tier` constraint
- [ ] Check `subscriptions.pending_tier` constraint
- [ ] Check `payments.tier` constraint
- [ ] Check `overage_records.tier` constraint (if table exists)

**Verification Query:**
```sql
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname IN (
  'subscriptions_tier_check',
  'subscriptions_pending_tier_check',
  'payments_tier_check',
  'overage_records_tier_check'
);
```

---

## Performance & Monitoring

### Logging Verification
- [ ] All webhook events are logged with event type
- [ ] Payment lookups include helpful context (which parameters were found)
- [ ] Idempotency skips are logged
- [ ] Errors include sufficient context for debugging

### Metrics to Monitor
- [ ] Payment completion rate
- [ ] Webhook processing time
- [ ] Sync-subscription success rate
- [ ] Failed payment rate
- [ ] Email delivery rate

---

## Post-Testing Checklist

After completing all tests:
- [ ] All test scenarios pass
- [ ] No duplicate emails sent
- [ ] No duplicate database updates
- [ ] All webhooks are verified
- [ ] Error messages are user-friendly
- [ ] Logs are comprehensive and helpful
- [ ] Database constraints are correct
- [ ] Documentation is updated

---

## Notes

- **PayPal Sandbox:** Use PayPal sandbox for all testing
- **Webhook Testing:** Use PayPal webhook simulator or ngrok for local testing
- **Email Testing:** Verify emails are sent but don't spam test accounts
- **Database:** Use test database, not production
- **Logs:** Review logs after each test to verify expected behavior

---

## Support & Troubleshooting

If tests fail:
1. Check backend logs for errors
2. Verify PayPal webhook configuration
3. Check database constraints
4. Verify environment variables
5. Review gap analysis document for implementation details

**Reference Documents:**
- `SUBSCRIPTION_PAYMENT_GAP_ANALYSIS_AND_PLAN.md` - Full gap analysis
- `PAYPAL_GUEST_CHECKOUT_SETUP.md` - PayPal configuration guide
- Migration files in `backend/src/database/migrations/`

---

**Status:** ✅ Ready for Testing  
**Last Updated:** January 31, 2026
