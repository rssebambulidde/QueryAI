# PayPal Guest Checkout Setup Guide

## ⚠️ CRITICAL: This Setting Must Be Enabled

**If users are seeing the PayPal account creation screen instead of card payment form, you MUST enable guest checkout in your PayPal business account settings.**

## Problem
Users are being forced to create a PayPal account when trying to pay with a credit/debit card, even when clicking "Pay with Debit or Credit Card". The checkout shows a form asking for password and date of birth to create a PayPal account.

## Solution
Enable **Guest Checkout** (PayPal Account Optional) in your PayPal business account settings. This is a **REQUIRED** account-level setting that cannot be bypassed with code alone.

## Steps to Enable Guest Checkout

### Step 1: Log in to PayPal Business Account
- Go to https://www.paypal.com/businessmanage/account/settings
- Or navigate to: **Account Settings** → **Website payments**

### Step 2: Enable PayPal Account Optional (CRITICAL)
1. Click on **"Website preferences"** or **"Website payments"**
2. Find the setting: **"PayPal account optional"**
3. **Set it to "On" or "Enabled"** (this is the most important step!)
4. Click **"Save"** or **"Update"**

**⚠️ Without this setting enabled, PayPal will ALWAYS show the account creation screen, regardless of code configuration.**

### Step 3: Verify Email Address
- Ensure your PayPal business account has a **confirmed email address**
- This is required for guest checkout to work
- Check your email and confirm if needed

### Step 4: Wait for Changes to Take Effect
- Changes may take **5-15 minutes** to propagate
- Clear your browser cache/cookies
- Test the checkout flow after enabling
- Try in an incognito/private browser window to verify

## How It Works

### One-Time Payments (Guest Checkout Supported)
When "PayPal Account Optional" is enabled:
- Users can pay with credit/debit cards **without creating a PayPal account**
- The checkout page will show a "Pay with Debit or Credit Card" option
- Users can enter card details directly without PayPal account creation
- Works for **one-time payments only**

### Recurring Subscriptions (PayPal Account Required)
**⚠️ IMPORTANT:** Recurring subscriptions **REQUIRE a PayPal account**:
- PayPal's Subscriptions API does **NOT support guest checkout**
- Cards can be used, but must be saved to a PayPal account
- Users must create or log in to a PayPal account to set up recurring billing
- This is a PayPal API limitation, not a code configuration issue

**Why?** PayPal needs to:
- Store payment methods securely for recurring charges
- Manage subscription lifecycle (cancellations, updates, renewals)
- Handle payment failures and retries automatically

## Important Notes

### One-Time Payments
- **Risk Assessment**: PayPal may still require account creation for some transactions based on:
  - Buyer's purchase history
  - Location/IP address
  - Transaction amount
  - Credit assessment
  
- **Not All Transactions**: Guest checkout may not be available for all transactions due to PayPal's risk assessment

### Recurring Subscriptions
- **PayPal Account Required**: Recurring subscriptions **always require** a PayPal account
- **Card Payments**: Cards can be used, but must be saved to a PayPal account
- **No Guest Checkout**: PayPal's Subscriptions API does not support guest checkout
- **Alternative**: For card-only recurring payments without PayPal account, consider:
  - Using one-time payments and manual renewal reminders
  - Integrating PayPal Payment Method Tokens API (separate integration)
  - Using a different payment provider that supports card-based recurring billing

- **API Integration**: Our code already includes:
  - `fundingSource=card` parameter to pre-select card payment
  - `userAction: PayNow` to show card payment option
  - Proper order creation with card payment support

## Testing

1. After enabling guest checkout, test the payment flow:
   - Click "Pay with Debit or Credit Card" button
   - You should see card payment form directly (not PayPal login)
   - Complete a test transaction

2. If guest checkout still doesn't appear:
   - Verify "PayPal Account Optional" is enabled
   - Check that your email is confirmed
   - Try clearing browser cookies/cache
   - Contact PayPal support if issue persists

## Additional Resources

- [PayPal Guest Checkout Documentation](https://www.paypal.com/us/cshelp/article/how-do-i-accept-cards-with-checkout-using-the-guest-checkout-option--help307)
- [PayPal Developer Documentation](https://developer.paypal.com/docs/checkout/standard/customize/display-funding-source/)

## Other PayPal Web Preferences Settings

### Encrypted Website Payments
**Setting:** Block non-encrypted website payment  
**Recommendation:** **OFF** (Leave disabled)

**Why:** This setting applies to the old HTML button-based payments. Our implementation uses PayPal's **Orders API v2** with server-side SDK (`@paypal/paypal-server-sdk`), which already uses secure HTTPS/API calls. Enabling this setting would only block old-style HTML buttons, which we don't use.

**Note:** All our payment requests are already encrypted via HTTPS and PayPal's secure API endpoints.

### Express Checkout Settings
**Setting:** Support giropay and bank transfer payments  
**Recommendation:** **ON** (Enable if you want to support these payment methods)

**Why:** While we use PayPal's Orders API (not the old Express Checkout), PayPal may internally use Express Checkout for certain payment methods like giropay (Germany) and bank transfers. Enabling this allows PayPal to offer these additional payment options to customers in supported regions.

**Note:** This is optional and mainly affects customers in specific regions (e.g., Germany for giropay).

### Contact Telephone Number
**Setting:** Contact telephone  
**Recommendation:** **On (optional field)** or **Off**

**Why:** 
- **Optional field:** Allows customers to optionally provide a phone number
- **Required field:** May cause some customers to abandon checkout
- **Off:** No phone number requested

**Our Implementation:** We collect phone number as optional in our payment form, so setting this to "On (optional field)" or "Off" is fine.

## Other PayPal Web Preferences Settings

### Encrypted Website Payments
**Setting:** Block non-encrypted website payment  
**Recommendation:** **OFF** (Leave disabled)

**Why:** 
- This setting applies to the **old HTML button-based payments** (legacy PayPal buttons)
- Our implementation uses PayPal's **Orders API v2** with server-side SDK (`@paypal/paypal-server-sdk`)
- All payment requests are already encrypted via **HTTPS** and PayPal's secure API endpoints
- Enabling this would only block old-style HTML buttons, which we don't use

**Our Implementation:**
- Uses secure server-to-server API calls
- All data transmitted over HTTPS/TLS
- No HTML buttons or client-side payment forms
- Payments processed through PayPal's secure API

**Conclusion:** Leave this setting **OFF** - it doesn't apply to our modern API-based implementation.

### Express Checkout Settings
**Setting:** Support giropay and bank transfer payments  
**Recommendation:** **ON** (Optional - enable if you want to support these payment methods)

**Why:**
- While we use PayPal's **Orders API v2** (not the old Express Checkout), PayPal may internally use Express Checkout for certain payment methods
- **giropay**: Popular payment method in Germany
- **Bank transfer**: Alternative payment method for some regions
- Enabling this allows PayPal to offer these additional payment options to customers in supported regions

**Note:** This is **optional** and mainly affects customers in specific regions (e.g., Germany for giropay). If you only want card payments, you can leave this **OFF**.

**Our Implementation:**
- We use Orders API v2 which supports multiple payment methods
- The setting controls whether PayPal offers giropay/bank transfer as options
- Card payments work regardless of this setting

### Contact Telephone Number
**Setting:** Contact telephone  
**Recommendation:** **On (optional field)** or **Off**

**Why:**
- **On (optional field):** Allows customers to optionally provide a phone number
- **On (required field):** May cause some customers to abandon checkout (not recommended)
- **Off:** No phone number requested

**Our Implementation:** 
- We collect phone number as **optional** in our payment form
- Setting this to "On (optional field)" or "Off" both work fine
- Avoid "On (required field)" as it may reduce conversion

## Summary of Recommended Settings

| Setting | Recommended Value | Reason |
|---------|------------------|--------|
| **PayPal Account Optional** | **ON** | Required for guest checkout (card payments without account) |
| **Auto Return** | **OFF** | If guest checkout still shows account creation, turn OFF. Some users report this fixes the issue. |
| **Express Checkout settings** | **OFF** | If guest checkout still shows account creation, turn OFF. Some users report this fixes the issue. |
| **Return URL** | (if Auto Return ON) Your callback URL | Used when Auto Return is enabled |
| **Payment Data Transfer** | (optional) | Requires Auto Return; may not be needed for Orders API |
| **Encrypted Website Payments** | **OFF** | Doesn't apply to Orders API v2 (we use secure API calls) |
| **Support giropay and bank transfer** | **OFF** (if guest checkout issues) | Turning OFF may help guest checkout work |
| **Contact Telephone** | **On (optional)** or **Off** | Matches our optional phone field |

### If One-Time Card Payment Still Asks to Create PayPal Account

1. **Turn OFF "Auto return for website payments"** – Some users report guest checkout only works when this is OFF.
2. **Turn OFF "Express Checkout settings"** (giropay, bank transfer) – Can interfere with guest checkout.
3. **Confirm "PayPal Account Optional" is ON** – Required; changes may take 5–15 minutes to apply.
4. **Clear browser cookies/cache** – Or test in incognito/private window.
5. **PayPal risk assessment** – PayPal may still require account creation based on buyer history, location, or card usage limits. This cannot be overridden in code.

## Support

If you continue to experience issues after enabling guest checkout:
1. Verify the setting is saved correctly
2. Check PayPal account status and email confirmation
3. Review PayPal transaction logs for any errors
4. Contact PayPal Business Support
