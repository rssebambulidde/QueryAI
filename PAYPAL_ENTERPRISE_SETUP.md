# PayPal Enterprise Plan Setup Guide

This guide explains how to add the Enterprise subscription plan to PayPal and configure it in your application.

## Step 1: Create Plans in PayPal Dashboard

### For Sandbox (Testing):
1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Log in and navigate to **Dashboard** → **Sandbox** → **Subscriptions** → **Plans**
3. Click **Create Plan**

### For Production:
1. Go to [PayPal Business Dashboard](https://www.paypal.com/businessmanage/account/home)
2. Navigate to **Products & Services** → **Subscriptions** → **Plans**
3. Click **Create Plan**

## Step 2: Create Enterprise Monthly Plan

1. **Plan Details:**
   - **Plan Name**: `QueryAI Enterprise Monthly`
   - **Plan ID**: Will be auto-generated (e.g., `P-XXXXXXXXXXXXX`)
   - **Description**: `Enterprise tier subscription - Monthly billing`

2. **Pricing:**
   - **Billing Cycle**: Monthly
   - **Price**: 
     - **USD**: $99.00
     - **UGX**: 300,000 UGX (if supported, otherwise use USD)
   - **Currency**: USD (or UGX if available)

3. **Payment Preferences:**
   - **Setup Fee**: $0.00
   - **Trial Period**: None (or set as needed)
   - **Payment Failure**: Configure retry logic

4. **Save the Plan ID** - You'll need this for the environment variable

## Step 3: Create Enterprise Annual Plan

1. **Plan Details:**
   - **Plan Name**: `QueryAI Enterprise Annual`
   - **Plan ID**: Will be auto-generated (e.g., `P-YYYYYYYYYYYYY`)
   - **Description**: `Enterprise tier subscription - Annual billing`

2. **Pricing:**
   - **Billing Cycle**: Annual
   - **Price**: 
     - **USD**: $999.00
     - **UGX**: 3,000,000 UGX (if supported, otherwise use USD)
   - **Currency**: USD (or UGX if available)

3. **Payment Preferences:**
   - **Setup Fee**: $0.00
   - **Trial Period**: None (or set as needed)
   - **Payment Failure**: Configure retry logic

4. **Save the Plan ID** - You'll need this for the environment variable

## Step 4: Add Environment Variables

Add the following environment variables to your `.env` file (for local development) and your hosting platform (Railway, Vercel, etc.):

```bash
# Enterprise Monthly Plan ID
PAYPAL_PLAN_ID_ENTERPRISE=P-XXXXXXXXXXXXX

# Enterprise Annual Plan ID
PAYPAL_PLAN_ID_ENTERPRISE_ANNUAL=P-YYYYYYYYYYYYY
```

Replace `P-XXXXXXXXXXXXX` and `P-YYYYYYYYYYYYY` with the actual Plan IDs from PayPal.

## Step 5: Update Your Hosting Platform

### For Railway:
1. Go to your Railway project dashboard
2. Navigate to **Variables** tab
3. Add:
   - `PAYPAL_PLAN_ID_ENTERPRISE` = `P-XXXXXXXXXXXXX`
   - `PAYPAL_PLAN_ID_ENTERPRISE_ANNUAL` = `P-YYYYYYYYYYYYY`
4. Redeploy your application

### For Other Platforms:
Add the environment variables through your platform's dashboard/CLI.

## Step 6: Verify Configuration

1. **Test in Sandbox:**
   - Use sandbox credentials to test Enterprise subscription flow
   - Verify that the correct plan is selected when users upgrade to Enterprise
   - Test both monthly and annual billing

2. **Check Logs:**
   - Monitor application logs to ensure plan IDs are being used correctly
   - Verify PayPal webhook callbacks are received for Enterprise subscriptions

## Important Notes

1. **Currency Support:**
   - PayPal may not support UGX directly
   - If UGX is not available, create plans in USD and let PayPal handle currency conversion
   - Users will see prices in their local currency during checkout

2. **Plan IDs:**
   - Plan IDs are different for Sandbox and Production
   - Make sure to use the correct environment (sandbox vs live) in your `PAYPAL_MODE` setting

3. **Testing:**
   - Always test in Sandbox first before going to Production
   - Use PayPal test accounts to verify the complete flow

4. **Webhooks:**
   - Ensure your PayPal webhook is configured to receive subscription events
   - Webhook URL should point to: `https://your-domain.com/api/payment/webhook`

## Troubleshooting

### Error: "PayPal plan ID for tier 'enterprise' is not configured"
- **Solution**: Make sure you've added `PAYPAL_PLAN_ID_ENTERPRISE` and `PAYPAL_PLAN_ID_ENTERPRISE_ANNUAL` to your environment variables

### Plan not found in PayPal
- **Solution**: Verify the Plan ID is correct and matches the environment (sandbox vs production)

### Currency mismatch
- **Solution**: Ensure the plan currency matches what your application expects, or configure currency conversion in PayPal

## Additional Resources

- [PayPal Subscriptions API Documentation](https://developer.paypal.com/docs/subscriptions/)
- [PayPal Plan Management Guide](https://developer.paypal.com/docs/subscriptions/integrate/create-plan/)
- [PayPal Sandbox Testing Guide](https://developer.paypal.com/docs/api-basics/sandbox/)
