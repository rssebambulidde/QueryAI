# 5.1 PayPal SDK Setup – Implementation Summary

**Status:** ✅ Implemented  
**Priority:** High  
**Files:** `frontend/package.json`, `frontend/app/layout.tsx`, `frontend/components/payment/paypal-provider.tsx`, `frontend/components/payment/paypal-button.tsx`, `frontend/components/payment/payment-dialog.tsx`, `frontend/lib/api.ts`

---

## 1. Dependencies

- **@paypal/react-paypal-js** (^8.4.0) added to `frontend/package.json`.
- Run: `cd frontend && npm install`.

---

## 2. PayPal Provider

- **File:** `frontend/components/payment/paypal-provider.tsx` (client component).
- Wraps children with **PayPalScriptProvider** when `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is set.
- Options: `clientId`, `intent: 'capture'`, `vault: false`, `components: 'buttons'`, `currency: 'USD'`.
- **Layout:** `frontend/app/layout.tsx` wraps app with `<PayPalProvider>` so PayPal buttons load where used.

---

## 3. PayPal Button Component

- **File:** `frontend/components/payment/paypal-button.tsx` (client component).
- **Props:** `tier`, `currency`, `firstName`, `lastName`, `email`, `phoneNumber?`, `recurring?`, `disabled?`, `onError?`, `onRedirect?`.
- **One-time (and client ID set):** Renders **PayPalButtons** from SDK:
  - **createOrder:** Calls `paymentApi.initiate(...)` and returns `order_id` (or `order_tracking_id`).
  - **onApprove:** Redirects to `{API_URL}/api/payment/callback?token={orderID}` so backend captures and redirects to frontend.
  - **onError:** Sets error state and calls `onError(message)`.
- **Recurring or no client ID:** Renders a “Pay with PayPal” button that calls `paymentApi.initiate({ ...formData, recurring })` and redirects to `response.data.redirect_url`.
- **Error handling:** Local error state + optional `onError`; validation and API errors surfaced in the UI.

---

## 4. Payment Dialog

- **File:** `frontend/components/payment/payment-dialog.tsx`.
- Uses **PayPalButton** with form data (firstName, lastName, email, phoneNumber).
- Currency default: **USD**; optional “Subscribe (recurring billing)” checkbox.
- Copy updated from Pesapal to PayPal.
- **PaymentInitiateResponse** in `frontend/lib/api.ts`: added `order_id?`, `subscription_id?`, `recurring?`; kept `order_tracking_id?` for backward compatibility.

---

## 5. Environment

- **NEXT_PUBLIC_PAYPAL_CLIENT_ID** – PayPal client ID (same as backend; used for SDK buttons). If unset, button uses redirect-only flow.
- **NEXT_PUBLIC_API_URL** – Backend base URL (used for callback redirect in onApprove).

---

## 6. Testing

1. **Install:** `cd frontend && npm install`.
2. **Set env:** `NEXT_PUBLIC_PAYPAL_CLIENT_ID=<your-sandbox-client-id>`, `NEXT_PUBLIC_API_URL=<backend-url>`.
3. **PayPal button renders:** Open upgrade/payment dialog; you should see the PayPal button (SDK or “Pay with PayPal” redirect).
4. **One-time flow:** Fill form, leave “Subscribe” unchecked, click PayPal → approve in PayPal → redirect to backend callback → redirect to dashboard?payment=success.
5. **Recurring flow:** Check “Subscribe”, click “Pay with PayPal” → redirect to PayPal subscription approval → callback → success.
6. **Error handling:** Invalid form or failed initiate → error message in dialog; onError clears loading.

---

## 7. Acceptance Criteria

| Criterion | Implementation |
|-----------|----------------|
| PayPal SDK integrated | @paypal/react-paypal-js installed; PayPalScriptProvider in layout; client ID from env. |
| PayPal button works | PayPalButton component: SDK buttons (one-time) or redirect button (recurring / no client ID). |
| Payment flow functional | createOrder → initiate → order_id; onApprove → redirect to backend callback; recurring → initiate with recurring → redirect_url. |
