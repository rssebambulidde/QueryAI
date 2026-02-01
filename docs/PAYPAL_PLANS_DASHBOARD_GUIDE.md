# PayPal Subscription Plans – Dashboard Setup Guide

This guide walks you through creating **Products** and **Plans** in the PayPal Developer Dashboard so QueryAI can use **recurring (subscription)** payments.

---

## Prerequisites

- PayPal Business account (or Sandbox test account)
- Log in at [developer.paypal.com](https://developer.paypal.com)

---

## Step 1: Open Products & Plans

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Select your **App** (or create one).
3. In the left sidebar, go to **Products & Plans** (under “Billing” or “Subscriptions”).
4. You’ll create **one Product** (e.g. “QueryAI”) and **three Plans** (Starter, Premium, Pro).

---

## Step 2: Create the Product

1. Click **Create product**.
2. Fill in:
   - **Product name:** `QueryAI Subscriptions`
   - **Description:** (optional) e.g. `QueryAI subscription tiers – Starter, Premium, Pro`
   - **Product type:** **Subscription**
3. Click **Save**.
4. You’ll be taken to the product page. Keep this open; you’ll add plans next.

---

## Step 3: Create Plans (one per tier)

Your app expects **monthly** plans with these prices (USD):

| Tier    | Price/month |
|---------|-------------|
| Starter | $9          |
| Premium | $15         |
| Pro     | $45         |

Create **one plan per tier** as below.

### 3a. Create Starter plan ($9/month)

1. On the product page, click **Add plan** (or **Create plan**).
2. **Plan name:** `QueryAI Starter`
3. **Billing cycle:**
   - **Frequency:** Monthly
   - **Price:** `9.00` **USD**
   - (Leave “Trial” and “Setup fee” empty unless you want them.)
4. **Plan ID:**  
   - If the UI shows “Plan ID” or “Custom ID”, you can leave it blank; PayPal will generate an ID.  
   - After saving, **copy the Plan ID** (it looks like `P-XXXXXXXX`). You’ll use it as `PAYPAL_PLAN_ID_STARTER`.
5. Save the plan.

### 3b. Create Premium plan ($15/month)

1. **Add plan** again on the same product.
2. **Plan name:** `QueryAI Premium`
3. **Billing cycle:** Monthly, **$15.00** USD.
4. Save and **copy the Plan ID** → use as `PAYPAL_PLAN_ID_PREMIUM`.

### 3c. Create Pro plan ($45/month)

1. **Add plan** again.
2. **Plan name:** `QueryAI Pro`
3. **Billing cycle:** Monthly, **$45.00** USD.
4. Save and **copy the Plan ID** → use as `PAYPAL_PLAN_ID_PRO`.

---

## Step 4: Get the Plan IDs

1. In **Products & Plans**, open your product and each plan.
2. Each plan has a **Plan ID** (starts with `P-`). Copy all three:

| Plan        | Env variable              | Example ID   |
|------------|---------------------------|--------------|
| Starter    | `PAYPAL_PLAN_ID_STARTER`  | `P-1AB23456` |
| Premium    | `PAYPAL_PLAN_ID_PREMIUM`  | `P-2CD34567` |
| Pro        | `PAYPAL_PLAN_ID_PRO`      | `P-3EF45678` |

3. Add them to your backend `.env`:

```env
PAYPAL_PLAN_ID_STARTER=P-xxxxxxxx
PAYPAL_PLAN_ID_PREMIUM=P-xxxxxxxx
PAYPAL_PLAN_ID_PRO=P-xxxxxxxx
```

---

## Step 5: Sandbox vs Live

- **Sandbox:** Use the Dashboard in **Sandbox** mode (toggle at top). Create the product/plans there and use Sandbox credentials + these plan IDs for testing.
- **Live:** Switch to **Live**, create the same product/plans (or use “Go live” if the UI offers it), then use Live credentials and the **Live** plan IDs in production `.env`.

Plan IDs are different between Sandbox and Live; set the correct ones per environment.

---

## Step 6: Verify in Your App

1. Restart the backend so it picks up the new env vars.
2. Call **POST /api/payment/initiate** with `recurring: true` and a tier (e.g. `starter`).
3. You should get a `redirect_url` that goes to PayPal and shows the correct plan name and price.
4. After approval, the callback will activate the subscription and set `auto_renew: true`.

---

## Quick reference (QueryAI tiers)

| Tier    | Monthly (USD) | Env variable              |
|---------|----------------|---------------------------|
| Starter | $9             | `PAYPAL_PLAN_ID_STARTER`  |
| Premium | $15            | `PAYPAL_PLAN_ID_PREMIUM`  |
| Pro     | $45            | `PAYPAL_PLAN_ID_PRO`      |

---

## Troubleshooting

- **“Plan ID for tier … is not configured”**  
  The corresponding `PAYPAL_PLAN_ID_*` is missing or wrong. Re-copy the Plan ID from the Dashboard and restart the server.

- **Wrong price on PayPal checkout**  
  Check the plan’s billing amount and currency in Products & Plans; it must match the values above (or your app’s pricing) and be in USD if you use USD in the app.

- **Plan not found / invalid**  
  Ensure you’re using Sandbox plan IDs with Sandbox credentials and Live plan IDs with Live credentials.
