# Payment Cancellation Debugging Guide

## Current Issues

1. **Still redirecting to localhost**
2. **No email notification received**

## Root Causes

### Issue 1: Redirect to Localhost

**Possible Causes:**
1. **Environment variables not set correctly in Railway**
   - `NODE_ENV` might not be set to `production`
   - `FRONTEND_URL` might not be set or contains localhost
   - Railway might not be detected as production environment

2. **Old payment URLs**
   - Cancellation URL is set when payment is **initiated**
   - If payment was created before fix was deployed, it still uses old URL
   - **Solution:** Create a NEW payment to test

3. **Production detection failing**
   - Code checks for `NODE_ENV === 'production'`
   - Also checks for `RAILWAY_PUBLIC_DOMAIN` (Railway sets this automatically)
   - If neither is detected, defaults to localhost

### Issue 2: No Email Notification

**Possible Causes:**
1. **Brevo configuration missing**
   - `BREVO_API_KEY` not set
   - `BREVO_SENDER_EMAIL` not verified
   - Email service failing silently

2. **Payment not found**
   - Query parameters might not match payment record
   - Payment might not exist in database

3. **Webhook not processing**
   - IPN webhook might not be receiving cancellation notifications
   - Webhook might be failing silently

## Immediate Actions Required

### Step 1: Check Railway Environment Variables

Go to Railway Dashboard → Your Backend Service → Variables

**Required Variables:**
```
NODE_ENV=production
FRONTEND_URL=https://queryai-frontend.pages.dev
API_BASE_URL=https://queryai-production.up.railway.app
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_verified_email@domain.com
```

**Verify:**
- `NODE_ENV` is exactly `production` (lowercase)
- `FRONTEND_URL` does NOT contain `localhost` or `127.0.0.1`
- All variables are set correctly

### Step 2: Check Railway Logs

After setting variables, check Railway logs for:

1. **Production Detection:**
   ```
   "Frontend URL for redirect" {
     "isProduction": true,  // Should be true
     "nodeEnv": "production",  // Should be production
     "hasRailwayDomain": true,  // Should be true
     "frontendUrl": "https://queryai-frontend.pages.dev"  // Should be production URL
   }
   ```

2. **Payment Cancellation:**
   ```
   "Payment cancellation route called" {
     "frontendUrl": "https://queryai-frontend.pages.dev",  // Should be production
     "isProduction": true
   }
   ```

3. **Email Sending:**
   ```
   "Payment cancellation email sent" {
     "paymentId": "...",
     "userEmail": "..."
   }
   ```

### Step 3: Test with NEW Payment

**Important:** Old payments created before the fix will still use old cancellation URLs.

1. **Create a NEW payment** (don't use old payment)
2. Cancel it on Pesapal
3. Should redirect to production URL
4. Check email inbox

### Step 4: Check Webhook Logs

The webhook (IPN) should also process cancellations:

1. Check Railway logs for:
   ```
   "Received Pesapal webhook" {
     "orderTrackingId": "...",
     "notificationType": "..."
   }
   ```

2. Check for:
   ```
   "Payment cancellation email sent via webhook"
   ```

## Debugging Steps

### 1. Verify Production Detection

Check Railway logs for the log message:
```
"Frontend URL for redirect"
```

**Expected values:**
- `isProduction: true`
- `nodeEnv: "production"` OR `hasRailwayDomain: true`
- `frontendUrl: "https://queryai-frontend.pages.dev"`

**If wrong:**
- Set `NODE_ENV=production` in Railway
- Verify `RAILWAY_PUBLIC_DOMAIN` is set (Railway sets this automatically)

### 2. Verify Payment Cancellation Route

Check Railway logs for:
```
"Payment cancellation route called"
```

**Check:**
- `frontendUrl` should be production URL
- `queryParams` should contain `OrderTrackingId` or `OrderMerchantReference`
- `isProduction` should be `true`

### 3. Verify Email Sending

Check Railway logs for:
```
"Payment cancellation email sent"
```

**If missing:**
- Check `BREVO_API_KEY` is set correctly
- Check `BREVO_SENDER_EMAIL` is verified in Brevo
- Check for email errors in logs

### 4. Verify Webhook Processing

Check Railway logs for:
```
"Received Pesapal webhook"
"Payment cancellation email sent via webhook"
```

**If missing:**
- Verify webhook URL is registered in Pesapal
- Check webhook URL: `https://queryai-production.up.railway.app/api/payment/webhook`
- Verify webhook is active in Pesapal dashboard

## Common Issues and Solutions

### Issue: Still Redirecting to Localhost

**Solution:**
1. Set `NODE_ENV=production` in Railway
2. Set `FRONTEND_URL=https://queryai-frontend.pages.dev` in Railway
3. **Create a NEW payment** (old payments use old URLs)
4. Check Railway logs to verify production detection

### Issue: Email Not Sending

**Solution:**
1. Verify `BREVO_API_KEY` is set correctly
2. Verify `BREVO_SENDER_EMAIL` is verified in Brevo Dashboard
3. Check Railway logs for email errors
4. Test Brevo API key is valid

### Issue: Payment Status Not Updating

**Solution:**
1. Check Railway logs for payment status updates
2. Verify webhook is receiving notifications
3. Check database for payment record
4. Verify `pesapal_order_tracking_id` matches

## Testing Checklist

- [ ] `NODE_ENV=production` set in Railway
- [ ] `FRONTEND_URL` set to production URL (not localhost)
- [ ] `API_BASE_URL` set to production URL (not localhost)
- [ ] `BREVO_API_KEY` set correctly
- [ ] `BREVO_SENDER_EMAIL` verified in Brevo
- [ ] Railway logs show `isProduction: true`
- [ ] Railway logs show production frontend URL
- [ ] Created NEW payment (not old one)
- [ ] Cancelled payment on Pesapal
- [ ] Redirected to production URL (not localhost)
- [ ] Received cancellation email
- [ ] Payment status updated to "cancelled" in database

## Next Steps

1. **Set all required environment variables in Railway**
2. **Redeploy backend** after setting variables
3. **Create a NEW payment** to test
4. **Check Railway logs** for debugging information
5. **Verify email is sent** and payment status is updated

---

**Last Updated:** 2026-01-25
