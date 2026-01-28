# Payment & Subscription System - Master Implementation Plan

## Document Overview

This is the master implementation document for all payment and subscription system enhancements. It tracks all phases, tasks, and completion status.

**Version:** 1.0  
**Created:** January 28, 2026  
**Last Updated:** January 28, 2026  
**Status:** Planning Phase - Ready for Implementation

---

## Implementation Status Overview

| Phase | Status | Progress | Start Date | End Date |
|-------|--------|----------|-----------|----------|
| Phase 1: Critical Cost Controls | 🔴 Not Started | 0% | - | - |
| Phase 2: PayPal Integration | 🔴 Not Started | 0% | - | - |
| Phase 3: Enhanced Features | 🔴 Not Started | 0% | - | - |
| Phase 4: Optimization | 🔴 Not Started | 0% | - | - |

**Legend:**
- ✅ Completed
- 🟡 In Progress
- 🔴 Not Started
- ⚠️ Blocked
- ❌ Cancelled

---

## Phase 1: Critical Cost Controls (Weeks 1-2)

**Priority:** 🔴 High  
**Goal:** Implement cost controls to ensure profitability  
**Duration:** 2 weeks

### Week 1: Cost Control Implementation

#### 1.1 Tavily Search Limits Implementation
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 2 days

- [ ] **Backend: Update Subscription Service**
  - [ ] Add `tavilySearchesPerMonth` to `TIER_LIMITS` interface
  - [ ] Update tier limits configuration:
    - Free: 0 searches
    - Starter: 10 searches/month
    - Premium: 50 searches/month
    - Pro: 200 searches/month
  - [ ] Create `checkTavilySearchLimit()` method in `SubscriptionService`
  - [ ] Add method to get current Tavily usage count
  - [ ] Add method to increment Tavily usage
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Backend: Update Query Routes**
  - [ ] Add Tavily limit check before calling Tavily API
  - [ ] Return appropriate error if limit exceeded
  - [ ] Log Tavily usage for tracking
  - [ ] File: `backend/src/routes/query.routes.ts`

- [ ] **Backend: Create Middleware**
  - [ ] Create `checkTavilyLimit` middleware
  - [ ] Integrate middleware into query routes
  - [ ] File: `backend/src/middleware/tavily-limit.middleware.ts` (new)

- [ ] **Frontend: Update Subscription Manager**
  - [ ] Add Tavily search usage display
  - [ ] Show Tavily search limit
  - [ ] Add warning when approaching limit
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

- [ ] **Frontend: Update Usage Display**
  - [ ] Add Tavily searches to usage stats
  - [ ] Show progress bar for Tavily usage
  - [ ] File: `frontend/components/usage/usage-display.tsx`

- [ ] **Testing**
  - [ ] Test Tavily limit enforcement
  - [ ] Test error handling when limit exceeded
  - [ ] Test usage tracking accuracy
  - [ ] Test frontend display

**Acceptance Criteria:**
- Tavily searches are limited per tier
- Users cannot exceed their tier limit
- Usage is accurately tracked
- Frontend displays usage correctly

---

#### 1.2 Caching Layer Implementation
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 2 days

- [ ] **Backend: Redis Setup**
  - [ ] Verify Redis is configured in environment
  - [ ] Test Redis connection
  - [ ] File: `backend/src/config/database.ts`

- [ ] **Backend: Create Cache Service**
  - [ ] Create `CacheService` class
  - [ ] Implement cache get/set methods
  - [ ] Implement cache key generation (query + topic)
  - [ ] Implement cache expiration (24 hours for Tavily)
  - [ ] Implement cache invalidation logic
  - [ ] File: `backend/src/services/cache.service.ts` (new)

- [ ] **Backend: Update Tavily Service**
  - [ ] Check cache before calling Tavily API
  - [ ] Store Tavily results in cache
  - [ ] Return cached results when available
  - [ ] File: `backend/src/services/tavily.service.ts`

- [ ] **Backend: Update Query Route**
  - [ ] Check cache before Tavily API call
  - [ ] Use cached results when available
  - [ ] Log cache hits/misses for monitoring
  - [ ] File: `backend/src/routes/query.routes.ts`

- [ ] **Backend: LLM Response Caching**
  - [ ] Implement caching for similar LLM queries
  - [ ] Cache key based on query hash
  - [ ] Cache expiration: 1 hour
  - [ ] File: `backend/src/services/llm.service.ts`

- [ ] **Monitoring: Cache Statistics**
  - [ ] Track cache hit rate
  - [ ] Track cache miss rate
  - [ ] Add cache metrics to monitoring
  - [ ] File: `backend/src/services/monitoring.service.ts`

- [ ] **Testing**
  - [ ] Test cache hit scenarios
  - [ ] Test cache miss scenarios
  - [ ] Test cache expiration
  - [ ] Test cache invalidation
  - [ ] Measure cache hit rate (target: >60%)

**Acceptance Criteria:**
- Tavily results are cached for 24 hours
- LLM responses are cached for similar queries
- Cache hit rate > 60%
- API calls reduced by 50%+

---

#### 1.3 LLM Optimization
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **Backend: Update LLM Service**
  - [ ] Add tier-based model selection logic
  - [ ] Free/Premium tiers: Use GPT-3.5 Turbo
  - [ ] Pro tier: Use GPT-3.5 for 80% of queries
  - [ ] Pro tier: Use GPT-4 only for complex queries
  - [ ] Implement complex query detection
  - [ ] File: `backend/src/services/llm.service.ts`

- [ ] **Backend: Cost Tracking**
  - [ ] Track which model was used per query
  - [ ] Calculate cost per query
  - [ ] Store cost data for analytics
  - [ ] File: `backend/src/services/cost-tracking.service.ts` (new)

- [ ] **Backend: Update Subscription Service**
  - [ ] Add method to get user tier for model selection
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Testing**
  - [ ] Test model selection per tier
  - [ ] Test complex query detection
  - [ ] Verify cost reduction
  - [ ] Test cost tracking accuracy

**Acceptance Criteria:**
- Free/Premium use GPT-3.5 Turbo
- Pro tier uses GPT-3.5 for most queries
- Cost per query reduced by 95% for Free/Premium
- Cost tracking is accurate

---

### Week 2: Pricing Updates

#### 2.1 Database Schema Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **Database: Add Starter Tier**
  - [ ] Create migration file: `007_add_starter_tier.sql`
  - [ ] Add 'starter' to subscription tier enum
  - [ ] Update subscriptions table constraints
  - [ ] Run migration
  - [ ] File: `backend/src/database/migrations/007_add_starter_tier.sql` (new)

- [ ] **Database: Add Tavily Tracking (if needed)**
  - [ ] Add `tavily_searches_used` column to subscriptions
  - [ ] Add `tavily_searches_limit` column to subscriptions
  - [ ] Create index on `tavily_searches_used`
  - [ ] File: `backend/src/database/migrations/008_add_tavily_tracking.sql` (new)

- [ ] **Backend: Update Type Definitions**
  - [ ] Add 'starter' to Subscription tier type
  - [ ] Update Database types
  - [ ] File: `backend/src/types/database.ts`

- [ ] **Testing**
  - [ ] Test migration runs successfully
  - [ ] Test rollback if needed
  - [ ] Verify new tier in database

**SQL Migration Example:**
```sql
-- Add starter tier
ALTER TYPE subscription_tier ADD VALUE 'starter';

-- Add Tavily tracking
ALTER TABLE subscriptions 
  ADD COLUMN tavily_searches_used INTEGER DEFAULT 0,
  ADD COLUMN tavily_searches_limit INTEGER;

CREATE INDEX idx_subscriptions_tavily_searches ON subscriptions(tavily_searches_used);
```

**Acceptance Criteria:**
- Starter tier exists in database
- Tavily tracking columns added
- Migration runs without errors
- Types updated correctly

---

#### 2.2 Backend Subscription Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Update Subscription Service**
  - [ ] Add Starter tier to `TIER_LIMITS`
  - [ ] Update tier limits:
    - Starter: 100 queries, 10 Tavily, 3 documents, 1 topic
  - [ ] Update all tier limit methods
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Update Payment Routes**
  - [ ] Add Starter tier to payment initiation
  - [ ] Update pricing constants:
    - Starter: $9/month (UGX 27,000)
  - [ ] Update tier validation
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Subscription Routes**
  - [ ] Add Starter tier to upgrade/downgrade options
  - [ ] Update tier validation
  - [ ] File: `backend/src/routes/subscription.routes.ts`

- [ ] **Update Pricing Constants**
  - [ ] Create pricing constants file
  - [ ] Define all tier prices (monthly/annual)
  - [ ] Support UGX and USD
  - [ ] File: `backend/src/constants/pricing.ts` (new)

- [ ] **Testing**
  - [ ] Test Starter tier subscription creation
  - [ ] Test Starter tier limits enforcement
  - [ ] Test upgrade/downgrade to/from Starter
  - [ ] Test pricing display

**Acceptance Criteria:**
- Starter tier fully functional
- Pricing updated correctly
- All tier transitions work
- Limits enforced correctly

---

#### 2.3 Frontend Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Update Subscription Manager**
  - [ ] Add Starter tier to UI
  - [ ] Update pricing display
  - [ ] Add Starter tier to upgrade options
  - [ ] Update tier comparison table
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

- [ ] **Update Payment Dialog**
  - [ ] Add Starter tier option
  - [ ] Update pricing display
  - [ ] File: `frontend/components/payment/payment-dialog.tsx`

- [ ] **Update API Client**
  - [ ] Add Starter tier to API types
  - [ ] Update subscription API calls
  - [ ] File: `frontend/lib/api.ts`

- [ ] **Update Usage Display**
  - [ ] Show Tavily search usage
  - [ ] Update all usage displays
  - [ ] File: `frontend/components/usage/usage-display.tsx`

- [ ] **UI/UX Improvements**
  - [ ] Update tier cards design
  - [ ] Add tier comparison table
  - [ ] Improve pricing clarity
  - [ ] Add feature highlights

- [ ] **Testing**
  - [ ] Test Starter tier subscription flow
  - [ ] Test UI displays correctly
  - [ ] Test responsive design
  - [ ] Test all tier transitions

**Acceptance Criteria:**
- Starter tier visible in UI
- Pricing displayed correctly
- All features work as expected
- UI is responsive and accessible

---

## Phase 1.5: Comprehensive Email Communication System (Week 2-3)

**Priority:** 🔴 High  
**Goal:** Implement comprehensive email notifications for all payment and subscription events  
**Duration:** 1.5 weeks (overlaps with Phase 1 & 2)

### Email Communication Requirements

#### 1.5.1 Payment-Related Emails
**Status:** 🟡 Partially Implemented  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

**Currently Implemented:**
- ✅ Payment success email
- ✅ Payment failure email
- ✅ Payment cancellation email

**Missing Emails to Implement:**
- [ ] **Payment Reminder Email** (7 days before renewal)
  - Remind user of upcoming payment
  - Show amount and date
  - Link to update payment method
  - File: `backend/src/services/email.service.ts`

- [ ] **Payment Retry Notification** (when automatic retry occurs)
  - Notify user of retry attempt
  - Show retry count
  - Link to update payment method
  - File: `backend/src/services/email.service.ts`

- [ ] **Payment Method Updated Confirmation**
  - Confirm payment method change
  - Show last 4 digits of new method
  - File: `backend/src/services/email.service.ts`

- [ ] **Invoice Email** (with PDF attachment)
  - Send invoice after successful payment
  - Include PDF attachment
  - Show payment details
  - File: `backend/src/services/email.service.ts`

- [ ] **Refund Confirmation Email**
  - Confirm refund processing
  - Show refund amount
  - Estimated refund time
  - File: `backend/src/services/email.service.ts`

---

#### 1.5.2 Subscription-Related Emails
**Status:** 🟡 Partially Implemented  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

**Currently Implemented:**
- ✅ Subscription cancellation email
- ✅ Renewal reminder email
- ✅ Grace period warning email

**Missing Emails to Implement:**
- [ ] **Subscription Renewal Confirmation** (after successful renewal)
  - Confirm successful renewal
  - Show new period dates
  - Show amount charged
  - File: `backend/src/services/email.service.ts`

- [ ] **Failed Renewal Notification** (when auto-renewal fails)
  - Notify user of failed renewal
  - Explain reason (if available)
  - Link to update payment method
  - Show grace period information
  - File: `backend/src/services/email.service.ts`

- [ ] **Subscription Upgrade Confirmation**
  - Confirm tier upgrade
  - Show new tier features
  - Show prorated amount (if applicable)
  - Show new period dates
  - File: `backend/src/services/email.service.ts`

- [ ] **Subscription Downgrade Confirmation**
  - Confirm tier downgrade
  - Show when downgrade takes effect
  - Show features that will be lost
  - File: `backend/src/services/email.service.ts`

- [ ] **Subscription Expiration Warning** (3 days before expiration)
  - Warn about upcoming expiration
  - Show expiration date
  - Link to renew subscription
  - File: `backend/src/services/email.service.ts`

- [ ] **Welcome Email** (for new paid subscriptions)
  - Welcome to new tier
  - Highlight key features
  - Getting started guide
  - File: `backend/src/services/email.service.ts`

- [ ] **Subscription Reactivation Confirmation**
  - Confirm reactivation
  - Show new period dates
  - File: `backend/src/services/email.service.ts`

---

#### 1.5.3 Email Service Enhancements
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **Email Template System**
  - Create reusable email templates
  - Support for HTML and plain text
  - Template variables system
  - File: `backend/src/services/email-templates.service.ts` (new)

- [ ] **Email Queue System** (optional, for reliability)
  - Queue emails for retry on failure
  - Store email logs
  - Track email delivery status
  - File: `backend/src/services/email-queue.service.ts` (new)

- [ ] **Email Preferences**
  - Allow users to manage email preferences
  - Opt-out for non-critical emails
  - File: `backend/src/database/migrations/013_add_email_preferences.sql` (new)

- [ ] **Email Testing**
  - Test all email templates
  - Verify email delivery
  - Test email formatting
  - File: `backend/src/__tests__/email.service.test.ts`

---

#### 1.5.4 Automated Email Scheduling
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 2 days

- [ ] **Payment Reminder Scheduler**
  - Schedule payment reminders (7 days before)
  - Run daily cron job
  - File: `backend/src/services/payment-reminder.service.ts` (new)

- [ ] **Renewal Reminder Scheduler**
  - Schedule renewal reminders (3, 7, 14 days before)
  - Run daily cron job
  - File: `backend/src/services/renewal-reminder.service.ts` (new)

- [ ] **Expiration Warning Scheduler**
  - Schedule expiration warnings (3 days before)
  - Run daily cron job
  - File: `backend/src/services/expiration-warning.service.ts` (new)

- [ ] **Cron Job Setup**
  - Set up scheduled jobs (Railway Cron or GitHub Actions)
  - Configure daily execution
  - File: `backend/src/cron/email-scheduler.ts` (new)

---

#### 1.5.5 Email Integration Points

**Payment Routes:**
- [ ] Send payment success email after payment completion
- [ ] Send payment failure email on failure
- [ ] Send payment cancellation email on cancellation
- [ ] Send payment retry email on retry
- [ ] Send invoice email after payment
- [ ] File: `backend/src/routes/payment.routes.ts`

**Subscription Routes:**
- [ ] Send welcome email on subscription creation
- [ ] Send upgrade confirmation on upgrade
- [ ] Send downgrade confirmation on downgrade
- [ ] Send cancellation email on cancellation
- [ ] Send reactivation email on reactivation
- [ ] File: `backend/src/routes/subscription.routes.ts`

**Subscription Service:**
- [ ] Send renewal confirmation on successful renewal
- [ ] Send failed renewal notification on failure
- [ ] Send expiration warning before expiration
- [ ] File: `backend/src/services/subscription.service.ts`

**Payment Retry Service:**
- [ ] Send retry notification on retry attempt
- [ ] Send final failure notification after all retries
- [ ] File: `backend/src/services/payment-retry.service.ts`

---

#### 1.5.6 Email Template Examples

**Payment Reminder Email:**
```html
Subject: Your QueryAI Subscription Renews in 7 Days

Hello {{userName}},

Your {{tier}} subscription will renew automatically on {{renewalDate}}.

Amount: {{amount}} {{currency}}
Payment Method: {{paymentMethod}}

Please ensure your payment method is up to date to avoid any interruption.

[Update Payment Method Button]
```

**Failed Renewal Email:**
```html
Subject: Payment Failed - Action Required

Hello {{userName}},

We were unable to process your subscription renewal payment.

Reason: {{failureReason}}
Amount: {{amount}} {{currency}}

Your subscription is now in a grace period. You have {{daysRemaining}} days to update your payment method.

[Update Payment Method Button]
```

**Subscription Upgrade Email:**
```html
Subject: Subscription Upgraded to {{newTier}}

Hello {{userName}},

Your subscription has been upgraded to {{newTier}}!

New Features:
- {{feature1}}
- {{feature2}}
- {{feature3}}

Amount Charged: {{amount}} {{currency}}
New Period: {{startDate}} to {{endDate}}

[View Subscription Dashboard]
```

---

## Phase 2: PayPal Integration (Weeks 3-6)

**Priority:** 🔴 High  
**Goal:** Replace Pesapal with PayPal for better global support and Visa card processing  
**Duration:** 4 weeks

### Week 3: PayPal Backend Setup

#### 3.1 PayPal Account Setup
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **PayPal Business Account**
  - [ ] Create PayPal Business account
  - [ ] Complete business verification
  - [ ] Link bank account
  - [ ] Complete identity verification

- [ ] **PayPal Developer Account**
  - [ ] Create PayPal Developer account
  - [ ] Create application
  - [ ] Generate API credentials (Client ID, Secret)
  - [ ] Configure sandbox environment
  - [ ] Get sandbox test credentials

- [ ] **Webhook Configuration**
  - [ ] Register webhook URL in PayPal dashboard
  - [ ] Configure webhook events:
    - Payment completed
    - Subscription created
    - Subscription updated
    - Subscription cancelled
    - Refund processed
  - [ ] Get webhook ID

- [ ] **Environment Variables**
  - [ ] Add PayPal credentials to environment
  - [ ] Configure sandbox/production mode
  - [ ] File: `.env` and Railway environment

**Environment Variables:**
```bash
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_MODE=sandbox  # or 'live'
PAYPAL_WEBHOOK_ID=your_webhook_id
```

**Acceptance Criteria:**
- PayPal account fully verified
- API credentials obtained
- Webhook configured
- Environment variables set

---

#### 3.2 PayPal Service Implementation
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Install Dependencies**
  - [ ] Install PayPal SDK: `@paypal/checkout-server-sdk`
  - [ ] Update package.json
  - [ ] File: `backend/package.json`

- [ ] **Create PayPal Service**
  - [ ] Create `PayPalService` class
  - [ ] Implement PayPal client initialization
  - [ ] Implement authentication method
  - [ ] File: `backend/src/services/paypal.service.ts` (new)

- [ ] **Implement Payment Methods**
  - [ ] `createPayment()` - One-time payment
  - [ ] `executePayment()` - Execute payment
  - [ ] `getPaymentDetails()` - Get payment status
  - [ ] `refundPayment()` - Process refund
  - [ ] File: `backend/src/services/paypal.service.ts`

- [ ] **Implement Subscription Methods**
  - [ ] `createSubscription()` - Create subscription
  - [ ] `getSubscription()` - Get subscription details
  - [ ] `cancelSubscription()` - Cancel subscription
  - [ ] `updateSubscription()` - Update subscription
  - [ ] File: `backend/src/services/paypal.service.ts`

- [ ] **Implement Webhook Handler**
  - [ ] `verifyWebhookSignature()` - Verify webhook authenticity
  - [ ] `processWebhook()` - Process webhook events
  - [ ] Handle all webhook event types
  - [ ] File: `backend/src/services/paypal.service.ts`

- [ ] **Error Handling**
  - [ ] Handle PayPal API errors
  - [ ] Implement retry logic
  - [ ] Add comprehensive logging
  - [ ] File: `backend/src/services/paypal.service.ts`

- [ ] **Testing**
  - [ ] Test payment creation
  - [ ] Test payment execution
  - [ ] Test subscription creation
  - [ ] Test webhook processing
  - [ ] Test error scenarios

**Acceptance Criteria:**
- PayPal service fully implemented
- All payment methods working
- All subscription methods working
- Webhook handling functional
- Error handling robust

---

#### 3.3 Database Schema Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **Create Migration**
  - [ ] Create migration file: `009_add_paypal_support.sql`
  - [ ] Add PayPal fields to payments table
  - [ ] Add PayPal subscription ID to subscriptions table
  - [ ] Add payment provider field
  - [ ] File: `backend/src/database/migrations/009_add_paypal_support.sql` (new)

- [ ] **Update Type Definitions**
  - [ ] Add PayPal fields to Payment type
  - [ ] Add PayPal fields to Subscription type
  - [ ] Add payment provider enum
  - [ ] File: `backend/src/types/database.ts`

- [ ] **Run Migration**
  - [ ] Test migration in development
  - [ ] Run migration in production
  - [ ] Verify data integrity

**SQL Migration:**
```sql
-- Add PayPal support to payments table
ALTER TABLE payments 
  ADD COLUMN paypal_payment_id TEXT,
  ADD COLUMN paypal_subscription_id TEXT,
  ADD COLUMN payment_provider TEXT DEFAULT 'pesapal' 
    CHECK (payment_provider IN ('pesapal', 'paypal'));

-- Add PayPal subscription ID to subscriptions
ALTER TABLE subscriptions 
  ADD COLUMN paypal_subscription_id TEXT;

-- Create indexes
CREATE INDEX idx_payments_paypal_payment_id ON payments(paypal_payment_id);
CREATE INDEX idx_payments_payment_provider ON payments(payment_provider);
```

**Acceptance Criteria:**
- Migration runs successfully
- All fields added correctly
- Types updated
- Indexes created

---

### Week 4: PayPal Backend Integration

#### 4.1 Payment Routes Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Update Payment Initiation**
  - [ ] Add payment provider selection
  - [ ] Add PayPal payment initiation
  - [ ] Support both Pesapal and PayPal
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Payment Callback**
  - [ ] Add PayPal callback handler
  - [ ] Handle PayPal redirects
  - [ ] Update subscription on payment success
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Webhook Handler**
  - [ ] Add PayPal webhook endpoint
  - [ ] Verify webhook signature
  - [ ] Process PayPal webhook events
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Payment Status**
  - [ ] Add PayPal payment status checking
  - [ ] Update payment record
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Refund Processing**
  - [ ] Add PayPal refund processing
  - [ ] Support both providers
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Testing**
  - [ ] Test PayPal payment flow
  - [ ] Test callback handling
  - [ ] Test webhook processing
  - [ ] Test refund processing

**Acceptance Criteria:**
- PayPal payments work end-to-end
- Callbacks handled correctly
- Webhooks processed correctly
- Both providers supported

---

#### 4.2 Subscription Integration
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Update Subscription Service**
  - [ ] Add PayPal subscription creation
  - [ ] Add PayPal subscription cancellation
  - [ ] Add PayPal subscription update
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Update Subscription Routes**
  - [ ] Add PayPal subscription endpoints
  - [ ] Handle PayPal subscription events
  - [ ] File: `backend/src/routes/subscription.routes.ts`

- [ ] **Update Renewal Logic**
  - [ ] Handle PayPal subscription renewals
  - [ ] Process PayPal renewal webhooks
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Testing**
  - [ ] Test subscription creation
  - [ ] Test subscription renewal
  - [ ] Test subscription cancellation
  - [ ] Test webhook events

**Acceptance Criteria:**
- PayPal subscriptions work
- Renewals processed automatically
- Cancellations handled correctly

---

### Week 5: PayPal Frontend Integration

#### 5.1 PayPal SDK Setup
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **Install Dependencies**
  - [ ] Install PayPal React SDK: `@paypal/react-paypal-js`
  - [ ] Update package.json
  - [ ] File: `frontend/package.json`

- [ ] **Configure PayPal Provider**
  - [ ] Add PayPal script to app
  - [ ] Configure PayPal provider
  - [ ] Set up client ID
  - [ ] File: `frontend/app/layout.tsx` or similar

- [ ] **Create PayPal Button Component**
  - [ ] Create reusable PayPal button
  - [ ] Handle payment approval
  - [ ] Handle payment errors
  - [ ] File: `frontend/components/payment/paypal-button.tsx` (new)

- [ ] **Testing**
  - [ ] Test PayPal button renders
  - [ ] Test payment flow
  - [ ] Test error handling

**Acceptance Criteria:**
- PayPal SDK integrated
- PayPal button works
- Payment flow functional

---

#### 5.2 Payment Dialog Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Update Payment Dialog**
  - [ ] Add payment provider selection
  - [ ] Add PayPal checkout option
  - [ ] Show PayPal button
  - [ ] Handle PayPal payment flow
  - [ ] File: `frontend/components/payment/payment-dialog.tsx`

- [ ] **Update Payment Flow**
  - [ ] Handle PayPal payment approval
  - [ ] Handle PayPal payment cancellation
  - [ ] Update UI based on provider
  - [ ] File: `frontend/components/payment/payment-dialog.tsx`

- [ ] **Update API Client**
  - [ ] Add PayPal payment methods
  - [ ] Update payment API calls
  - [ ] File: `frontend/lib/api.ts`

- [ ] **UI/UX Improvements**
  - [ ] Improve payment provider selection
  - [ ] Add provider logos
  - [ ] Improve payment flow clarity
  - [ ] File: `frontend/components/payment/payment-dialog.tsx`

- [ ] **Testing**
  - [ ] Test PayPal payment flow
  - [ ] Test Pesapal payment flow
  - [ ] Test provider switching
  - [ ] Test error handling

**Acceptance Criteria:**
- Both payment providers work
- UI is clear and intuitive
- Payment flow is smooth
- Error handling works

---

#### 5.3 Subscription Manager Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Update Subscription Manager**
  - [ ] Show payment method/provider
  - [ ] Add PayPal subscription management
  - [ ] Update billing history
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

- [ ] **Update Billing History**
  - [ ] Show payment provider
  - [ ] Display PayPal transactions
  - [ ] Update invoice download
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

- [ ] **Update Payment Method Management**
  - [ ] Show current payment method
  - [ ] Allow payment method updates
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

- [ ] **Testing**
  - [ ] Test subscription display
  - [ ] Test billing history
  - [ ] Test payment method updates

**Acceptance Criteria:**
- Payment provider displayed
- Billing history accurate
- Payment method management works

---

### Week 6: Testing & Migration

#### 6.1 End-to-End Testing
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Payment Testing**
  - [ ] Test one-time PayPal payment
  - [ ] Test PayPal subscription creation
  - [ ] Test PayPal subscription renewal
  - [ ] Test PayPal payment cancellation
  - [ ] Test PayPal refund processing
  - [ ] Test webhook handling
  - [ ] Test error scenarios

- [ ] **Integration Testing**
  - [ ] Test complete payment flow
  - [ ] Test subscription lifecycle
  - [ ] Test both providers side-by-side
  - [ ] Test migration scenarios

- [ ] **Performance Testing**
  - [ ] Test payment processing speed
  - [ ] Test webhook processing speed
  - [ ] Test concurrent payments

- [ ] **Security Testing**
  - [ ] Test webhook signature verification
  - [ ] Test payment data security
  - [ ] Test authentication/authorization

**Acceptance Criteria:**
- All tests passing
- Performance acceptable
- Security verified

---

#### 6.2 Migration Planning
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 1 day

- [ ] **Identify Existing Users**
  - [ ] Query database for Pesapal users
  - [ ] Categorize by subscription status
  - [ ] Create migration list

- [ ] **Create Migration Script**
  - [ ] Script to migrate Pesapal subscriptions
  - [ ] Handle edge cases
  - [ ] Test migration script
  - [ ] File: `backend/scripts/migrate-to-paypal.ts` (new)

- [ ] **User Communication**
  - [ ] Draft migration email
  - [ ] Create migration notification
  - [ ] Plan communication timeline

- [ ] **Testing**
  - [ ] Test migration script
  - [ ] Test rollback if needed
  - [ ] Verify data integrity

**Acceptance Criteria:**
- Migration script ready
- User communication prepared
- Rollback plan in place

---

#### 6.3 Documentation
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 1 day

- [ ] **API Documentation**
  - [ ] Update API docs with PayPal endpoints
  - [ ] Document webhook events
  - [ ] Document error codes

- [ ] **Setup Guides**
  - [ ] Create PayPal setup guide
  - [ ] Update payment integration guide
  - [ ] Create troubleshooting guide

- [ ] **Code Documentation**
  - [ ] Add code comments
  - [ ] Update README files
  - [ ] Document configuration

**Acceptance Criteria:**
- Documentation complete
- Guides are clear
- Code is well-documented

---

## Phase 3: Enhanced Features (Weeks 7-10)

**Priority:** 🟡 Medium  
**Goal:** Add annual billing, usage-based pricing, and enterprise tier  
**Duration:** 4 weeks

### Week 7: Annual Billing

#### 7.1 Database Updates
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 1 day

- [ ] **Create Migration**
  - [ ] Add billing period field
  - [ ] Add annual discount field
  - [ ] File: `backend/src/database/migrations/010_add_annual_billing.sql` (new)

- [ ] **Update Types**
  - [ ] Add billing period type
  - [ ] Update subscription types
  - [ ] File: `backend/src/types/database.ts`

**SQL:**
```sql
ALTER TABLE subscriptions 
  ADD COLUMN billing_period TEXT DEFAULT 'monthly' 
    CHECK (billing_period IN ('monthly', 'annual')),
  ADD COLUMN annual_discount DECIMAL(5,2) DEFAULT 0;
```

---

#### 7.2 Backend Implementation
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 2 days

- [ ] **Update Subscription Service**
  - [ ] Add annual pricing calculation
  - [ ] Implement prorating for annual plans
  - [ ] Update subscription creation
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Update Payment Routes**
  - [ ] Add annual billing option
  - [ ] Calculate annual pricing
  - [ ] Handle annual payments
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Pricing Constants**
  - [ ] Add annual pricing
  - [ ] Calculate discounts
  - [ ] File: `backend/src/constants/pricing.ts`

---

#### 7.3 Frontend Implementation
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 2 days

- [ ] **Update Payment Dialog**
  - [ ] Add billing period selector
  - [ ] Show annual discount
  - [ ] Update pricing display
  - [ ] File: `frontend/components/payment/payment-dialog.tsx`

- [ ] **Update Subscription Manager**
  - [ ] Show billing period
  - [ ] Display annual savings
  - [ ] Allow billing period change
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

---

### Week 8: Usage-Based Pricing

#### 8.1 Overage Tracking
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 2 days

- [ ] **Database Updates**
  - [ ] Add overage tracking fields
  - [ ] Create overage records table
  - [ ] File: `backend/src/database/migrations/011_add_overage_tracking.sql` (new)

- [ ] **Backend Service**
  - [ ] Create overage calculation service
  - [ ] Track usage beyond limits
  - [ ] Calculate overage charges
  - [ ] File: `backend/src/services/overage.service.ts` (new)

---

#### 8.2 Overage Billing
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 2 days

- [ ] **Billing Logic**
  - [ ] Implement overage billing
  - [ ] Add overage to invoice
  - [ ] Process overage payments
  - [ ] File: `backend/src/services/billing.service.ts`

- [ ] **Notifications**
  - [ ] Send overage warnings
  - [ ] Notify about overage charges
  - [ ] File: `backend/src/services/email.service.ts`

---

#### 8.3 Frontend Updates
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 1 day

- [ ] **Usage Display**
  - [ ] Show overage usage
  - [ ] Display overage charges
  - [ ] Add overage warnings
  - [ ] File: `frontend/components/usage/usage-display.tsx`

---

### Week 9-10: Enterprise Tier

#### 9.1 Enterprise Features
**Status:** 🔴 Not Started  
**Priority:** 🟢 Low  
**Estimated Effort:** 3 days

- [ ] **Database Updates**
  - [ ] Add enterprise tier
  - [ ] Add team collaboration tables
  - [ ] File: `backend/src/database/migrations/012_add_enterprise_tier.sql` (new)

- [ ] **Backend Implementation**
  - [ ] Add enterprise tier limits
  - [ ] Implement team management
  - [ ] Add enterprise features
  - [ ] File: `backend/src/services/enterprise.service.ts` (new)

---

#### 9.2 Enterprise Billing
**Status:** 🔴 Not Started  
**Priority:** 🟢 Low  
**Estimated Effort:** 2 days

- [ ] **Billing Implementation**
  - [ ] Add enterprise pricing
  - [ ] Implement enterprise billing
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Frontend**
  - [ ] Add enterprise tier UI
  - [ ] Create enterprise signup
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

---

## Phase 4: Optimization (Weeks 11-12)

**Priority:** 🟢 Low  
**Goal:** Optimize costs, improve performance, add monitoring  
**Duration:** 2 weeks

### Week 11: Cost Optimization

#### 11.1 Advanced Caching
**Status:** 🔴 Not Started  
**Priority:** 🟢 Low  
**Estimated Effort:** 2 days

- [ ] **Redis Optimization**
  - [ ] Implement advanced caching strategies
  - [ ] Add cache warming
  - [ ] Optimize cache keys
  - [ ] File: `backend/src/services/cache.service.ts`

- [ ] **Query Optimization**
  - [ ] Implement query deduplication
  - [ ] Add query batching
  - [ ] Optimize API calls
  - [ ] File: `backend/src/services/query.service.ts`

---

#### 11.2 Alternative Providers
**Status:** 🔴 Not Started  
**Priority:** 🟢 Low  
**Estimated Effort:** 3 days

- [ ] **Research**
  - [ ] Research alternative search providers
  - [ ] Compare costs and features
  - [ ] Select best alternatives

- [ ] **Implementation**
  - [ ] Create provider abstraction
  - [ ] Implement provider switching
  - [ ] Add provider selection logic
  - [ ] File: `backend/src/services/search-provider.service.ts` (new)

---

### Week 12: Monitoring & Analytics

#### 12.1 Cost Dashboard
**Status:** 🔴 Not Started  
**Priority:** 🟢 Low  
**Estimated Effort:** 2 days

- [ ] **Backend**
  - [ ] Create cost tracking service
  - [ ] Implement cost analytics
  - [ ] Add cost APIs
  - [ ] File: `backend/src/services/cost-analytics.service.ts` (new)

- [ ] **Frontend**
  - [ ] Create cost dashboard
  - [ ] Add cost charts
  - [ ] Display cost metrics
  - [ ] File: `frontend/components/analytics/cost-dashboard.tsx` (new)

---

#### 12.2 Alerts & Monitoring
**Status:** 🔴 Not Started  
**Priority:** 🟢 Low  
**Estimated Effort:** 2 days

- [ ] **Alerts**
  - [ ] Implement cost alerts
  - [ ] Add profitability monitoring
  - [ ] Create alert system
  - [ ] File: `backend/src/services/alert.service.ts` (new)

- [ ] **Monitoring**
  - [ ] Add usage analytics
  - [ ] Create performance metrics
  - [ ] File: `backend/src/services/monitoring.service.ts`

---

## Testing Strategy

### Unit Tests
- [ ] Subscription service tests
- [ ] Payment service tests
- [ ] PayPal service tests
- [ ] Cost tracking tests
- [ ] Cache service tests

### Integration Tests
- [ ] Payment flow tests
- [ ] Subscription lifecycle tests
- [ ] Webhook processing tests
- [ ] Cost calculation tests

### End-to-End Tests
- [ ] Complete payment flow
- [ ] Subscription management
- [ ] Cost tracking accuracy
- [ ] Performance tests

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Environment variables configured
- [ ] Database migrations ready

### Deployment
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Run database migrations
- [ ] Verify integrations
- [ ] Monitor for errors

### Post-Deployment
- [ ] Monitor metrics
- [ ] Check payment processing
- [ ] Verify subscriptions
- [ ] Collect user feedback
- [ ] Address issues

---

## Success Metrics

### Phase 1 Success Criteria
- ✅ Tavily limits enforced
- ✅ Cache hit rate > 60%
- ✅ All paid tiers profitable (>50% margin)
- ✅ Cost per user < 50% of revenue

### Phase 2 Success Criteria
- ✅ PayPal payments working
- ✅ PayPal subscriptions working
- ✅ Webhooks processing correctly
- ✅ Migration completed successfully

### Phase 3 Success Criteria
- ✅ Annual billing available
- ✅ Overage pricing implemented
- ✅ Enterprise tier launched

### Phase 4 Success Criteria
- ✅ Cache hit rate > 60%
- ✅ Cost per query < $0.05
- ✅ Cost dashboard operational
- ✅ Alerts working correctly

---

## Risk Management

### High Risks
1. **Tavily Cost Overrun**
   - Mitigation: Implement limits immediately
   - Status: 🔴 Not Started

2. **PayPal Integration Issues**
   - Mitigation: Parallel support, thorough testing
   - Status: 🔴 Not Started

3. **User Churn from Price Changes**
   - Mitigation: Grandfather existing users
   - Status: 🔴 Not Started

### Medium Risks
1. **Migration Complexity**
   - Mitigation: Phased approach
   - Status: 🔴 Not Started

2. **Cost Tracking Accuracy**
   - Mitigation: Robust monitoring
   - Status: 🔴 Not Started

---

## Notes & Updates

### Change Log
- **2026-01-28:** Document created, all phases planned

### Blockers
- None currently

### Dependencies
- Phase 2 depends on Phase 1 completion
- Phase 3 depends on Phase 2 completion
- Phase 4 can run in parallel with Phase 3

---

**Document Owner:** Development Team  
**Review Frequency:** Weekly during implementation  
**Last Review:** January 28, 2026
