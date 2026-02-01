# PayPal International Subscription Setup Guide

## Problem: USA Address Restrictions for Subscriptions

When users try to subscribe through PayPal account (recurring subscriptions), PayPal may show USA address format with state dropdown and ZIP code validation, even for international users.

## Root Cause

PayPal Subscriptions API uses **business account country** and **subscription plan settings** to determine address format. If your PayPal business account is set to USA, PayPal will default to USA address format for subscriptions.

## Solution Steps

### Step 1: Verify PayPal Business Account Country

1. Log in to PayPal Business Account: https://www.paypal.com/businessmanage/account/settings
2. Go to **Account Settings** → **Business Information**
3. Check **Business Address** and **Business Country**
4. **If set to USA and you're operating internationally:**
   - Update business address to your actual business location (e.g., Uganda)
   - This affects how PayPal determines default address format

**⚠️ Important:** Changing business country may require:
- Business verification documents
- Tax information updates
- May affect existing subscription plans

### Step 2: Check Subscription Plan Settings

1. Go to PayPal Dashboard → **Products & Services** → **Subscriptions**
2. Click on each subscription plan (Starter, Premium, Pro, Enterprise)
3. Check plan settings:
   - **Country/Region restrictions** - Should be set to "All countries" or your target countries
   - **Currency** - Ensure UGX and USD are both enabled
   - **Billing cycle** - Verify monthly/annual settings

### Step 3: Create International-Friendly Plans (If Needed)

If plans are restricted to USA:

1. **Option A: Update Existing Plans**
   - Edit each plan
   - Remove country restrictions
   - Enable international currencies

2. **Option B: Create New Plans for International Markets**
   - Create separate plans for international users
   - Set up plans with appropriate currencies (UGX, USD)
   - Update environment variables with new plan IDs

### Step 4: Verify PayPal Account Settings

1. **Account Settings** → **Payment Preferences**
   - Ensure **International Payments** are enabled
   - Check **Accepted Currencies** (UGX, USD)

2. **Account Settings** → **Website Payments**
   - **PayPal Account Optional**: ON
   - **Auto Return**: OFF (recommended)
   - **Express Checkout**: OFF (if causing issues)

### Step 5: Test Subscription Flow

1. Test with a user account from your target country (e.g., Uganda)
2. Try creating a recurring subscription
3. Check if address form shows:
   - ✅ Country dropdown (not just USA)
   - ✅ Appropriate address fields for that country
   - ✅ No USA state/ZIP restrictions

## Code Implementation

Our code already:
- ✅ Removes locale restrictions from approval URLs
- ✅ Lets PayPal auto-detect user's country
- ✅ Removes state/ZIP parameters from URLs

**However**, PayPal still uses:
- Business account country (if user doesn't have PayPal account)
- Subscription plan country settings
- User's PayPal account country (if logged in)

## Workarounds

### For Users Experiencing USA Address Restrictions:

1. **Manual Country Selection:**
   - Look for country dropdown in PayPal address form
   - Select correct country (e.g., Uganda)
   - Address fields should update automatically

2. **Use One-Time Payment:**
   - One-time payments support international addresses better
   - User can manually renew when needed
   - No PayPal account required

3. **Create PayPal Account with Correct Country:**
   - If user creates PayPal account, set country to their actual location
   - PayPal will use account country for address format

## PayPal Support

If issues persist after checking settings:

1. Contact PayPal Business Support
2. Request to:
   - Verify account is set up for international subscriptions
   - Check if subscription plans have country restrictions
   - Enable international billing address support

## Testing Checklist

- [ ] Business account country is set correctly
- [ ] Subscription plans allow international countries
- [ ] Currencies (UGX, USD) are enabled
- [ ] Test subscription with international user
- [ ] Address form shows correct country format
- [ ] No USA state/ZIP restrictions appear

## Additional Notes

- **One-time payments** work better for international addresses (already fixed)
- **Recurring subscriptions** are more restrictive due to PayPal's subscription management system
- PayPal may still show USA format if:
  - Business account is USA-based
  - User's PayPal account is USA-based
  - Subscription plan has USA restrictions

## Recommended Approach

1. **Primary:** Fix PayPal business account and plan settings (Steps 1-2)
2. **Fallback:** Encourage one-time payments for international users
3. **Long-term:** Consider Stripe or other payment providers for better international support
