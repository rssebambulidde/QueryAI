# Pesapal Payment Status Detection & Notifications

## Overview

The system now properly detects payment status (success, cancellation, failure) from Pesapal and sends email notifications for all payment events.

## How Payment Status Detection Works

### 1. Payment Callback (User Redirect)

When Pesapal redirects the user back to your site after payment:

**URL Format:**
```
https://your-backend.railway.app/api/payment/callback?OrderTrackingId=xxx&OrderMerchantReference=xxx
```

**Or Pesapal may send:**
```
https://your-backend.railway.app/api/payment/callback?pesapal_transaction_tracking_id=xxx&pesapal_merchant_reference=xxx
```

**What Happens:**
1. Backend receives callback with tracking ID
2. Queries Pesapal API to get latest payment status
3. Updates payment record in database
4. If **completed**: Updates subscription + sends success email
5. If **cancelled**: Sends cancellation email
6. If **failed**: Sends failure email
7. Redirects user to frontend with appropriate status

### 2. Payment Webhook (IPN - Instant Payment Notification)

Pesapal also sends webhook notifications when payment status changes:

**Endpoint:** `POST /api/payment/webhook`

**What Happens:**
1. Pesapal sends webhook with payment status
2. Backend verifies webhook authenticity
3. Updates payment record
4. If **completed**: Updates subscription + sends success email
5. If **cancelled**: Sends cancellation email
6. If **failed**: Sends failure email

## Payment Status Detection

The system checks payment status using:

1. **Pesapal API:** `GET /Transactions/GetTransactionStatus?OrderTrackingId=xxx`
2. **Status Mapping:**
   - `COMPLETED` → `completed` → Success email + subscription update
   - `CANCELLED` → `cancelled` → Cancellation email
   - `FAILED` → `failed` → Failure email
   - `PENDING` → `pending` → No email, status pending

## Email Notifications

### Payment Success Email
- **Trigger:** Payment status = `completed`
- **Content:** Confirms payment, shows amount, tier, subscription active
- **Sent via:** Brevo API

### Payment Cancellation Email
- **Trigger:** Payment status = `cancelled`
- **Content:** Confirms cancellation, no charges made, link to try again
- **Sent via:** Brevo API

### Payment Failure Email
- **Trigger:** Payment status = `failed`
- **Content:** Payment failed, retry information, update payment method
- **Sent via:** Brevo API

## Required Environment Variables

### Railway Backend:

1. **API_BASE_URL** (Required)
   ```
   API_BASE_URL=https://queryai-production.up.railway.app
   ```
   - Used for Pesapal callback/cancel URLs
   - **Critical:** Must be production URL, not localhost

2. **FRONTEND_URL** (Optional but Recommended)
   ```
   FRONTEND_URL=https://queryai-frontend.pages.dev
   ```
   - Used for redirecting users after payment
   - Falls back to Cloudflare Pages URL if not set

3. **BREVO_API_KEY** (Required for emails)
   ```
   BREVO_API_KEY=your_brevo_api_key
   ```

4. **BREVO_SENDER_EMAIL** (Required)
   ```
   BREVO_SENDER_EMAIL=noreply@queryai.com
   ```
   - Must be verified in Brevo

5. **BREVO_SENDER_NAME** (Optional)
   ```
   BREVO_SENDER_NAME=QueryAI
   ```

6. **PESAPAL_WEBHOOK_URL** (Optional but Recommended)
   ```
   PESAPAL_WEBHOOK_URL=https://queryai-production.up.railway.app/api/payment/webhook
   ```
   - For receiving IPN notifications from Pesapal

## Setup Checklist

- [ ] `API_BASE_URL` set to Railway backend URL (not localhost)
- [ ] `FRONTEND_URL` set to Cloudflare Pages URL
- [ ] `BREVO_API_KEY` configured
- [ ] `BREVO_SENDER_EMAIL` verified in Brevo
- [ ] `PESAPAL_WEBHOOK_URL` registered in Pesapal (optional)
- [ ] Test payment flow end-to-end
- [ ] Verify emails are received

## Testing Payment Status Detection

### Test Successful Payment:

1. Initiate payment
2. Complete payment on Pesapal
3. Should redirect to: `https://queryai-frontend.pages.dev/dashboard?payment=success`
4. Check email inbox for success email
5. Verify subscription tier updated in database

### Test Cancelled Payment:

1. Initiate payment
2. Cancel on Pesapal page
3. Should redirect to: `https://queryai-frontend.pages.dev/dashboard?payment=cancelled`
4. Check email inbox for cancellation email
5. Verify payment status = 'cancelled' in database

### Test Failed Payment:

1. Initiate payment
2. Payment fails (insufficient funds, etc.)
3. Should redirect to: `https://queryai-frontend.pages.dev/dashboard?payment=failed`
4. Check email inbox for failure email
5. Verify payment status = 'failed' in database

## Troubleshooting

### Still Redirecting to Localhost?

1. **Check `API_BASE_URL`:**
   - Must be: `https://queryai-production.up.railway.app`
   - Not: `http://localhost:3001`
   - No trailing slash

2. **Check Railway Logs:**
   - Look for "Payment callback URLs configured"
   - Should show production URL, not localhost

3. **Redeploy:**
   - After changing `API_BASE_URL`, backend must redeploy
   - New payments will use correct callback URL

### Payment Status Not Detected?

1. **Check Railway Logs:**
   - Look for "Payment callback received"
   - Should show OrderTrackingId and merchant reference
   - Check for errors querying Pesapal API

2. **Verify Pesapal Credentials:**
   - `PESAPAL_CONSUMER_KEY` and `PESAPAL_CONSUMER_SECRET` must be correct
   - Check Railway logs for authentication errors

3. **Check Payment Record:**
   - Verify payment exists in database
   - Check `pesapal_order_tracking_id` matches

### Emails Not Sending?

1. **Check Brevo Configuration:**
   - `BREVO_API_KEY` is set correctly
   - Sender email is verified in Brevo
   - Check Brevo dashboard for email activity

2. **Check Railway Logs:**
   - Look for "Payment success email sent" or errors
   - Email errors won't block payment processing

3. **Verify Email Service:**
   - Test Brevo API key is valid
   - Check sender email is verified
   - See `BREVO_API_SETUP.md` for setup

## Payment Flow Diagram

```
User clicks "Upgrade"
    ↓
Payment initiated → Pesapal
    ↓
User completes/cancels on Pesapal
    ↓
Pesapal redirects to: /api/payment/callback?OrderTrackingId=xxx
    ↓
Backend queries Pesapal API for status
    ↓
Status = completed?
    ├─ Yes → Update subscription + Send success email → Redirect to /dashboard?payment=success
    ├─ Cancelled → Send cancellation email → Redirect to /dashboard?payment=cancelled
    └─ Failed → Send failure email → Redirect to /dashboard?payment=failed
```

## Important Notes

1. **Callback URL is Set at Payment Initiation:**
   - If `API_BASE_URL` was localhost when payment was created, that payment will use localhost
   - New payments after fixing `API_BASE_URL` will use correct URL

2. **Webhook is More Reliable:**
   - Webhooks are sent by Pesapal automatically
   - Don't rely solely on callback redirects
   - Register webhook URL in Pesapal dashboard

3. **Status Check:**
   - Backend queries Pesapal API to get latest status
   - More reliable than trusting callback parameters
   - Handles edge cases where status might change

---

**Last Updated:** 2026-01-25
