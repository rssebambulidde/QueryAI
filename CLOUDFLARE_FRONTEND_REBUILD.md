# Cloudflare Pages Frontend Rebuild Guide

## Issue: Frontend Changes Not Visible

If you don't see the latest frontend changes (like the Pesapal payment integration), Cloudflare Pages may need to be manually rebuilt.

## ✅ Solution: Trigger Manual Rebuild

### Step 1: Verify Changes Are Pushed

The frontend changes for Pesapal integration are in commit `5969d63`:
- ✅ `frontend/components/payment/payment-dialog.tsx` (new)
- ✅ `frontend/components/subscription/subscription-manager.tsx` (updated)
- ✅ `frontend/lib/api.ts` (updated with paymentApi)

### Step 2: Trigger Cloudflare Pages Rebuild

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Pages**
2. Click on your **QueryAI** project
3. Go to **Deployments** tab
4. Click **Create deployment** (or **Retry deployment** on the latest)
5. Select the `development` branch
6. Click **Save and Deploy**

### Step 3: Verify Build

After triggering rebuild:
1. Check the **Build logs** to ensure it's building from the latest commit
2. Look for: `HEAD is now at 5969d63` or later
3. Wait for build to complete (2-5 minutes)

### Step 4: Clear Browser Cache

After deployment completes:
1. **Hard refresh** your browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or open in **Incognito/Private mode**
3. Navigate to your Cloudflare Pages URL

## 🔍 What to Check

### Payment Integration Features

After rebuild, you should see:

1. **Subscription Tab** (already visible):
   - Click on "Subscription" in the sidebar
   - Should show current plan and usage

2. **Payment Dialog** (new):
   - Click "Upgrade to Premium" or "Upgrade to Pro"
   - Should open a payment form dialog
   - Form fields: First Name, Last Name, Email, Phone (optional)

3. **Pricing Display**:
   - Premium: KES 5,000
   - Pro: KES 15,000

## 🐛 If Still Not Visible

### Check 1: Verify Latest Commit

In Cloudflare build logs, check:
```
HEAD is now at 5969d63 Implement Pesapal payment integration
```

If it shows an older commit, the branch configuration is wrong.

### Check 2: Browser Console

Open browser DevTools (F12) → Console:
- Look for any JavaScript errors
- Check if `PaymentDialog` component is loading
- Verify API calls are working

### Check 3: Network Tab

Check Network tab in DevTools:
- Verify API calls to `/api/payment/initiate` are possible
- Check if frontend can reach backend

### Check 4: Component Files

Verify files exist in Cloudflare build:
- `components/payment/payment-dialog.tsx`
- `lib/api.ts` should have `paymentApi` export

## 📋 Quick Checklist

- [ ] Latest code pushed to `development` branch
- [ ] Cloudflare Pages rebuild triggered
- [ ] Build completed successfully
- [ ] Browser cache cleared (hard refresh)
- [ ] Subscription tab visible
- [ ] Payment dialog opens when clicking upgrade
- [ ] No console errors

## 🚀 Expected Behavior

After successful rebuild:

1. **Subscription Manager**:
   - Shows current tier (Free/Premium/Pro)
   - Shows usage statistics
   - Shows upgrade buttons with pricing

2. **Upgrade Flow**:
   - Click "Upgrade to Premium" or "Upgrade to Pro"
   - Payment dialog opens
   - Fill form and submit
   - Redirects to Pesapal payment page

3. **After Payment**:
   - Redirects back to dashboard
   - Subscription tier updated
   - New features unlocked

## ⚠️ Important Notes

- **Backend must be deployed first**: Payment API endpoints must be live
- **Environment variables**: `NEXT_PUBLIC_API_URL` must point to your Railway backend
- **Database migration**: Run `003_payments_table.sql` in Supabase before testing payments
