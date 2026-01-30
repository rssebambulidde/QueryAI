# Testing Strategy

This document describes the backend testing strategy: **unit**, **integration**, **E2E-style**, and **performance** tests.

## Unit Tests

- **Location**: `src/__tests__/*.test.ts`
- **Run**: `npm run test:unit` or `npm run test` (runs all)

### Covered

| Area | File | Notes |
|------|------|--------|
| Subscription service | `subscription.service.test.ts` | TIER_LIMITS, getUserSubscriptionWithLimits, hasFeatureAccess, checkQueryLimit, checkTavilySearchLimit, checkDocumentUploadLimit |
| Payment routes / PayPal | `payment.routes.test.ts`, `paypal.service.test.ts` | Initiate, callback, webhook, status, history, refund; PayPal create/execute/refund/verify |
| Cost tracking | `cost-tracking.service.test.ts` | calculateCost, getCostComparison, trackCost, getUserCostStats |
| Cache | `redis-cache.service.test.ts`, `cache.service.test.ts` | Redis get/set/delete; CacheKeyBuilder, getOrSet, warm, touchKeys, getTieredTtl |
| Security | `payment.security.test.ts` | Auth, webhook verification, own-resource checks |

### Run unit only

```bash
cd backend
npm run test:unit
```

## Integration Tests

- **Location**: `src/integration/*.integration.test.ts` and `src/integration/*.test.ts`
- **Run**: `npm run test:integration`

### Covered

| Area | File | Notes |
|------|------|--------|
| Payment flow | `payment-flow.integration.test.ts` | Full one-time flow: initiate → callback → status (mocked DB/PayPal) |
| Subscription lifecycle | `subscription-lifecycle.integration.test.ts` | Recurring initiate, webhook BILLING.SUBSCRIPTION.CANCELLED |
| Webhook processing | `webhook-processing.integration.test.ts` | PAYMENT.CAPTURE.COMPLETED, verification fail, GET 405 |
| Cost calculation | `cost-calculation.integration.test.ts` | trackCost → getUserCostStats roundtrip; calculateCost vs getCostComparison |
| Cost tracking accuracy | `cost-tracking-accuracy.integration.test.ts` | Rounding, model normalization, token consistency |
| RAG pipeline | `rag-pipeline.test.ts` | RAG/AI flow with mocked embeddings, search, DB |
| Performance | `performance.test.ts` | RAG latency/throughput under load (mocked) |

### Run integration only

```bash
cd backend
npm run test:integration
```

## End-to-End Style Tests

E2E-style tests exercise **full HTTP flows** (initiate → callback → status, etc.) against the real Express app, with **mocked** DB and PayPal. They live in `integration/` and are run via `npm run test:integration`.

- **Complete payment flow**: `payment-flow.integration.test.ts` — one-time initiate → callback → status.
- **Subscription management**: `subscription-lifecycle.integration.test.ts` — recurring initiate, cancellation webhook.
- **Cost tracking accuracy**: `cost-tracking-accuracy.integration.test.ts` and `cost-calculation.integration.test.ts`.

For **browser-based E2E** (Playwright/Cypress) against a live frontend and backend, use a separate E2E setup and config.

## Performance Tests

- **Location**: `src/__tests__/payment.performance.test.ts`, `src/integration/performance.test.ts`
- **Run**: `npm run test:performance` or `npm run test -- --testPathPattern=performance`

### Covered

- Payment processing speed (createPayment, executePayment), webhook processing, concurrent createPayment.
- RAG pipeline throughput, latency percentiles, error rate under load (mocked dependencies).

## Running Tests

```bash
cd backend
npm run test           # all tests
npm run test:unit      # unit only
npm run test:integration   # integration only
npm run test:performance  # performance tests
npm run test:coverage  # with coverage
npm run test:watch     # watch mode
```

## Environment

Tests use `src/__tests__/setup.ts`. Ensures `NODE_ENV=test`, mocks env vars (Supabase, OpenAI, PayPal, etc.), and sets `LOG_LEVEL=error` to reduce noise.

## Notes

- **Jest EPERM / spawn errors**: If you see `spawn EPERM` when running Jest, run tests locally with full permissions (e.g. outside sandboxed environments).
- **Mocking**: Unit and integration tests mock `DatabaseService`, `PayPalService`, `config/database`, `config/redis`, etc. No real DB or PayPal calls.
