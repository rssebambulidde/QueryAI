# Payment Cancellation Email & Redirect Fix

## Issues Fixed

### 1. Payment Cancellation Redirect to Localhost ✅

**Problem:** After cancelling payment on Pesapal, user was redirected to `http://localhost:3001/api/payment/cancel` instead of production URL.

**Fix:**
- Updated payment callback/cancel URLs to use production Railway URL
- Added fallback to detect production environment
- Uses `API_BASE_URL` environment variable (should be set to Railway URL)

### 2. Missing Email Notification ✅

**Problem:** No email was sent when payment was cancelled.

**Fix:**
- Added `sendPaymentCancellationEmail()` method to EmailService
- Payment cancel route now:
  1. Gets payment info from query parameters
  2. Updates payment status to 'cancelled'
  3. Sends cancellation email to user

## Required Environment Variables

### In Railway Backend Service:

1. **API_BASE_URL** (Required)
   ```
   API_BASE_URL=https://queryai-production.up.railway.app
   ```
   - This is used for Pesapal callback/cancel URLs
   - Should be your Railway backend URL

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
   - Get from Brevo Dashboard → Settings → SMTP & API → API Keys

4. **BREVO_SENDER_EMAIL** (Optional)
   ```
   BREVO_SENDER_EMAIL=noreply@queryai.com
   ```
   - Must be verified in Brevo

5. **BREVO_SENDER_NAME** (Optional)
   ```
   BREVO_SENDER_NAME=QueryAI
   ```

## Setup Steps

### Step 1: Add Environment Variables to Railway

1. Go to Railway Dashboard → Your Backend Service → Variables
2. Add/Update:
   - `API_BASE_URL` = `https://queryai-production.up.railway.app`
   - `FRONTEND_URL` = `https://queryai-frontend.pages.dev`
   - `BREVO_API_KEY` = (your Brevo API key)
   - `BREVO_SENDER_EMAIL` = (your verified email)
   - `BREVO_SENDER_NAME` = `QueryAI`

### Step 2: Verify Brevo Setup

1. Get Brevo API key from [Brevo Dashboard](https://app.brevo.com)
2. Verify sender email in Brevo (Settings → Senders & IP)
3. See `BREVO_API_SETUP.md` for detailed instructions

### Step 3: Test Payment Cancellation

1. Try to make a payment
2. Cancel it on Pesapal page
3. Should redirect to: `https://queryai-frontend.pages.dev/dashboard?payment=cancelled`
4. Check email inbox for cancellation email

## Email Content

When payment is cancelled, user receives:
- **Subject:** "Payment Cancelled - QueryAI"
- **Content:** 
  - Confirms payment was cancelled
  - States no charges were made
  - Provides link to try again
  - Professional HTML template

## Troubleshooting

### Still Redirecting to Localhost?

1. Check `API_BASE_URL` is set in Railway
2. Value should be: `https://queryai-production.up.railway.app`
3. No trailing slash
4. Redeploy after adding variable

### Email Not Sending?

1. Check `BREVO_API_KEY` is set correctly
2. Verify sender email is verified in Brevo
3. Check Railway logs for email errors
4. See `BREVO_API_SETUP.md` for setup

### Payment Info Not Found?

- Pesapal may not always send query parameters on cancel
- Email will only send if payment info is found
- Payment status will still be updated if found

---

**Last Updated:** 2026-01-25
