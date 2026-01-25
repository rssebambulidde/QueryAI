# Railway Environment Variables Checklist

## Critical Variables for Payment Cancellation Fix

### 1. **NODE_ENV** (Required)
```
NODE_ENV=production
```
- **Why:** Determines if code should use production URLs
- **Check:** Railway Dashboard → Variables → Look for `NODE_ENV`
- **If missing:** Add it and set to `production`

### 2. **FRONTEND_URL** (Recommended)
```
FRONTEND_URL=https://queryai-frontend.pages.dev
```
- **Why:** Used for redirecting users after payment
- **Check:** Railway Dashboard → Variables → Look for `FRONTEND_URL`
- **If missing:** Add it with your Cloudflare Pages URL

### 3. **API_BASE_URL** (Required)
```
API_BASE_URL=https://queryai-production.up.railway.app
```
- **Why:** Used for Pesapal callback/cancel URLs
- **Check:** Railway Dashboard → Variables → Look for `API_BASE_URL`
- **Critical:** Must be production URL, NOT localhost

### 4. **BREVO_API_KEY** (Required for emails)
```
BREVO_API_KEY=your_brevo_api_key_here
```
- **Why:** Required to send email notifications
- **Check:** Railway Dashboard → Variables → Look for `BREVO_API_KEY`
- **Get from:** Brevo Dashboard → Settings → SMTP & API → API Keys

### 5. **BREVO_SENDER_EMAIL** (Required for emails)
```
BREVO_SENDER_EMAIL=noreply@queryai.com
```
- **Why:** Email address to send from
- **Check:** Railway Dashboard → Variables → Look for `BREVO_SENDER_EMAIL`
- **Must be:** Verified in Brevo Dashboard

## How to Check Railway Environment Variables

1. Go to Railway Dashboard
2. Select your backend service
3. Click on **Variables** tab
4. Check each variable listed above
5. Add any missing variables
6. Update any incorrect values
7. **Redeploy** after making changes

## Automatic Railway Variables

Railway automatically provides these (you don't need to set them):
- `RAILWAY_PUBLIC_DOMAIN` - Your Railway domain
- `RAILWAY_ENVIRONMENT` - Environment name
- `PORT` - Server port

The code now uses these to detect production environment even if `NODE_ENV` is not set.

## Testing After Setting Variables

1. **Check Railway Logs:**
   - Look for: `"Frontend URL for redirect"`
   - Should show: `frontendUrl: "https://queryai-frontend.pages.dev"`
   - Should NOT show: `localhost` or `127.0.0.1`

2. **Test Payment Cancellation:**
   - Initiate a NEW payment (old payments may still use old URLs)
   - Cancel on Pesapal
   - Should redirect to production URL
   - Check email inbox for cancellation email

## Troubleshooting

### Still Redirecting to Localhost?

1. **Check `NODE_ENV`:**
   - Must be exactly `production` (lowercase)
   - Not `Production` or `PRODUCTION`

2. **Check Railway Logs:**
   - Look for log: `"Frontend URL for redirect"`
   - Check `isProduction` value - should be `true`
   - Check `nodeEnv` value - should be `production`

3. **Verify Railway Domain:**
   - Check if `RAILWAY_PUBLIC_DOMAIN` is set (automatic)
   - Code uses this to detect production

### Email Not Sending?

1. **Check `BREVO_API_KEY`:**
   - Must be valid API key from Brevo
   - Check Brevo Dashboard for API key

2. **Check `BREVO_SENDER_EMAIL`:**
   - Must be verified in Brevo
   - Go to Brevo Dashboard → Settings → Senders & IP
   - Verify sender email is confirmed

3. **Check Railway Logs:**
   - Look for: `"Payment cancellation email sent"`
   - Check for any email errors

---

**Last Updated:** 2026-01-25
