# Pesapal Integration Setup Guide

## ✅ Implementation Complete

Phase 4.3: Pesapal Integration has been successfully implemented. This guide will help you set up and test the payment integration.

## 📋 Prerequisites

1. **Pesapal Account**: Sign up at [pesapal.com](https://pesapal.com)
2. **Pesapal Consumer Key & Secret**: Get from Pesapal Dashboard
3. **Database Migration**: Run the payments table migration

## 🔧 Setup Steps

### Step 1: Run Database Migration

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open `backend/src/database/migrations/003_payments_table.sql`
3. Copy and paste the entire SQL
4. Click **Run** to execute

This creates the `payments` table to track payment transactions.

### Step 2: Configure Environment Variables

Add these environment variables to your backend (Railway):

```env
# Pesapal Configuration
PESAPAL_CONSUMER_KEY=your_consumer_key_here
PESAPAL_CONSUMER_SECRET=your_consumer_secret_here
PESAPAL_ENVIRONMENT=sandbox  # Use 'sandbox' for testing, 'production' for live
PESAPAL_WEBHOOK_URL=https://your-backend.railway.app/api/payment/webhook
FRONTEND_URL=https://your-frontend.pages.dev  # For callback redirects
```

**Where to find Pesapal credentials:**
1. Log in to [Pesapal Dashboard](https://developer.pesapal.com)
2. Go to **My Apps** → Select your app
3. Copy **Consumer Key** and **Consumer Secret**

### Step 3: Register IPN (Webhook) URL

The webhook URL must be registered with Pesapal. You can do this:

1. **Via Pesapal Dashboard:**
   - Go to **Settings** → **IPN URLs**
   - Add: `https://your-backend.railway.app/api/payment/webhook`

2. **Via API** (automated):
   - The service includes IPN registration functionality
   - You can call it manually or add it to your initialization

### Step 4: Test in Sandbox

1. Set `PESAPAL_ENVIRONMENT=sandbox`
2. Use Pesapal sandbox test credentials
3. Test payment flow:
   - Click "Upgrade" in Subscription tab
   - Fill payment form
   - Complete payment on Pesapal sandbox
   - Verify webhook is received
   - Check subscription is updated

## 🎯 Payment Flow

### User Flow:
1. User clicks "Upgrade to Premium/Pro" in Subscription tab
2. Payment dialog opens with form (firstName, lastName, email, phone)
3. User submits → Payment initiated via Pesapal API
4. User redirected to Pesapal payment page
5. User completes payment on Pesapal
6. Pesapal redirects back to callback URL
7. Webhook notification sent to webhook URL
8. Subscription automatically updated

### Backend Flow:
1. **POST /api/payment/initiate** - Creates payment record, submits to Pesapal
2. **GET /api/payment/callback** - Handles redirect after payment
3. **POST /api/payment/webhook** - Receives IPN from Pesapal
4. **GET /api/payment/status/:orderTrackingId** - Check payment status
5. **GET /api/payment/history** - Get user's payment history

## 📊 Database Schema

### Payments Table

```sql
payments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  subscription_id UUID REFERENCES subscriptions(id),
  pesapal_order_tracking_id TEXT UNIQUE,
  pesapal_merchant_reference TEXT UNIQUE,
  tier TEXT ('free', 'premium', 'pro'),
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'KES',
  status TEXT ('pending', 'completed', 'failed', 'cancelled'),
  payment_method TEXT,
  payment_description TEXT,
  callback_data JSONB,
  webhook_data JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
```

## 🔐 Security Notes

1. **Webhook Verification**: Currently accepts all webhooks. In production, implement signature verification if Pesapal provides it.
2. **Environment Variables**: Never commit Pesapal credentials to Git
3. **HTTPS Required**: Webhook URL must be HTTPS in production
4. **Rate Limiting**: Payment endpoints should have appropriate rate limits

## 🧪 Testing

### Sandbox Test Cards

Pesapal sandbox provides test cards. Check Pesapal documentation for current test card numbers.

### Test Scenarios:

1. **Successful Payment:**
   - Complete payment flow
   - Verify payment status = 'completed'
   - Verify subscription tier updated
   - Check webhook received

2. **Failed Payment:**
   - Cancel on Pesapal page
   - Verify payment status = 'cancelled'
   - Verify subscription NOT updated

3. **Webhook Processing:**
   - Manually trigger webhook (if possible)
   - Verify payment updated
   - Verify subscription updated

## 🚀 Production Checklist

Before going live:

- [ ] Switch `PESAPAL_ENVIRONMENT=production`
- [ ] Use production Pesapal credentials
- [ ] Register production webhook URL
- [ ] Test complete payment flow
- [ ] Verify webhook processing
- [ ] Set up monitoring/alerts for failed payments
- [ ] Test payment failure scenarios
- [ ] Verify subscription updates work correctly

## 📝 API Endpoints

### Initiate Payment
```
POST /api/payment/initiate
Body: {
  tier: 'premium' | 'pro',
  firstName: string,
  lastName: string,
  email: string,
  phoneNumber?: string
}
```

### Get Payment Status
```
GET /api/payment/status/:orderTrackingId
```

### Get Payment History
```
GET /api/payment/history
```

### Webhook (Pesapal → Backend)
```
POST /api/payment/webhook
Body: Pesapal webhook payload
```

## 🐛 Troubleshooting

### Payment not initiating
- Check Pesapal credentials are correct
- Verify environment variable is set correctly
- Check backend logs for authentication errors

### Webhook not received
- Verify webhook URL is registered in Pesapal
- Check webhook URL is publicly accessible (HTTPS)
- Check backend logs for webhook requests

### Subscription not updating
- Check webhook is being processed
- Verify payment status is 'completed'
- Check database for payment record
- Review subscription service logs

## 📚 Resources

- [Pesapal Developer Documentation](https://developer.pesapal.com)
- [Pesapal API Reference](https://developer.pesapal.com/how-to-integrate/api-reference)
- [Pesapal Sandbox Testing](https://developer.pesapal.com/sandbox)

## ✅ Implementation Summary

- ✅ Pesapal service with authentication
- ✅ Payment initiation endpoint
- ✅ Payment callback handling
- ✅ Webhook processing
- ✅ Payment status checking
- ✅ Payment history
- ✅ Database migration for payments table
- ✅ Frontend payment dialog
- ✅ Subscription auto-update on payment
- ✅ Sandbox and production support
