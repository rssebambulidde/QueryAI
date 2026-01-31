# PayPal Guest Checkout Setup Guide

## Problem
Users are being forced to create a PayPal account when trying to pay with a credit/debit card, even when clicking "Pay with Debit or Credit Card".

## Solution
Enable **Guest Checkout** (PayPal Account Optional) in your PayPal business account settings.

## Steps to Enable Guest Checkout

1. **Log in to PayPal Business Account**
   - Go to https://www.paypal.com/businessmanage/account/settings
   - Or navigate to: Account Settings > Website payments

2. **Enable PayPal Account Optional**
   - Click on "Website preferences" or "Website payments"
   - Find the setting: **"PayPal account optional"**
   - Set it to **"On"** or **"Enabled"**
   - Save the changes

3. **Verify Email Address**
   - Ensure your PayPal business account has a **confirmed email address**
   - This is required for guest checkout to work

4. **Wait for Changes to Take Effect**
   - Changes may take a few minutes to propagate
   - Test the checkout flow after enabling

## How It Works

When "PayPal Account Optional" is enabled:
- Users can pay with credit/debit cards without creating a PayPal account
- The checkout page will show a "Pay with Debit or Credit Card" option
- Users can enter card details directly without PayPal account creation

## Important Notes

- **Risk Assessment**: PayPal may still require account creation for some transactions based on:
  - Buyer's purchase history
  - Location/IP address
  - Transaction amount
  - Credit assessment
  
- **Not All Transactions**: Guest checkout may not be available for all transactions due to PayPal's risk assessment

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

## Support

If you continue to experience issues after enabling guest checkout:
1. Verify the setting is saved correctly
2. Check PayPal account status and email confirmation
3. Review PayPal transaction logs for any errors
4. Contact PayPal Business Support
