# Phase 9 — Payment System Overhaul & Admin Configuration Panel

## Current State Summary

- **Pricing**: Hardcoded in two duplicate files (`backend/src/constants/pricing.ts` + `frontend/lib/pricing.ts`) — no DB backing, no admin UI
- **Tier limits**: Hardcoded in `TIER_LIMITS` const in `backend/src/services/subscription.service.ts` — not configurable at runtime
- **Currency**: UGX+USD supported, but PayPal only operates in USD (UGX amounts were designed for a now-removed Pesapal integration)
- **Admin panel**: Only user management page exists; LLM settings API exists but has no UI; zero pricing/tier/billing admin UI
- **DB config table**: `system_settings` (key-value JSONB) exists and is already used for LLM settings
- **Stale tier refs**: `starter`/`premium` still accepted by payment routes after Phase 8.5 simplification
- **Next migration**: `049`

---

## 9.1 — USD-Only Currency Simplification

Remove UGX currency support. PayPal doesn't support UGX, so the dual-currency system is dead code.

| # | Task | Files | Complexity |
|---|------|-------|------------|
| 9.1.1 | Remove `Currency` union, hardcode `'USD'` in backend pricing constants | `backend/src/constants/pricing.ts` | Low |
| 9.1.2 | Remove `Currency` union + UGX pricing maps in frontend | `frontend/lib/pricing.ts` | Low |
| 9.1.3 | Remove currency selector toggle from payment dialog | `frontend/components/payment/payment-dialog.tsx` | Low |
| 9.1.4 | Remove `currency` prop/param from `PayPalButtonProps` | `frontend/components/payment/paypal-button.tsx` | Low |
| 9.1.5 | Remove currency validation from `/initiate`, hardcode `'USD'` | `backend/src/routes/payment.routes.ts` | Low |
| 9.1.6 | Update billing routes to default USD | `backend/src/routes/billing.routes.ts` | Low |
| 9.1.7 | Update subscription/renewal services to default USD | `subscription.service.ts`, `renewal-reminder.service.ts`, `prorating.service.ts` | Low |
| 9.1.8 | Migration `049`: ALTER `payments.currency` DEFAULT to `'USD'` | New migration | Low |
| 9.1.9 | Remove `currency` from frontend `PaymentInitiateRequest` type, `usage-display.tsx`, subscription-manager currency columns | Frontend types + components | Low |
| 9.1.10 | Update tests referencing UGX | Test files | Low |

**Effort**: ~3–4 hours

---

## 9.2 — DB-Driven Pricing (Admin-Configurable)

Move pricing from hardcoded constants to `system_settings` so superadmin can change prices at runtime. Frontend fetches pricing from an API instead of importing a local file.

| # | Task | Files | Complexity |
|---|------|-------|------------|
| 9.2.1 | Design `pricing_config` schema in `system_settings` | Design doc | Med |
| 9.2.2 | Migration `050`: Seed `system_settings` with key `pricing_config` containing `{ tiers: { pro: { monthly: 45, annual: 450 }, enterprise: { monthly: 99, annual: 999 } } }` | New migration | Low |
| 9.2.3 | Create `PricingConfigService` (static class) — `getAll()`, `getForTier()`, `update(tier, prices)`, validates against Zod schema, caches in memory with 60s TTL | New: `backend/src/services/pricing-config.service.ts` | Med |
| 9.2.4 | Refactor `backend/src/constants/pricing.ts` → thin wrapper that calls `PricingConfigService.getAll()` with fallback to hardcoded defaults (backwards compat while DB loads) | `backend/src/constants/pricing.ts` | Med |
| 9.2.5 | Add `GET /api/config/pricing` (public, no auth) — returns current pricing for all tiers | New route or add to existing config route | Low |
| 9.2.6 | Add `PUT /api/admin/settings/pricing` (superadmin) — update pricing per tier/period, validates amounts > 0, logs audit trail | `backend/src/routes/admin.routes.ts` | Med |
| 9.2.7 | Frontend: Replace static `frontend/lib/pricing.ts` with API-fetched pricing — create `usePricing()` hook with SWR/fetch, cache in Zustand | New: `frontend/lib/hooks/usePricing.ts`, update `frontend/lib/pricing.ts` | Med |
| 9.2.8 | Update all frontend components consuming `getPricing()` to use the hook | `subscription-manager.tsx`, `payment-dialog.tsx`, pricing page, etc. | Med |
| 9.2.9 | Tests: PricingConfigService unit tests + admin endpoint test | New test files | Med |

**Effort**: ~8–10 hours

---

## 9.3 — DB-Driven Tier Limits (Admin-Configurable)

Move `TIER_LIMITS` from a hardcoded constant to `system_settings` so superadmin can adjust limits and feature flags at runtime.

| # | Task | Files | Complexity |
|---|------|-------|------------|
| 9.3.1 | Migration `051`: Seed `system_settings` key `tier_limits` with current `TIER_LIMITS` values as JSONB | New migration | Low |
| 9.3.2 | Create `TierConfigService` (static class) — `getLimits(tier)`, `getAllLimits()`, `updateLimits(tier, limits)`, Zod validation for shape, in-memory cache with 60s TTL | New: `backend/src/services/tier-config.service.ts` | Med |
| 9.3.3 | Refactor `TIER_LIMITS` in `subscription.service.ts` → call `TierConfigService.getLimits(tier)` with hardcoded fallback | `backend/src/services/subscription.service.ts` | Med |
| 9.3.4 | Add `GET /api/config/tier-limits` (public) — returns tier limits for display (feature matrices on pricing page) | New route | Low |
| 9.3.5 | Add `PUT /api/admin/settings/tier-limits/:tier` (superadmin) — update limits for a specific tier, Zod validated | `backend/src/routes/admin.routes.ts` | Med |
| 9.3.6 | Add **feature transfer** endpoint: `POST /api/admin/settings/tier-limits/transfer-feature` — body: `{ feature, fromTier, toTier, enable: boolean }` — atomically enables a feature on one tier and optionally disables on another | `backend/src/routes/admin.routes.ts` | Med |
| 9.3.7 | Frontend: `useTierLimits()` hook that fetches from API, with fallback to static defaults | New: `frontend/lib/hooks/useTierLimits.ts` | Med |
| 9.3.8 | Update subscription-manager, usage-display, and feature-gate components to use dynamic limits | Frontend components | Med |
| 9.3.9 | Tests: TierConfigService unit tests, feature transfer tests | New test files | Med |

**Effort**: ~8–10 hours

---

## 9.4 — Admin Configuration Dashboard (Frontend)

Build a superadmin settings panel where pricing, tier limits, and features can be managed visually.

| # | Task | Files | Complexity |
|---|------|-------|------------|
| 9.4.1 | Create `app/dashboard/admin/settings/page.tsx` with tab layout: **Pricing**, **Tier Limits**, **LLM Settings**, **Feature Flags** | New page | Med |
| 9.4.2 | **Pricing Tab** — Editable table: rows = tiers (pro, enterprise), columns = monthly/annual. Save button calls `PUT /api/admin/settings/pricing`. Show "Last updated" timestamp | New component | Med |
| 9.4.3 | **Tier Limits Tab** — Card per tier showing: queries/month, Tavily searches/month, max collections, research mode toggle, feature checkboxes. Edit inline, save per tier | New component | High |
| 9.4.4 | **Feature Transfer UI** — Drag-and-drop or select-based: "Move feature X from Tier A to Tier B". Preview diff before applying. Calls `POST transfer-feature` | New component | High |
| 9.4.5 | **LLM Settings Tab** — Wire up existing `adminApi.getLLMSettings()` / `updateLLMSettings()` that currently has no UI | New component | Med |
| 9.4.6 | Add `adminApi` methods for pricing + tier-limits CRUD in `frontend/lib/api.ts` | `frontend/lib/api.ts` | Low |
| 9.4.7 | Add navigation link in sidebar for admin settings | Sidebar component | Low |
| 9.4.8 | Add audit log viewer — show recent `system_settings` changes (who changed what, when) | New component + backend query | Med |

**Effort**: ~12–16 hours

---

## 9.5 — PayPal Payment Fixes (From Audit)

Address all gaps found in the PayPal payment system audit.

| # | Task | Priority | Files | Complexity |
|---|------|----------|-------|------------|
| 9.5.1 | **Narrow tier validation** in `/initiate` to `['pro', 'enterprise']` and fix all stale `as 'starter' \| 'premium' \| ...` casts in payment routes | CRITICAL | `payment.routes.ts` | Low |
| 9.5.2 | **Narrow `getPlanIdForTier`** to accept only `'pro' \| 'enterprise'`, remove starter/premium plan ID env vars from mapping | CRITICAL | `paypal.service.ts` | Low |
| 9.5.3 | Clean up stale casts in `subscription.service.ts` (`getPricing` call in renewal handler) | CRITICAL | `subscription.service.ts` | Low |
| 9.5.4 | **Add Zod schema** `PaymentInitiateSchema` and `validateRequest()` middleware to `/initiate` route | MEDIUM | `payment.routes.ts` | Med |
| 9.5.5 | **Remove `processWebhook` no-op** or refactor webhook logic into service | MEDIUM | `paypal.service.ts` | Low |
| 9.5.6 | **Tighten sync-subscription**: only treat `ACTIVE` as completed, not `APPROVAL_PENDING`/`APPROVED` | MEDIUM | `payment.routes.ts` | Low |
| 9.5.7 | **Add duplicate payment prevention** — check for existing pending payment with same user+tier before creating new | MEDIUM | `payment.routes.ts` | Med |
| 9.5.8 | **Rate-limit webhook endpoint** — 60 req/min IP-based | LOW | `payment.routes.ts` | Low |
| 9.5.9 | **Require admin approval for refunds** or add cooldown | LOW | `payment.routes.ts` | Low |
| 9.5.10 | Fix `WebhookEventType` to include `ACTIVATED` and `EXPIRED` | LOW | `paypal.service.ts` | Low |
| 9.5.11 | **Write real payment tests** — initiate validation, callback idempotency, webhook sig rejection, refund limits | MEDIUM | Test files | High |

**Effort**: ~6–8 hours

---

## 9.6 — Additional Ideas (Brainstormed)

| # | Idea | Description | Effort |
|---|------|-------------|--------|
| 9.6.1 | **Pricing change audit trail** | Every pricing/limit change stored in a `config_audit_log` table with old_value, new_value, changed_by, timestamp. Visible in admin dashboard | Med |
| 9.6.2 | **Price change grace period** | When admin changes pricing, existing subscribers keep their price until current period ends. New price only applies on renewal. Store `locked_price` on subscription record | High |
| 9.6.3 | **Promo codes / coupons** | DB table `promo_codes` with discount %, valid date range, usage limit. Apply during payment initiation. Admin can create/manage codes | High |
| 9.6.4 | **Payment analytics dashboard** | Admin page: MRR, churn rate, ARPU, revenue by tier, conversion funnel (free → paid), failed payment trends. Charts with date filters | High |
| 9.6.5 | **Subscription lifecycle emails** | Trial ending (3 days before), renewal upcoming (7 days before), annual discount upsell for monthly users, win-back for churned users | Med |
| 9.6.6 | **Dynamic PayPal plans** | When admin changes pricing, auto-create new PayPal plan via API and update `PAYPAL_PLAN_ID_*` in system_settings. Current subscribers stay on old plan until renewal | High |
| 9.6.7 | **Feature flag granularity** | Beyond boolean on/off, allow `{ enabled: true, limit: 50 }` for features like "API access with rate limit of 50 req/day" | Med |
| 9.6.8 | **Tier comparison API** | `GET /api/config/tier-comparison` — returns structured diff between tiers for the pricing page "Compare Plans" section, auto-generated from tier limits | Low |
| 9.6.9 | **Usage alerts** | Email/in-app notification when user hits 80% / 100% of tier limits. Admin configurable thresholds | Med |
| 9.6.10 | **Bulk tier migration tool** | Admin tool: "Move all users on starter tier to free tier" or "Grant all enterprise users the new teamCollaboration feature" — batch operations with dry-run | High |
| 9.6.11 | **Invoice PDF generation** | Generate downloadable PDF invoices for completed payments. Currently only email-based | Med |
| 9.6.12 | **Subscription pause** | Allow users to pause subscription (keeps tier for N days, then downgrades). Useful for seasonal users | Med |

---

## Recommended Execution Order

```
Phase 9.5  ──→  Phase 9.1  ──→  Phase 9.2  ──→  Phase 9.3  ──→  Phase 9.4
(Fix bugs)     (Simplify)     (DB pricing)   (DB tier limits) (Admin UI)
  ~6h            ~3h             ~9h             ~9h             ~14h
                                                                   │
                                                            Phase 9.6 (pick & choose)
```

**Total core effort**: ~41 hours across 9.1–9.5  
**Total with brainstormed extras**: +20–40 hours depending on which 9.6 items are selected

---

## Key Design Decisions

1. **Legacy `starter`/`premium` pricing in DB** — Keep read-only entries for historical payment lookups, but exclude from admin edit UI and `GET /api/config/pricing` response.
2. **Cache invalidation strategy** — 60s TTL is simple. Alternative: publish a Redis/in-memory event when admin changes config so all instances refresh immediately.
3. **PayPal plan sync** — If admin changes pricing, existing recurring subscribers are on old PayPal plans. Options: (a) ignore until renewal, (b) auto-create new plan and revise subscription via API, (c) document as manual step.
4. **Feature transfer atomicity** — Moving a feature FROM tier A TO tier B should disable it on A and enable on B in a single transaction. Admin should see a preview diff before confirming.
