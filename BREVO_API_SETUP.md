# Brevo API Setup for Email Notifications

## Overview

The email service now uses Brevo API (formerly Sendinblue) for sending transactional emails. This is separate from the SMTP configuration used for Supabase auth emails.

## Step 1: Get Brevo API Key

1. Go to **Brevo Dashboard**: https://app.brevo.com/
2. Navigate to: **Settings** → **SMTP & API** → **API Keys** tab
3. Click **"Generate New Key"**
4. Name it: `QueryAI Transactional Emails`
5. **Copy the API key immediately** - you won't be able to see it again!

**Note:** This is different from the SMTP key used for Supabase. You need an **API Key** for the transactional email API.

## Step 2: Configure Environment Variables

Add these to your Railway backend service environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `BREVO_API_KEY` | Your Brevo API key | `xkeysib-1234567890abcdef...` |
| `BREVO_SENDER_EMAIL` | Sender email address | `noreply@queryai.com` |
| `BREVO_SENDER_NAME` | Sender display name | `QueryAI` |

### Railway Setup:

1. Go to Railway Dashboard → Your Backend Service
2. Navigate to **Variables** tab
3. Add the three variables above
4. Save and redeploy

## Step 3: Verify Sender Email

**Important:** The sender email must be verified in Brevo:

1. Go to Brevo Dashboard → **Settings** → **Senders & IP**
2. Click **"Add a Sender"**
3. Enter your sender email (e.g., `noreply@queryai.com`)
4. Verify the email by clicking the confirmation link sent to that address
5. Or verify your domain for better deliverability

## Step 4: Test Email Sending

After deployment, test by:

1. Making a payment (should trigger payment success email)
2. Or manually trigger via API:
   ```bash
   curl -X POST https://your-backend-url/api/jobs/renewals
   ```

Check Railway logs to see if emails are being sent successfully.

## Email Types

The service sends these emails:

1. **Payment Success** - When payment completes
2. **Payment Failure** - When payment fails (with retry info)
3. **Renewal Reminder** - Before subscription renewal
4. **Cancellation** - When subscription is cancelled
5. **Grace Period Warning** - When payment fails and grace period starts

## Troubleshooting

### "API key not configured"
- Check `BREVO_API_KEY` is set in Railway
- Verify the key is correct (starts with `xkeysib-`)

### "Sender not verified"
- Verify sender email in Brevo Dashboard
- Or use a verified domain

### "Email not received"
- Check spam folder
- Verify sender email is verified in Brevo
- Check Railway logs for error messages
- Check Brevo dashboard → Statistics → Email Activity

## Free Tier Limits

Brevo free tier includes:
- **300 emails/day**
- Perfect for development and small production apps
- Upgrade when you need more

## Monitoring

Monitor email sending:
- **Brevo Dashboard**: https://app.brevo.com/statistics/email/activity
- **Railway Logs**: Check for email sending errors
- **Email Delivery**: Check bounce rates and delivery status

---

**Brevo API Documentation**: https://developers.brevo.com/
**Brevo Dashboard**: https://app.brevo.com/
