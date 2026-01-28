# Payment & Subscription Enhancement Implementation Checklist

## Quick Reference Guide

This checklist provides a step-by-step guide for implementing the payment and subscription enhancements outlined in the main plan.

---

## Phase 1: Critical Cost Controls (Weeks 1-2)

### Week 1: Cost Control Implementation

#### Day 1-2: Tavily Search Limits
- [ ] Update `subscription.service.ts` to add Tavily search limits
- [ ] Add `tavilySearchesPerMonth` to `TIER_LIMITS`
- [ ] Create `checkTavilySearchLimit()` method
- [ ] Update query route to check Tavily limit before calling Tavily API
- [ ] Add middleware to enforce Tavily limits
- [ ] Update frontend to show Tavily search usage

**Files to Modify:**
- `backend/src/services/subscription.service.ts`
- `backend/src/middleware/subscription.middleware.ts`
- `backend/src/routes/query.routes.ts`
- `frontend/components/subscription/subscription-manager.tsx`

#### Day 3-4: Caching Layer
- [ ] Set up Redis caching (if not already)
- [ ] Create cache service for Tavily results
- [ ] Implement 24-hour cache for Tavily searches
- [ ] Add cache key generation (query + topic)
- [ ] Update query route to check cache before Tavily API call
- [ ] Add cache invalidation logic

**Files to Create/Modify:**
- `backend/src/services/cache.service.ts` (new)
- `backend/src/services/tavily.service.ts` (modify)
- `backend/src/routes/query.routes.ts` (modify)

#### Day 5: LLM Optimization
- [ ] Update LLM service to use GPT-3.5 for Free/Premium tiers
- [ ] Add tier-based model selection logic
- [ ] Update Pro tier to use GPT-3.5 for 80% of queries
- [ ] Add complex query detection for GPT-4 usage
- [ ] Update cost tracking to include model used

**Files to Modify:**
- `backend/src/services/llm.service.ts`
- `backend/src/services/subscription.service.ts`

### Week 2: Pricing Updates

#### Day 1-2: Database Schema Updates
- [ ] Add `starter` tier to subscription enum
- [ ] Update `TIER_LIMITS` with new tier
- [ ] Add `tavily_searches_per_month` column to subscriptions (if needed)
- [ ] Create migration for new tier
- [ ] Update subscription type definitions

**SQL Migration:**
```sql
-- Add starter tier
ALTER TYPE subscription_tier ADD VALUE 'starter';

-- Add Tavily search tracking (if needed)
ALTER TABLE subscriptions ADD COLUMN tavily_searches_used INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN tavily_searches_limit INTEGER;
```

**Files to Modify:**
- `backend/src/database/migrations/007_add_starter_tier.sql` (new)
- `backend/src/types/database.ts`
- `backend/src/services/subscription.service.ts`

#### Day 3-4: Backend Updates
- [ ] Update subscription service with new tier limits
- [ ] Update payment routes to support Starter tier
- [ ] Update pricing constants
- [ ] Add Starter tier to payment initiation
- [ ] Update subscription upgrade/downgrade logic

**Files to Modify:**
- `backend/src/services/subscription.service.ts`
- `backend/src/routes/payment.routes.ts`
- `backend/src/routes/subscription.routes.ts`

#### Day 5: Frontend Updates
- [ ] Update subscription manager UI with Starter tier
- [ ] Update pricing display
- [ ] Add Starter tier to upgrade options
- [ ] Update usage display to show Tavily searches
- [ ] Add overage warnings

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`
- `frontend/components/payment/payment-dialog.tsx`
- `frontend/lib/api.ts`

---

## Phase 2: PayPal Integration (Weeks 3-6)

### Week 3: PayPal Backend Setup

#### Day 1: PayPal Account Setup
- [ ] Create PayPal Business account
- [ ] Complete business verification
- [ ] Create PayPal Developer account
- [ ] Generate API credentials (Client ID, Secret)
- [ ] Set up sandbox environment
- [ ] Configure webhook endpoints

#### Day 2-3: PayPal Service Implementation
- [ ] Create `paypal.service.ts`
- [ ] Implement PayPal authentication
- [ ] Implement payment initiation
- [ ] Implement subscription creation
- [ ] Implement webhook handler
- [ ] Implement refund processing
- [ ] Add error handling

**Files to Create:**
- `backend/src/services/paypal.service.ts` (new)

**Dependencies:**
```bash
npm install @paypal/checkout-server-sdk
```

#### Day 4-5: Database Schema Updates
- [ ] Add PayPal fields to payments table
- [ ] Add PayPal subscription ID to subscriptions table
- [ ] Create migration
- [ ] Update type definitions

**SQL Migration:**
```sql
ALTER TABLE payments ADD COLUMN paypal_payment_id TEXT;
ALTER TABLE payments ADD COLUMN paypal_subscription_id TEXT;
ALTER TABLE payments ADD COLUMN payment_provider TEXT DEFAULT 'pesapal' 
  CHECK (payment_provider IN ('pesapal', 'paypal'));

ALTER TABLE subscriptions ADD COLUMN paypal_subscription_id TEXT;
```

**Files to Modify:**
- `backend/src/database/migrations/008_add_paypal_support.sql` (new)
- `backend/src/types/database.ts`

### Week 4: PayPal Backend Integration

#### Day 1-2: Payment Routes
- [ ] Update payment routes to support PayPal
- [ ] Add PayPal payment initiation endpoint
- [ ] Add PayPal callback handler
- [ ] Add PayPal webhook endpoint
- [ ] Update payment status checking
- [ ] Add payment provider selection

**Files to Modify:**
- `backend/src/routes/payment.routes.ts`
- `backend/src/config/env.ts` (add PayPal env vars)

#### Day 3-4: Subscription Integration
- [ ] Update subscription service for PayPal
- [ ] Add PayPal subscription creation
- [ ] Add PayPal subscription cancellation
- [ ] Add PayPal subscription update
- [ ] Handle PayPal subscription webhooks

**Files to Modify:**
- `backend/src/services/subscription.service.ts`
- `backend/src/routes/subscription.routes.ts`

#### Day 5: Testing
- [ ] Test PayPal sandbox payments
- [ ] Test PayPal subscriptions
- [ ] Test webhook handling
- [ ] Test error scenarios
- [ ] Update unit tests

### Week 5: PayPal Frontend Integration

#### Day 1-2: PayPal SDK Setup
- [ ] Install PayPal SDK
- [ ] Configure PayPal SDK
- [ ] Add PayPal script to frontend
- [ ] Create PayPal button component

**Dependencies:**
```bash
npm install @paypal/react-paypal-js
```

**Files to Create:**
- `frontend/components/payment/paypal-button.tsx` (new)

#### Day 3-4: Payment Dialog Updates
- [ ] Update payment dialog to support PayPal
- [ ] Add payment provider selection
- [ ] Add PayPal checkout button
- [ ] Handle PayPal payment flow
- [ ] Update payment success handling

**Files to Modify:**
- `frontend/components/payment/payment-dialog.tsx`
- `frontend/lib/api.ts`

#### Day 5: Subscription Manager Updates
- [ ] Update subscription manager for PayPal
- [ ] Show payment method
- [ ] Add PayPal subscription management
- [ ] Update billing history display

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`

### Week 6: Testing & Migration

#### Day 1-2: End-to-End Testing
- [ ] Test complete payment flow
- [ ] Test subscription creation
- [ ] Test subscription renewal
- [ ] Test subscription cancellation
- [ ] Test refund processing
- [ ] Test error handling

#### Day 3-4: Migration Planning
- [ ] Identify existing Pesapal users
- [ ] Create migration script
- [ ] Plan user communication
- [ ] Prepare migration emails

#### Day 5: Documentation
- [ ] Update API documentation
- [ ] Update setup guides
- [ ] Create PayPal integration guide
- [ ] Update README files

---

## Phase 3: Enhanced Features (Weeks 7-10)

### Week 7: Annual Billing

#### Day 1-2: Database Updates
- [ ] Add billing period type (monthly/annual)
- [ ] Add annual pricing constants
- [ ] Create migration

**SQL:**
```sql
ALTER TABLE subscriptions ADD COLUMN billing_period TEXT DEFAULT 'monthly' 
  CHECK (billing_period IN ('monthly', 'annual'));
ALTER TABLE subscriptions ADD COLUMN annual_discount DECIMAL(5,2) DEFAULT 0;
```

#### Day 3-4: Backend Implementation
- [ ] Update subscription service for annual billing
- [ ] Add annual pricing calculation
- [ ] Implement prorating for annual plans
- [ ] Update payment routes for annual billing

#### Day 5: Frontend Implementation
- [ ] Add annual billing option to UI
- [ ] Show annual discount
- [ ] Update pricing display
- [ ] Add billing period selector

### Week 8: Usage-Based Pricing

#### Day 1-2: Overage Tracking
- [ ] Add overage tracking to database
- [ ] Create overage calculation service
- [ ] Track usage beyond limits
- [ ] Calculate overage charges

#### Day 3-4: Overage Billing
- [ ] Implement overage billing logic
- [ ] Add overage to invoice
- [ ] Update payment processing
- [ ] Add overage notifications

#### Day 5: Frontend Updates
- [ ] Show overage usage
- [ ] Display overage charges
- [ ] Add overage warnings
- [ ] Update usage display

### Week 9-10: Enterprise Tier

#### Week 9: Enterprise Features
- [ ] Design Enterprise tier features
- [ ] Implement team collaboration
- [ ] Add user management
- [ ] Add enterprise dashboard

#### Week 10: Enterprise Billing
- [ ] Add Enterprise tier to database
- [ ] Implement enterprise billing
- [ ] Add enterprise pricing
- [ ] Create enterprise signup flow

---

## Phase 4: Optimization (Weeks 11-12)

### Week 11: Cost Optimization

#### Day 1-2: Advanced Caching
- [ ] Implement Redis caching
- [ ] Add query result caching
- [ ] Implement cache invalidation
- [ ] Add cache statistics

#### Day 3-4: Query Optimization
- [ ] Implement query deduplication
- [ ] Add query batching
- [ ] Optimize API calls
- [ ] Reduce redundant requests

#### Day 5: Alternative Providers
- [ ] Research alternative search providers
- [ ] Implement provider abstraction
- [ ] Add provider switching
- [ ] Test cost savings

### Week 12: Monitoring & Analytics

#### Day 1-2: Cost Dashboard
- [ ] Create cost tracking service
- [ ] Implement cost dashboard
- [ ] Add cost analytics
- [ ] Create cost reports

#### Day 3-4: Alerts & Monitoring
- [ ] Implement cost alerts
- [ ] Add profitability monitoring
- [ ] Create usage analytics
- [ ] Add performance metrics

#### Day 5: Documentation & Polish
- [ ] Update all documentation
- [ ] Create user guides
- [ ] Add admin documentation
- [ ] Final testing and bug fixes

---

## Environment Variables Checklist

### PayPal Integration
```bash
# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox  # or 'live' for production
PAYPAL_WEBHOOK_ID=your_webhook_id
```

### Cost Control
```bash
# Redis Caching (if not already set)
REDIS_URL=redis://localhost:6379
# or
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
```

---

## Testing Checklist

### Payment Testing
- [ ] Test one-time payment (PayPal)
- [ ] Test subscription creation (PayPal)
- [ ] Test subscription renewal (PayPal)
- [ ] Test payment cancellation
- [ ] Test refund processing
- [ ] Test webhook handling
- [ ] Test error scenarios

### Subscription Testing
- [ ] Test tier upgrades
- [ ] Test tier downgrades
- [ ] Test subscription cancellation
- [ ] Test subscription reactivation
- [ ] Test annual billing
- [ ] Test overage billing

### Cost Control Testing
- [ ] Test Tavily search limits
- [ ] Test query limits
- [ ] Test document upload limits
- [ ] Test caching effectiveness
- [ ] Test cost tracking accuracy

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] PayPal credentials configured
- [ ] Webhook URLs registered
- [ ] Documentation updated

### Deployment
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Run database migrations
- [ ] Verify PayPal integration
- [ ] Test payment flow
- [ ] Monitor for errors

### Post-Deployment
- [ ] Monitor cost metrics
- [ ] Check payment processing
- [ ] Verify subscription renewals
- [ ] Monitor error logs
- [ ] Collect user feedback

---

## Success Criteria

### Phase 1 (Cost Control)
- ✅ Tavily limits implemented
- ✅ Caching reduces API calls by 50%+
- ✅ All paid tiers profitable
- ✅ Cost tracking operational

### Phase 2 (PayPal)
- ✅ PayPal payments working
- ✅ PayPal subscriptions working
- ✅ Webhooks processing correctly
- ✅ Migration completed

### Phase 3 (Features)
- ✅ Annual billing available
- ✅ Overage pricing implemented
- ✅ Enterprise tier launched

### Phase 4 (Optimization)
- ✅ Cache hit rate > 60%
- ✅ Cost per user < 50% of revenue
- ✅ All tiers profitable > 50% margin

---

**Last Updated:** January 28, 2026  
**Next Review:** After each phase completion
