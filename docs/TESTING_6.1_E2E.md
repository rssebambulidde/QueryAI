# 6.1 End-to-End Testing (PayPal Payment & Subscription)

This document describes the automated tests added for payment and subscription flows (Week 6.1).

## Test Files

| File | Scope |
|------|--------|
| `backend/src/__tests__/payment.routes.test.ts` | Payment routes: initiate (one-time & recurring), callback, cancel, webhook, status, history, refund; validation and error responses |
| `backend/src/__tests__/payment.security.test.ts` | Authentication (401 for missing/invalid token), webhook signature verification, authorization (own resources only) |
| `backend/src/__tests__/payment.performance.test.ts` | Payment processing speed (mocked), webhook processing speed, concurrent createPayment calls |
| `backend/src/__tests__/paypal.service.test.ts` | PayPal service (existing) + `verifyWebhookSignature` (returns true/false per API response) |

## What’s Covered

### Payment testing
- **One-time PayPal payment:** POST `/api/payment/initiate` returns `redirect_url` and `order_id`; invalid tier/profile/fields return 400.
- **PayPal subscription creation:** POST `/api/payment/initiate` with `recurring: true` returns `subscription_id` and `redirect_url`.
- **Payment cancellation:** GET `/api/payment/cancel` redirects with `payment=cancelled`; when token is present, payment status is updated to cancelled.
- **Webhook handling:** GET webhook returns 405; POST webhook with valid signature returns 200 and processes; when verification fails, returns 200 with `success: false`.
- **Refund processing:** POST `/api/payment/refund` validates payment ownership and status; success path mocks PayPal refund and DB create.
- **Error scenarios:** Missing/invalid tier, missing required fields, user profile not found, payment not found, refund on non-completed payment.

### Integration testing
- **Complete payment flow:** Initiate → redirect URL and order/subscription ID; callback/cancel redirects; status and history with auth.
- **Subscription lifecycle:** Recurring initiate and webhook handling (mocked DB/PayPal).

### Performance testing
- **Payment processing speed:** `createPayment` and `executePayment` (mocked) complete within 2s.
- **Webhook processing speed:** `processWebhook` (sync) completes in &lt;50ms.
- **Concurrent payments:** Multiple `createPayment` calls via `Promise.all`; all resolve and mock is called the expected number of times.

### Security testing
- **Webhook signature verification:** Route calls `verifyWebhookSignature` with headers; when it returns false, response is 200 with `success: false` and “verification” message. PayPal service tests: SUCCESS → true, FAILURE / !ok → false.
- **Authentication:** POST initiate, GET status, GET history, POST refund return 401 when `Authorization` header is missing or token is invalid.
- **Authorization:** GET status and POST refund return 400 when the payment belongs to another user.

## Running the tests

Tests and Jest config live in **`backend/`**. Run all commands from there:

```bash
cd backend
npm test
```

Run only payment-related tests:

```bash
cd backend
npx jest payment
```

Run with coverage:

```bash
cd backend
npm run test:coverage
```

**Note:** Don’t run `npm test` or `npx jest` from the project root (`QueryAI/`). There is no root `package.json` or `jest.config.js`; use `backend/` instead.

## Acceptance criteria (6.1)

- **All tests passing:** Run `npm test` in `backend`; payment, security, and performance tests should pass.
- **Performance acceptable:** Performance tests assert completion within 2s (payment) and &lt;50ms (webhook sync).
- **Security verified:** Auth tests assert 401 for unauthenticated requests; webhook tests assert signature verification is used and failure path returns `success: false`; authorization tests assert 400 when accessing another user’s payment.

## Notes

- Route tests use an in-process Express app and `fetch`; DatabaseService, PayPalService, and (in security tests) AuthService are mocked.
- No real PayPal or database is used; all PayPal calls are mocked.
- “Both providers side-by-side” is N/A; the app is PayPal-only.
