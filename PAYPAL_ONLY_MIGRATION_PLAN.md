# PayPal-Only Payment Migration Plan

## Executive Summary

This document outlines the complete migration from Pesapal to PayPal-only payment processing. PayPal supports both direct PayPal payments and Visa card processing, making it the ideal single payment provider for global reach.

**Decision:** Remove Pesapal completely, use only PayPal  
**Rationale:** PayPal supports 200+ countries, Visa cards, and provides better global coverage  
**Timeline:** 4-6 weeks  
**Status:** 🔴 Planning Phase

---

## Current State Analysis

### Pesapal Integration Points

**Backend Services:**
1. `backend/src/services/pesapal.service.ts` - Main Pesapal service
2. `backend/src/routes/payment.routes.ts` - Payment routes (uses Pesapal)
3. `backend/src/services/payment-retry.service.ts` - References Pesapal
4. `backend/src/services/email.service.ts` - Email notifications mention Pesapal

**Database:**
1. `payments` table - Has `pesapal_order_tracking_id`, `pesapal_merchant_reference`
2. `subscriptions` table - May have Pesapal references
3. Migration files reference Pesapal

**Configuration:**
1. `backend/src/config/env.ts` - Has `PESAPAL_*` environment variables
2. Environment variables in Railway/production

**Frontend:**
1. `frontend/components/payment/payment-dialog.tsx` - May reference Pesapal
2. Payment UI components

**Documentation:**
1. Multiple docs reference Pesapal
2. Setup guides mention Pesapal

---

## Migration Strategy

### Phase 1: PayPal Implementation (Weeks 1-3)
**Goal:** Implement complete PayPal integration before removing Pesapal

### Phase 2: User Migration (Week 4)
**Goal:** Migrate existing Pesapal users to PayPal

### Phase 3: Pesapal Removal (Week 5-6)
**Goal:** Remove all Pesapal code and references

---

## Phase 1: PayPal Implementation (Weeks 1-3)

### Week 1: PayPal Backend Setup

#### 1.1 PayPal Account & Configuration
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 1 day

- [ ] **PayPal Business Account Setup**
  - [ ] Create PayPal Business account
  - [ ] Complete business verification
  - [ ] Link bank account
  - [ ] Complete identity verification
  - [ ] Enable subscription billing

- [ ] **PayPal Developer Account**
  - [ ] Create PayPal Developer account
  - [ ] Create application
  - [ ] Generate API credentials:
    - Client ID
    - Secret
  - [ ] Configure sandbox environment
  - [ ] Get sandbox test credentials

- [ ] **Webhook Configuration**
  - [ ] Register webhook URL: `https://your-backend.railway.app/api/payment/paypal-webhook`
  - [ ] Configure webhook events:
    - `PAYMENT.SALE.COMPLETED`
    - `BILLING.SUBSCRIPTION.CREATED`
    - `BILLING.SUBSCRIPTION.UPDATED`
    - `BILLING.SUBSCRIPTION.CANCELLED`
    - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
    - `PAYMENT.CAPTURE.REFUNDED`
  - [ ] Get webhook ID

- [ ] **Environment Variables**
  - [ ] Add to Railway environment:
    ```bash
    PAYPAL_CLIENT_ID=your_paypal_client_id
    PAYPAL_CLIENT_SECRET=your_paypal_client_secret
    PAYPAL_MODE=sandbox  # or 'live' for production
    PAYPAL_WEBHOOK_ID=your_webhook_id
    ```
  - [ ] Update `backend/src/config/env.ts`

**Acceptance Criteria:**
- PayPal account fully verified
- API credentials obtained
- Webhook configured and tested
- Environment variables set

---

#### 1.2 PayPal Service Implementation
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 3 days

- [ ] **Install Dependencies**
  - [ ] Install PayPal SDK: `@paypal/checkout-server-sdk`
  - [ ] Update `backend/package.json`
  ```bash
  npm install @paypal/checkout-server-sdk
  ```

- [ ] **Create PayPal Service**
  - [ ] Create `backend/src/services/paypal.service.ts`
  - [ ] Implement PayPal client initialization
  - [ ] Implement authentication method
  - [ ] Implement error handling

- [ ] **One-Time Payment Methods**
  - [ ] `createPayment()` - Create PayPal payment
  - [ ] `executePayment()` - Execute payment after user approval
  - [ ] `getPaymentDetails()` - Get payment status
  - [ ] `refundPayment()` - Process refunds

- [ ] **Subscription Methods**
  - [ ] `createSubscription()` - Create subscription plan
  - [ ] `getSubscription()` - Get subscription details
  - [ ] `cancelSubscription()` - Cancel subscription
  - [ ] `updateSubscription()` - Update subscription
  - [ ] `activateSubscription()` - Activate subscription

- [ ] **Webhook Handler**
  - [ ] `verifyWebhookSignature()` - Verify webhook authenticity
  - [ ] `processWebhook()` - Process webhook events
  - [ ] Handle all webhook event types

**File Structure:**
```
backend/src/services/paypal.service.ts
```

**Key Features:**
- Support for PayPal account payments
- Support for Visa card payments (via PayPal)
- Support for recurring subscriptions
- Webhook signature verification
- Comprehensive error handling

**Acceptance Criteria:**
- All payment methods implemented
- All subscription methods implemented
- Webhook handling functional
- Error handling robust
- Unit tests passing

---

#### 1.3 Database Schema Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 1 day

- [ ] **Create Migration**
  - [ ] Create `backend/src/database/migrations/014_add_paypal_support.sql`
  - [ ] Add PayPal fields to payments table
  - [ ] Add PayPal subscription ID to subscriptions table
  - [ ] Update payment provider enum

**SQL Migration:**
```sql
-- Add PayPal support to payments table
ALTER TABLE payments 
  ADD COLUMN paypal_payment_id TEXT,
  ADD COLUMN paypal_order_id TEXT,
  ADD COLUMN paypal_subscription_id TEXT,
  ADD COLUMN payment_provider TEXT DEFAULT 'paypal' 
    CHECK (payment_provider IN ('paypal'));

-- Update existing payments to use PayPal (if migrating)
-- UPDATE payments SET payment_provider = 'paypal' WHERE payment_provider = 'pesapal';

-- Add PayPal subscription ID to subscriptions
ALTER TABLE subscriptions 
  ADD COLUMN paypal_subscription_id TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_paypal_payment_id ON payments(paypal_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON payments(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_provider ON payments(payment_provider);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal_subscription_id ON subscriptions(paypal_subscription_id);

-- Remove Pesapal-specific columns (after migration)
-- ALTER TABLE payments DROP COLUMN pesapal_order_tracking_id;
-- ALTER TABLE payments DROP COLUMN pesapal_merchant_reference;
```

- [ ] **Update Type Definitions**
  - [ ] Add PayPal fields to Payment type
  - [ ] Add PayPal fields to Subscription type
  - [ ] Remove Pesapal types
  - [ ] File: `backend/src/types/database.ts`

**Acceptance Criteria:**
- Migration runs successfully
- All PayPal fields added
- Types updated
- Indexes created
- No Pesapal references in schema

---

### Week 2: Payment Routes & Integration

#### 2.1 Payment Routes Implementation
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 2 days

- [ ] **Update Payment Initiation**
  - [ ] Replace Pesapal with PayPal in payment initiation
  - [ ] Support PayPal account payments
  - [ ] Support Visa card payments (via PayPal)
  - [ ] File: `backend/src/routes/payment.routes.ts`

**New Payment Flow:**
```typescript
// POST /api/payment/initiate
// 1. Create PayPal payment
// 2. Return approval URL
// 3. User approves on PayPal
// 4. Execute payment
// 5. Update subscription
```

- [ ] **Update Payment Callback**
  - [ ] Replace Pesapal callback with PayPal callback
  - [ ] Handle PayPal redirects
  - [ ] Execute payment after approval
  - [ ] Update subscription on success
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Webhook Handler**
  - [ ] Replace Pesapal webhook with PayPal webhook
  - [ ] Verify webhook signature
  - [ ] Process PayPal webhook events
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Payment Status**
  - [ ] Replace Pesapal status check with PayPal
  - [ ] Update payment record
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Update Refund Processing**
  - [ ] Replace Pesapal refund with PayPal refund
  - [ ] Process refunds via PayPal API
  - [ ] File: `backend/src/routes/payment.routes.ts`

**Acceptance Criteria:**
- All payment routes use PayPal
- Callbacks work correctly
- Webhooks processed correctly
- Refunds work correctly
- No Pesapal references in routes

---

#### 2.2 Subscription Service Integration
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 2 days

- [ ] **Update Subscription Creation**
  - [ ] Create PayPal subscription on tier upgrade
  - [ ] Link PayPal subscription to database
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Update Subscription Renewal**
  - [ ] Handle PayPal subscription renewals
  - [ ] Process PayPal renewal webhooks
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Update Subscription Cancellation**
  - [ ] Cancel PayPal subscription
  - [ ] Handle cancellation webhooks
  - [ ] File: `backend/src/services/subscription.service.ts`

- [ ] **Update Payment Retry Service**
  - [ ] Remove Pesapal references
  - [ ] Use PayPal for retries
  - [ ] File: `backend/src/services/payment-retry.service.ts`

**Acceptance Criteria:**
- Subscriptions created via PayPal
- Renewals processed via PayPal
- Cancellations handled via PayPal
- No Pesapal references

---

### Week 3: Frontend Integration

#### 3.1 PayPal SDK Setup
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 1 day

- [ ] **Install Dependencies**
  - [ ] Install PayPal React SDK: `@paypal/react-paypal-js`
  - [ ] Update `frontend/package.json`
  ```bash
  npm install @paypal/react-paypal-js
  ```

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

**Acceptance Criteria:**
- PayPal SDK integrated
- PayPal button works
- Payment flow functional

---

#### 3.2 Payment Dialog Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 Critical  
**Estimated Effort:** 2 days

- [ ] **Remove Pesapal References**
  - [ ] Remove Pesapal from payment dialog
  - [ ] Remove payment provider selection
  - [ ] File: `frontend/components/payment/payment-dialog.tsx`

- [ ] **Update Payment Flow**
  - [ ] Use PayPal checkout only
  - [ ] Show PayPal button
  - [ ] Handle PayPal payment approval
  - [ ] Handle PayPal payment cancellation
  - [ ] File: `frontend/components/payment/payment-dialog.tsx`

- [ ] **Update API Client**
  - [ ] Remove Pesapal API methods
  - [ ] Update payment API calls for PayPal
  - [ ] File: `frontend/lib/api.ts`

- [ ] **UI/UX Improvements**
  - [ ] Update payment UI for PayPal
  - [ ] Show PayPal and Visa card options
  - [ ] Improve payment flow clarity
  - [ ] File: `frontend/components/payment/payment-dialog.tsx`

**Acceptance Criteria:**
- Only PayPal payment option
- Payment flow works smoothly
- UI is clear and intuitive
- No Pesapal references

---

#### 3.3 Subscription Manager Updates
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **Update Subscription Manager**
  - [ ] Remove Pesapal references
  - [ ] Show PayPal as payment method
  - [ ] Update billing history
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

- [ ] **Update Billing History**
  - [ ] Show PayPal transactions
  - [ ] Update invoice download
  - [ ] File: `frontend/components/subscription/subscription-manager.tsx`

**Acceptance Criteria:**
- PayPal displayed as payment method
- Billing history accurate
- No Pesapal references

---

## Phase 2: User Migration (Week 4)

### 4.1 Identify Existing Pesapal Users
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **Query Database**
  - [ ] Find all users with Pesapal payments
  - [ ] Categorize by subscription status:
    - Active subscriptions
    - Pending payments
    - Cancelled subscriptions
  - [ ] Create migration list

- [ ] **Create Migration Script**
  - [ ] Script to identify Pesapal users
  - [ ] Export user list
  - [ ] File: `backend/scripts/identify-pesapal-users.ts` (new)

**Acceptance Criteria:**
- All Pesapal users identified
- Migration list created
- User data categorized

---

### 4.2 User Communication
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 1 day

- [ ] **Draft Migration Email**
  - [ ] Explain migration to PayPal
  - [ ] Benefits of PayPal
  - [ ] Action required (if any)
  - [ ] Timeline

**Email Template:**
```html
Subject: Important: Payment System Update - Action Required

Hello {{userName}},

We're upgrading our payment system to provide you with better service and more payment options.

What's Changing:
- We're moving from Pesapal to PayPal
- PayPal supports direct PayPal payments AND Visa cards
- Better global coverage and security

What You Need to Do:
{{#if hasActiveSubscription}}
Your current subscription will continue until {{renewalDate}}.
Please update your payment method to PayPal before then:
[Update Payment Method Button]
{{else}}
No action needed right now. When you're ready to subscribe, you'll use PayPal.
{{/if}}

Benefits:
✅ Support for Visa cards
✅ More secure payments
✅ Better global coverage
✅ Faster payment processing

Questions? Contact us at support@queryai.com

Best regards,
The QueryAI Team
```

- [ ] **Send Migration Emails**
  - [ ] Send to all Pesapal users
  - [ ] Track email delivery
  - [ ] File: `backend/scripts/send-migration-emails.ts` (new)

**Acceptance Criteria:**
- Migration emails sent
- Email delivery tracked
- Users informed

---

### 4.3 Migration Process
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Create Migration Script**
  - [ ] Script to migrate Pesapal subscriptions to PayPal
  - [ ] Handle edge cases
  - [ ] Test migration script
  - [ ] File: `backend/scripts/migrate-pesapal-to-paypal.ts` (new)

**Migration Logic:**
```typescript
// For each Pesapal user:
// 1. Check subscription status
// 2. If active, create PayPal subscription
// 3. Link PayPal subscription to user
// 4. Update payment records
// 5. Send confirmation email
```

- [ ] **Test Migration**
  - [ ] Test on sandbox environment
  - [ ] Test with test users
  - [ ] Verify data integrity

- [ ] **Execute Migration**
  - [ ] Run migration script
  - [ ] Monitor for errors
  - [ ] Verify all users migrated

**Acceptance Criteria:**
- All active subscriptions migrated
- Payment records updated
- Users can continue using service
- No data loss

---

## Phase 3: Pesapal Removal (Weeks 5-6)

### 5.1 Code Removal
**Status:** 🔴 Not Started  
**Priority:** 🔴 High  
**Estimated Effort:** 2 days

- [ ] **Remove Pesapal Service**
  - [ ] Delete `backend/src/services/pesapal.service.ts`
  - [ ] Remove all imports
  - [ ] Update references

- [ ] **Remove Pesapal Routes**
  - [ ] Remove Pesapal-specific routes
  - [ ] Update payment routes
  - [ ] File: `backend/src/routes/payment.routes.ts`

- [ ] **Remove Pesapal Configuration**
  - [ ] Remove `PESAPAL_*` environment variables
  - [ ] Update `backend/src/config/env.ts`
  - [ ] Remove from Railway environment

- [ ] **Update Email Service**
  - [ ] Remove Pesapal references from emails
  - [ ] Update email templates
  - [ ] File: `backend/src/services/email.service.ts`

- [ ] **Update Documentation**
  - [ ] Remove Pesapal setup guides
  - [ ] Update payment documentation
  - [ ] Update README files

**Acceptance Criteria:**
- All Pesapal code removed
- No Pesapal references in codebase
- Code compiles without errors
- Tests passing

---

### 5.2 Database Cleanup
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 1 day

- [ ] **Create Migration**
  - [ ] Create `backend/src/database/migrations/015_remove_pesapal.sql`
  - [ ] Remove Pesapal-specific columns
  - [ ] Archive Pesapal data (optional)

**SQL Migration:**
```sql
-- Archive Pesapal data (optional - keep for historical records)
-- CREATE TABLE payments_pesapal_archive AS 
--   SELECT * FROM payments WHERE payment_provider = 'pesapal';

-- Remove Pesapal columns
ALTER TABLE payments 
  DROP COLUMN IF EXISTS pesapal_order_tracking_id,
  DROP COLUMN IF EXISTS pesapal_merchant_reference;

-- Update payment_provider constraint
ALTER TABLE payments 
  DROP CONSTRAINT IF EXISTS payments_payment_provider_check,
  ADD CONSTRAINT payments_payment_provider_check 
    CHECK (payment_provider IN ('paypal'));

-- Remove Pesapal indexes
DROP INDEX IF EXISTS idx_payments_pesapal_order_tracking_id;
DROP INDEX IF EXISTS idx_payments_pesapal_merchant_reference;
```

- [ ] **Run Migration**
  - [ ] Test migration
  - [ ] Run in production
  - [ ] Verify data integrity

**Acceptance Criteria:**
- Pesapal columns removed
- Data integrity maintained
- Migration successful

---

### 5.3 Frontend Cleanup
**Status:** 🔴 Not Started  
**Priority:** 🟡 Medium  
**Estimated Effort:** 1 day

- [ ] **Remove Pesapal References**
  - [ ] Remove Pesapal from UI
  - [ ] Remove payment provider selection
  - [ ] Update all payment components

- [ ] **Update Documentation**
  - [ ] Remove Pesapal from user guides
  - [ ] Update payment instructions
  - [ ] Update FAQ

**Acceptance Criteria:**
- No Pesapal references in frontend
- UI updated for PayPal only
- Documentation updated

---

## Testing Strategy

### Unit Tests
- [ ] PayPal service tests
- [ ] Payment route tests
- [ ] Subscription service tests
- [ ] Webhook handler tests

### Integration Tests
- [ ] PayPal payment flow
- [ ] PayPal subscription flow
- [ ] Webhook processing
- [ ] Refund processing

### End-to-End Tests
- [ ] Complete payment flow
- [ ] Subscription lifecycle
- [ ] Migration process
- [ ] Error scenarios

---

## Rollback Plan

### If Migration Fails
1. **Immediate Rollback**
   - Revert code changes
   - Restore Pesapal service
   - Restore environment variables
   - Notify users

2. **Partial Rollback**
   - Keep PayPal for new users
   - Keep Pesapal for existing users
   - Gradual migration

3. **Data Recovery**
   - Restore from backups
   - Verify data integrity
   - Resume operations

---

## Success Criteria

### Phase 1 Success
- ✅ PayPal fully integrated
- ✅ All payment methods working
- ✅ Subscriptions working
- ✅ Webhooks processing correctly

### Phase 2 Success
- ✅ All users migrated
- ✅ No service interruption
- ✅ Users can make payments
- ✅ Subscriptions continue

### Phase 3 Success
- ✅ All Pesapal code removed
- ✅ No Pesapal references
- ✅ Codebase clean
- ✅ Documentation updated

---

## Timeline Summary

| Week | Phase | Tasks | Status |
|------|-------|-------|--------|
| 1 | PayPal Setup | Account, Service, Database | 🔴 Not Started |
| 2 | Integration | Routes, Subscriptions | 🔴 Not Started |
| 3 | Frontend | UI, Components | 🔴 Not Started |
| 4 | Migration | User Migration | 🔴 Not Started |
| 5-6 | Cleanup | Remove Pesapal | 🔴 Not Started |

**Total Duration:** 6 weeks

---

## Risk Assessment

### High Risks
1. **User Migration Issues**
   - Risk: Users unable to migrate
   - Mitigation: Clear communication, support team ready

2. **Payment Processing Errors**
   - Risk: Payments fail during migration
   - Mitigation: Thorough testing, gradual rollout

3. **Data Loss**
   - Risk: Payment/subscription data lost
   - Mitigation: Backups, data verification

### Medium Risks
1. **PayPal Integration Issues**
   - Risk: PayPal API problems
   - Mitigation: Fallback plan, PayPal support

2. **User Confusion**
   - Risk: Users confused by change
   - Mitigation: Clear communication, support

---

## Communication Plan

### Pre-Migration
- Announce migration 2 weeks before
- Explain benefits
- Provide timeline

### During Migration
- Send migration emails
- Provide support
- Update status page

### Post-Migration
- Confirm successful migration
- Gather feedback
- Address issues

---

## Support Plan

### Migration Support
- Dedicated support team
- Extended support hours
- Quick response time

### Documentation
- Migration guide
- FAQ
- Video tutorials

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Status:** Ready for Implementation
