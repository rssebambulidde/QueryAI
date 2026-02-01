# QueryAI Setup Checklist (as of PayPal-only migration)

Use this list to configure your environment so payments, subscriptions, and the app work end-to-end.

---

## 1. Environment variables

### Backend (`.env` in project root or backend folder)

**Required for core app**

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | (from Supabase dashboard) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | (from Supabase dashboard) |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name | `documents` |
| `JWT_SECRET` | Secret for JWT signing | (long random string) |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:3000` or `https://yourdomain.com` |
| `API_BASE_URL` | Public URL of this backend | `http://localhost:3001` or `https://api.yourdomain.com` |

**Required for PayPal (payments & subscriptions)**

| Variable | Description | Example |
|----------|-------------|---------|
| `PAYPAL_CLIENT_ID` | PayPal app Client ID | (from PayPal Developer Dashboard) |
| `PAYPAL_CLIENT_SECRET` | PayPal app Client Secret | (from PayPal Developer Dashboard) |
| `PAYPAL_MODE` | `sandbox` or `live` | `sandbox` for testing |
| `FRONTEND_URL` | Where users are sent after payment | `http://localhost:3000` or `https://yourdomain.com` |

**Required for recurring subscriptions (optional if you only do one-time payments)**

| Variable | Description | Example |
|----------|-------------|---------|
| `PAYPAL_PLAN_ID_STARTER` | Plan ID for Starter ($9/mo) | `P-xxxxxxxx` (from Dashboard) |
| `PAYPAL_PLAN_ID_PREMIUM` | Plan ID for Premium ($15/mo) | `P-xxxxxxxx` |
| `PAYPAL_PLAN_ID_PRO` | Plan ID for Pro ($45/mo) | `P-xxxxxxxx` |

**Required for subscription renewals & cancel events (webhooks)**

| Variable | Description | Example |
|----------|-------------|---------|
| `PAYPAL_WEBHOOK_ID` | Webhook ID from PayPal Dashboard | (after creating webhook) |

**Optional (AI, search, email, etc.)**

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`, `PINECONE_*`, `BREVO_*`, `REDIS_*`, etc. — set as needed for your features.

---

### Frontend (`.env.local` or hosting env vars)

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:3001` or `https://api.yourdomain.com` |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Same as backend PayPal Client ID (public) | (from PayPal Dashboard) |
| `NEXT_PUBLIC_APP_URL` | Public URL of the frontend (optional) | `https://yourdomain.com` |

Without `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, the PayPal button will not load; users can still use the “Pay with PayPal” redirect flow for one-time and recurring.

---

## 2. Database

- Run all migrations in `backend/src/database/migrations/` in order (including `023_add_paypal_only_support.sql`).
- If you use Supabase, apply the SQL from each migration file in the SQL Editor or via your migration runner.

---

## 3. PayPal Developer Dashboard

### 3.1 App & credentials

1. Go to [developer.paypal.com](https://developer.paypal.com) and log in.
2. **Apps & Credentials** → create or open an app.
3. Under **Sandbox** (testing) or **Live** (production):
   - Copy **Client ID** → `PAYPAL_CLIENT_ID` (backend) and `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (frontend).
   - Copy **Secret** → `PAYPAL_CLIENT_SECRET` (backend only).
4. Set `PAYPAL_MODE` to `sandbox` or `live` to match.

### 3.2 Products & plans (for subscriptions)

1. In the Dashboard, go to **Products & Plans** (under Billing/Subscriptions).
2. Create one **Product** (e.g. “QueryAI Subscriptions”), type **Subscription**.
3. Create **three Plans** on that product:

   | Plan   | Price/month | Env variable               |
   |--------|-------------|----------------------------|
   | Starter| $9 USD      | `PAYPAL_PLAN_ID_STARTER`   |
   | Premium| $15 USD     | `PAYPAL_PLAN_ID_PREMIUM`   |
   | Pro    | $45 USD     | `PAYPAL_PLAN_ID_PRO`       |

4. After saving each plan, copy its **Plan ID** (e.g. `P-xxxxxxxx`) into the corresponding env var.
5. Sandbox and Live have different Plan IDs; use the set that matches `PAYPAL_MODE`.

Detailed steps: see `docs/PAYPAL_PLANS_DASHBOARD_GUIDE.md`.

### 3.3 Webhook (for renewals and cancellations)

1. In the Dashboard, open your app → **Webhooks** (or **Add Webhook**).
2. **Webhook URL:**  
   `https://YOUR_API_DOMAIN/api/payment/webhook`  
   (e.g. `https://api.yourdomain.com/api/payment/webhook`).  
   Must be HTTPS in production; for local testing you need a tunnel (e.g. ngrok).
3. Subscribe to at least:
   - `PAYMENT.CAPTURE.COMPLETED` (one-time payments)
   - `PAYMENT.SALE.COMPLETED` (subscription renewals)
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
4. After saving, copy the **Webhook ID** → `PAYPAL_WEBHOOK_ID` in the backend.

Without the webhook, one-time checkout and redirects still work; subscription renewals and cancel/suspend events will not be applied automatically.

---

## 4. Quick verification

1. **Backend:** Start the API; ensure no “PayPal credentials are not configured” (or similar) errors.
2. **Frontend:** Open dashboard → Subscription; upgrade to a tier. You should see the PayPal button or “Pay with PayPal” flow.
3. **One-time payment:** Complete a one-time payment; you should be redirected back to the dashboard with success and see the new tier.
4. **Recurring:** If plan IDs and webhook are set, subscribe with “Subscribe (recurring billing)”; after approval, subscription and next billing date should show; “Manage in PayPal” should open PayPal.
5. **Billing history:** After a successful payment, billing history should show the new row with provider “PayPal” and an Invoice download for completed payments.

---

## 5. Summary table

| What | Where | Required for |
|------|--------|--------------|
| Backend env (DB, JWT, CORS, API_BASE_URL) | Backend `.env` | App + auth |
| PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE, FRONTEND_URL | Backend `.env` | Payments & redirects |
| PAYPAL_PLAN_ID_* | Backend `.env` | Recurring subscriptions |
| PAYPAL_WEBHOOK_ID | Backend `.env` | Renewals & cancel/suspend events |
| NEXT_PUBLIC_API_URL, NEXT_PUBLIC_PAYPAL_CLIENT_ID | Frontend `.env.local` | Frontend → API & PayPal button |
| Migrations (through 023) | Database | PayPal-only schema |
| PayPal app + Products/Plans + Webhook | PayPal Developer Dashboard | Live payments & subscriptions |

Once these are set, you have everything you need for PayPal-only payments and subscription management as implemented today.
