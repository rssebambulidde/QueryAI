# Payment Cancellation Issues - Fix Summary

## Issues Identified from HTTP Logs

1. **Webhook returning 500 error** - `GET /api/payment/webhook` returning 500
2. **Email not sent** - No cancellation email received
3. **Status still pending** - Payment status not updated to "cancelled"

## Root Causes

### Issue 1: Webhook 500 Error

**Problem:** Webhook is being called with `GET` method instead of `POST`

**HTTP Logs Show:**
```
GET /api/payment/webhook 500 154ms
```

**Root Cause:**
- Webhook route only accepts `POST` requests
- Something is calling it with `GET` (possibly browser, health check, or Pesapal testing)
- This causes a 500 error because the handler expects POST body data

**Fix Applied:**
- Added explicit `GET` handler that returns `405 Method Not Allowed`
- This prevents 500 errors and clearly indicates webhooks must use POST
- Added logging to track when webhook is called with wrong method

### Issue 2: Email Not Sent

**Possible Causes:**
1. Payment not found in database
2. User profile not found
3. Email service failing silently
4. Brevo API key not configured

**Fix Applied:**
- Added detailed logging for payment lookup
- Added error handling with detailed error messages
- Added logging to track email sending success/failure
- Added checks for user profile existence

### Issue 3: Status Still Pending

**Possible Causes:**
1. Payment not found - query parameters don't match database
2. Status update failing silently
3. Database update not committing

**Fix Applied:**
- Added logging before and after payment lookup
- Added logging for status updates
- Added error handling for status update failures

## What to Check in Railway Logs

After deploying, check Railway logs for these messages:

### 1. Payment Cancellation Route Called
```
"Payment cancellation route called" {
  "queryParams": {...},  // Check what parameters are received
  "frontendUrl": "...",
  "isProduction": true
}
```

### 2. Payment Lookup
```
"Looking up payment" {
  "orderTrackingId": "...",
  "merchantReference": "..."
}

"Payment lookup by order tracking ID" {
  "orderTrackingId": "...",
  "found": true/false,  // Should be true
  "paymentId": "..."
}
```

### 3. Payment Status Update
```
"Payment status updated" {
  "paymentId": "...",
  "userId": "...",
  "status": "cancelled"  // Should be cancelled, not pending
}
```

### 4. Email Sending
```
"Payment cancellation email sent" {
  "paymentId": "...",
  "userEmail": "...",
  "emailSent": true  // Should be true
}
```

### 5. Errors to Watch For
```
"Payment not found for cancellation" {
  "orderTrackingId": "...",
  "merchantReference": "..."
}

"Failed to send payment cancellation email" {
  "paymentId": "...",
  "userId": "...",
  "error": "..."
}

"User profile not found for payment cancellation email" {
  "paymentId": "...",
  "userId": "..."
}
```

## Debugging Steps

### Step 1: Check if Payment is Found

Look for these log messages:
- `"Looking up payment"` - Shows what parameters are being searched
- `"Payment lookup by order tracking ID"` or `"Payment lookup by merchant reference"` - Shows if payment was found

**If payment not found:**
- Check if `orderTrackingId` or `merchantReference` in query params matches what's in database
- Check database for payment record
- Verify `pesapal_order_tracking_id` or `pesapal_merchant_reference` in payments table

### Step 2: Check if Status is Updated

Look for:
- `"Payment status updated"` - Should show `status: "cancelled"`

**If status not updated:**
- Check for errors in logs
- Verify database update succeeded
- Check if payment record exists

### Step 3: Check if Email is Sent

Look for:
- `"Payment cancellation email sent"` - Should show `emailSent: true`

**If email not sent:**
- Check for `"Failed to send payment cancellation email"` error
- Verify `BREVO_API_KEY` is set correctly
- Verify `BREVO_SENDER_EMAIL` is verified in Brevo
- Check Brevo dashboard for email activity

## Common Issues and Solutions

### Issue: Payment Not Found

**Symptoms:**
- Log shows `"Payment not found for cancellation"`
- Status remains "pending"

**Solutions:**
1. Check query parameters in logs match database
2. Verify payment exists in database
3. Check if `pesapal_order_tracking_id` or `pesapal_merchant_reference` matches
4. Try using merchant reference instead of order tracking ID

### Issue: Email Not Sending

**Symptoms:**
- No email received
- Log shows `"Failed to send payment cancellation email"`

**Solutions:**
1. Check `BREVO_API_KEY` is set correctly in Railway
2. Verify `BREVO_SENDER_EMAIL` is verified in Brevo Dashboard
3. Check Railway logs for email error details
4. Test Brevo API key is valid

### Issue: Status Not Updating

**Symptoms:**
- Status remains "pending" in billing history
- No error in logs

**Solutions:**
1. Check if payment was found (look for "Payment lookup" logs)
2. Check if status update succeeded (look for "Payment status updated" logs)
3. Verify database connection is working
4. Check for database errors in logs

## Testing After Fix

1. **Create a NEW payment** (old payments may have issues)
2. **Cancel payment on Pesapal**
3. **Check Railway logs** for:
   - Payment cancellation route called
   - Payment found
   - Status updated
   - Email sent
4. **Check billing history** - should show "cancelled"
5. **Check email inbox** - should receive cancellation email

## Next Steps

1. **Deploy the fix** (code is ready)
2. **Check Railway logs** after next cancellation
3. **Verify payment is found** - look for "Payment lookup" logs
4. **Verify status is updated** - look for "Payment status updated" logs
5. **Verify email is sent** - look for "Payment cancellation email sent" logs

---

**Last Updated:** 2026-01-25
