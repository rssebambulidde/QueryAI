# Week 3: PayPal Backend Setup (PayPal-Only)

## 3.1 PayPal Account Setup

### PayPal Business Account

- [ ] Create [PayPal Business account](https://www.paypal.com/businessprofile/)
- [ ] Complete business verification
- [ ] Link bank account
- [ ] Complete identity verification
- [ ] Enable **subscription billing**
- [ ] Enable **direct card processing** (Visa support)

### PayPal Developer Account

- [ ] Create [PayPal Developer account](https://developer.paypal.com/)
- [ ] Create an application (App name, e.g. "QueryAI")
- [ ] Generate API credentials: **Client ID**, **Secret**
- [ ] Configure **sandbox** environment
- [ ] Get **sandbox** test credentials
- [ ] Test Visa card processing in sandbox (PayPal test cards)

### Webhook Configuration

1. [ ] Register webhook URL:  
   `https://your-backend.railway.app/api/payment/paypal-webhook`  
   (Replace with your Railway/public backend URL.)

2. [ ] Configure webhook events:
   - `PAYMENT.SALE.COMPLETED` – Payment completed
   - `BILLING.SUBSCRIPTION.CREATED` – Subscription created
   - `BILLING.SUBSCRIPTION.UPDATED` – Subscription updated
   - `BILLING.SUBSCRIPTION.CANCELLED` – Subscription cancelled
   - `BILLING.SUBSCRIPTION.PAYMENT.FAILED` – Payment failed
   - `PAYMENT.CAPTURE.REFUNDED` – Refund processed

3. [ ] Save the **Webhook ID** (required for signature verification).

4. [ ] Test webhook delivery (PayPal dashboard → Webhooks → your webhook → simulate).

### Environment Variables

Add to `.env` (project root) and Railway environment:

```bash
# PayPal Configuration (ONLY payment provider)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id

# Optional: Plan IDs for subscriptions (monthly USD). Create plans in PayPal Dashboard → Billing → Plans.
# If not set, the service can create plans via API (see PayPalService).
PAYPAL_PLAN_ID_STARTER=
PAYPAL_PLAN_ID_PREMIUM=
PAYPAL_PLAN_ID_PRO=
```

**Remove** (when moving to PayPal-only):

- `PESAPAL_CONSUMER_KEY`
- `PESAPAL_CONSUMER_SECRET`
- `PESAPAL_ENVIRONMENT`
- `PESAPAL_WEBHOOK_URL`

### Acceptance Criteria (3.1)

- [ ] PayPal account fully verified
- [ ] API credentials obtained
- [ ] Webhook configured and tested
- [ ] Environment variables set
- [ ] Visa card processing enabled
- [ ] All Pesapal environment variables removed (when going PayPal-only)

---

## 3.2 PayPal Service Implementation

Uses **`@paypal/paypal-server-sdk`** v2.2.0 (latest). Install with:

```bash
cd backend && npm install @paypal/paypal-server-sdk
```

See `backend/src/services/paypal.service.ts` for:

- PayPal client initialization and authentication
- **Payments:** `createPayment`, `executePayment`, `getPaymentDetails`, `refundPayment`
- **Subscriptions:** `createSubscription`, `getSubscription`, `cancelSubscription`, `updateSubscription`
- **Webhooks:** `verifyWebhookSignature`, `processWebhook`
- Error handling, retries, and logging

### Acceptance Criteria (3.2)

- [ ] PayPal service fully implemented
- [ ] All payment methods working
- [ ] All subscription methods working
- [ ] Webhook handling functional
- [ ] Error handling robust
