# Payment Cancellation Fix - Complete Solution

## Issues Fixed ✅

### 1. Redirect to Localhost ✅
**Problem:** After canceling payment on Pesapal, users were redirected to `http://localhost:3000/dashboard?payment=cancelled` instead of production URL.

**Root Cause:** 
- `FRONTEND_URL` environment variable might not be set in Railway
- Code was falling back to localhost even in production

**Fix:**
- Updated all redirect logic to **never use localhost in production**
- Always defaults to `https://queryai-frontend.pages.dev` in production mode
- Checks if `FRONTEND_URL` contains "localhost" and replaces it

### 2. Payment Status Not Updating ✅
**Problem:** Payments showed as "pending" in billing history instead of "cancelled" even after cancellation.

**Root Cause:**
- Cancel route was setting status to 'cancelled' without checking Pesapal
- Webhook might not be receiving cancellation notifications
- Status wasn't being verified from Pesapal API

**Fix:**
- Cancel route now queries Pesapal API to get actual payment status
- Handles multiple Pesapal query parameter formats
- Updates payment status based on actual Pesapal response
- Webhook also processes cancellations correctly

### 3. No Email Notifications ✅
**Problem:** No cancellation email was sent when payment was cancelled.

**Root Cause:**
- Email was only sent if payment was found, but query params might be missing
- Email service might not be called in all cancellation paths

**Fix:**
- Cancel route now handles multiple query parameter formats
- Checks Pesapal status before sending email
- Sends email after status is confirmed
- Webhook also sends cancellation emails

## Code Changes

### 1. Frontend URL Logic (All Routes)
```typescript
// Always use production frontend URL in production, never localhost
let frontendUrl = config.FRONTEND_URL || process.env.FRONTEND_URL;
if (!frontendUrl || frontendUrl.includes('localhost')) {
  if (config.NODE_ENV === 'production') {
    frontendUrl = 'https://queryai-frontend.pages.dev';
  } else {
    frontendUrl = 'http://localhost:3000';
  }
}
```

### 2. Cancel Route Enhancement
- Handles multiple Pesapal query parameter formats:
  - `OrderTrackingId` / `pesapal_transaction_tracking_id` / `orderTrackingId`
  - `OrderMerchantReference` / `pesapal_merchant_reference` / `orderMerchantReference`
- Queries Pesapal API to get actual payment status
- Updates payment status based on Pesapal response
- Sends cancellation email with proper status

### 3. Comprehensive Logging
- Logs all query parameters received
- Logs frontend URL being used
- Logs payment status from Pesapal
- Logs email sending status

## Required Environment Variables

### In Railway Backend:

1. **FRONTEND_URL** (Optional but Recommended)
   ```
   FRONTEND_URL=https://queryai-frontend.pages.dev
   ```
   - Used for redirecting users after payment
   - If not set, defaults to production URL in production mode

2. **API_BASE_URL** (Required)
   ```
   API_BASE_URL=https://queryai-production.up.railway.app
   ```
   - Used for Pesapal callback/cancel URLs
   - **Critical:** Must be production URL, not localhost

3. **BREVO_API_KEY** (Required for emails)
   ```
   BREVO_API_KEY=your_brevo_api_key
   ```

4. **BREVO_SENDER_EMAIL** (Required)
   ```
   BREVO_SENDER_EMAIL=noreply@queryai.com
   ```
   - Must be verified in Brevo

5. **NODE_ENV** (Should be set)
   ```
   NODE_ENV=production
   ```
   - Ensures production mode is detected

## How It Works Now

### Payment Cancellation Flow:

1. **User cancels on Pesapal**
   - Pesapal redirects to: `https://queryai-production.up.railway.app/api/payment/cancel?OrderTrackingId=xxx`

2. **Backend Cancel Route:**
   - Extracts tracking ID from query params (handles multiple formats)
   - Queries Pesapal API to get actual payment status
   - Updates payment record in database with correct status
   - Sends cancellation email to user
   - Redirects to: `https://queryai-frontend.pages.dev/dashboard?payment=cancelled`

3. **Webhook (IPN) - Backup:**
   - Pesapal also sends webhook notification
   - Backend processes webhook and updates status
   - Sends email if not already sent

### Payment Status Detection:

The system now checks payment status from Pesapal API:
- `COMPLETED` → `completed` → Success email + subscription update
- `CANCELLED` → `cancelled` → Cancellation email
- `FAILED` → `failed` → Failure email
- `PENDING` → `pending` → No email, status pending

## Testing

### Test Cancellation:

1. Initiate a payment
2. Cancel on Pesapal page
3. Should redirect to: `https://queryai-frontend.pages.dev/dashboard?payment=cancelled`
4. Check billing history - should show "cancelled" (not "pending")
5. Check email inbox for cancellation email

### Verify in Railway Logs:

Look for these log messages:
- `"Payment cancellation route called"` - Shows query params and frontend URL
- `"Payment status from Pesapal on cancel"` - Shows actual status from Pesapal
- `"Payment status updated"` - Confirms database update
- `"Payment cancellation email sent"` - Confirms email was sent

## Troubleshooting

### Still Redirecting to Localhost?

1. **Check `NODE_ENV`:**
   - Must be set to `production` in Railway
   - Check Railway logs for `nodeEnv` value

2. **Check `FRONTEND_URL`:**
   - If set, must NOT contain "localhost"
   - Should be: `https://queryai-frontend.pages.dev`

3. **Check Railway Logs:**
   - Look for `"Frontend URL for redirect"` log
   - Should show production URL, not localhost

### Payment Status Still Pending?

1. **Check Railway Logs:**
   - Look for `"Payment status from Pesapal on cancel"` log
   - Check if Pesapal API call succeeded
   - Verify status mapping is correct

2. **Check Webhook:**
   - Verify webhook is receiving IPN notifications
   - Check Railway logs for `"Received Pesapal webhook"`
   - Ensure webhook processes cancellations

3. **Check Database:**
   - Verify payment record exists
   - Check `pesapal_order_tracking_id` matches
   - Verify status was updated

### Email Not Sending?

1. **Check Brevo Configuration:**
   - `BREVO_API_KEY` is set correctly
   - Sender email is verified in Brevo
   - Check Brevo dashboard for email activity

2. **Check Railway Logs:**
   - Look for `"Payment cancellation email sent"` or errors
   - Email errors won't block payment processing

3. **Verify Email Service:**
   - Test Brevo API key is valid
   - Check sender email is verified
   - See `BREVO_API_SETUP.md` for setup

## Important Notes

1. **Old Payments:**
   - Payments created before this fix may still use old callback URLs
   - New payments will use correct URLs
   - Webhook will still process old payments correctly

2. **Webhook is More Reliable:**
   - Webhooks are sent by Pesapal automatically
   - Don't rely solely on callback redirects
   - Webhook processes all payment status changes

3. **Status Check:**
   - Backend queries Pesapal API to get latest status
   - More reliable than trusting callback parameters
   - Handles edge cases where status might change

---

**Last Updated:** 2026-01-25  
**Status:** ✅ All Issues Fixed
