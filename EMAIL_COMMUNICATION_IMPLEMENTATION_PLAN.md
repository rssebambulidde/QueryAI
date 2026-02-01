# Email Communication Implementation Plan

## Overview

This document details the comprehensive email communication system for payment and subscription events. It covers all email types, templates, scheduling, and integration points.

**Status:** 🟡 Partially Implemented  
**Priority:** 🔴 High  
**Last Updated:** January 28, 2026

---

## Current Email Implementation Status

### ✅ Already Implemented
- Payment success email
- Payment failure email
- Payment cancellation email
- Subscription cancellation email
- Renewal reminder email
- Grace period warning email

### ❌ Missing Implementation
- Payment reminder (before renewal)
- Payment retry notification
- Payment method updated confirmation
- Invoice email (with PDF)
- Refund confirmation email
- Subscription renewal confirmation
- Failed renewal notification
- Subscription upgrade confirmation
- Subscription downgrade confirmation
- Subscription expiration warning
- Welcome email (new subscriptions)
- Subscription reactivation confirmation

---

## Email Types & Implementation

### 1. Payment-Related Emails

#### 1.1 Payment Reminder Email
**Trigger:** 7 days before subscription renewal  
**Priority:** 🔴 High  
**Status:** 🔴 Not Implemented

**Purpose:**
- Remind users of upcoming payment
- Allow time to update payment method
- Reduce failed renewals

**Template Variables:**
- `{{userName}}` - User's name
- `{{tier}}` - Subscription tier
- `{{renewalDate}}` - Date of renewal
- `{{amount}}` - Renewal amount
- `{{currency}}` - Currency (UGX/USD)
- `{{paymentMethod}}` - Last 4 digits of payment method
- `{{updatePaymentUrl}}` - Link to update payment method

**Implementation:**
```typescript
static async sendPaymentReminderEmail(
  userEmail: string,
  userName: string,
  subscription: Database.Subscription,
  payment: Database.Payment,
  daysUntilRenewal: number
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Scheduled job (daily cron)
- File: `backend/src/services/payment-reminder.service.ts` (new)

---

#### 1.2 Payment Retry Notification
**Trigger:** When automatic payment retry occurs  
**Priority:** 🔴 High  
**Status:** 🔴 Not Implemented

**Purpose:**
- Notify user of retry attempt
- Encourage payment method update
- Provide transparency

**Template Variables:**
- `{{userName}}`
- `{{tier}}`
- `{{amount}}`
- `{{currency}}`
- `{{retryCount}}` - Current retry number
- `{{maxRetries}}` - Maximum retries
- `{{nextRetryDate}}` - When next retry will occur
- `{{updatePaymentUrl}}`

**Implementation:**
```typescript
static async sendPaymentRetryEmail(
  userEmail: string,
  userName: string,
  payment: Database.Payment,
  retryCount: number,
  nextRetryDate: Date
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Payment retry service
- File: `backend/src/services/payment-retry.service.ts`

---

#### 1.3 Payment Method Updated Confirmation
**Trigger:** When user updates payment method  
**Priority:** 🟡 Medium  
**Status:** 🔴 Not Implemented

**Purpose:**
- Confirm payment method change
- Provide security notification
- Build trust

**Template Variables:**
- `{{userName}}`
- `{{paymentMethodType}}` - Card/PayPal/etc
- `{{last4Digits}}` - Last 4 digits
- `{{updateDate}}` - When updated
- `{{supportUrl}}` - Link to support if unauthorized

**Implementation:**
```typescript
static async sendPaymentMethodUpdatedEmail(
  userEmail: string,
  userName: string,
  paymentMethod: {
    type: string;
    last4: string;
    updatedAt: Date;
  }
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Payment method update endpoint
- File: `backend/src/routes/payment.routes.ts`

---

#### 1.4 Invoice Email
**Trigger:** After successful payment  
**Priority:** 🔴 High  
**Status:** 🔴 Not Implemented

**Purpose:**
- Provide payment receipt
- Include PDF invoice attachment
- Tax/accounting purposes

**Template Variables:**
- `{{userName}}`
- `{{invoiceNumber}}` - Unique invoice ID
- `{{paymentDate}}`
- `{{amount}}`
- `{{currency}}`
- `{{tier}}`
- `{{periodStart}}` - Subscription period start
- `{{periodEnd}}` - Subscription period end
- `{{invoicePdfUrl}}` - Link to download PDF

**Implementation:**
```typescript
static async sendInvoiceEmail(
  userEmail: string,
  userName: string,
  payment: Database.Payment,
  invoicePdf: Buffer
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Payment success handler
- File: `backend/src/routes/payment.routes.ts`

**Note:** Requires PDF attachment support in email service

---

#### 1.5 Refund Confirmation Email
**Trigger:** When refund is processed  
**Priority:** 🟡 Medium  
**Status:** 🔴 Not Implemented

**Purpose:**
- Confirm refund processing
- Set expectations for refund timing
- Provide refund details

**Template Variables:**
- `{{userName}}`
- `{{refundAmount}}`
- `{{currency}}`
- `{{originalPaymentDate}}`
- `{{refundDate}}`
- `{{estimatedProcessingTime}}` - Days until refund appears
- `{{refundReason}}` - Reason for refund
- `{{supportUrl}}` - Contact support if issues

**Implementation:**
```typescript
static async sendRefundConfirmationEmail(
  userEmail: string,
  userName: string,
  refund: {
    amount: number;
    currency: string;
    reason?: string;
    estimatedProcessingDays: number;
  }
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Refund processing endpoint
- File: `backend/src/routes/payment.routes.ts`

---

### 2. Subscription-Related Emails

#### 2.1 Subscription Renewal Confirmation
**Trigger:** After successful subscription renewal  
**Priority:** 🔴 High  
**Status:** 🔴 Not Implemented

**Purpose:**
- Confirm successful renewal
- Show new period dates
- Provide peace of mind

**Template Variables:**
- `{{userName}}`
- `{{tier}}`
- `{{amount}}`
- `{{currency}}`
- `{{periodStart}}` - New period start date
- `{{periodEnd}}` - New period end date
- `{{nextRenewalDate}}` - Next renewal date
- `{{paymentMethod}}` - Payment method used

**Implementation:**
```typescript
static async sendRenewalConfirmationEmail(
  userEmail: string,
  userName: string,
  subscription: Database.Subscription,
  payment: Database.Payment
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Subscription renewal handler
- File: `backend/src/services/subscription.service.ts`

---

#### 2.2 Failed Renewal Notification
**Trigger:** When automatic renewal fails  
**Priority:** 🔴 High  
**Status:** 🔴 Not Implemented

**Purpose:**
- Alert user of failed renewal
- Explain reason (if available)
- Urge immediate action
- Explain grace period

**Template Variables:**
- `{{userName}}`
- `{{tier}}`
- `{{amount}}`
- `{{currency}}`
- `{{failureReason}}` - Why payment failed
- `{{gracePeriodEnd}}` - When grace period ends
- `{{daysRemaining}}` - Days left in grace period
- `{{updatePaymentUrl}}`
- `{{supportUrl}}`

**Implementation:**
```typescript
static async sendFailedRenewalEmail(
  userEmail: string,
  userName: string,
  subscription: Database.Subscription,
  payment: Database.Payment,
  failureReason: string,
  gracePeriodEnd: Date
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Subscription renewal failure handler
- File: `backend/src/services/subscription.service.ts`

---

#### 2.3 Subscription Upgrade Confirmation
**Trigger:** When user upgrades subscription  
**Priority:** 🟡 Medium  
**Status:** 🔴 Not Implemented

**Purpose:**
- Confirm upgrade
- Highlight new features
- Show prorated amount (if applicable)
- Welcome to new tier

**Template Variables:**
- `{{userName}}`
- `{{oldTier}}` - Previous tier
- `{{newTier}}` - New tier
- `{{amount}}` - Amount charged
- `{{currency}}`
- `{{isProrated}}` - Whether prorated
- `{{proratedAmount}}` - Prorated amount (if applicable)
- `{{newFeatures}}` - Array of new features
- `{{periodStart}}`
- `{{periodEnd}}`

**Implementation:**
```typescript
static async sendUpgradeConfirmationEmail(
  userEmail: string,
  userName: string,
  oldTier: string,
  newTier: string,
  payment: Database.Payment,
  newFeatures: string[]
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Subscription upgrade handler
- File: `backend/src/routes/subscription.routes.ts`

---

#### 2.4 Subscription Downgrade Confirmation
**Trigger:** When user downgrades subscription  
**Priority:** 🟡 Medium  
**Status:** 🔴 Not Implemented

**Purpose:**
- Confirm downgrade
- Show when it takes effect
- List features that will be lost
- Offer to reconsider

**Template Variables:**
- `{{userName}}`
- `{{oldTier}}`
- `{{newTier}}`
- `{{effectiveDate}}` - When downgrade takes effect
- `{{lostFeatures}}` - Array of features being lost
- `{{reactivateUrl}}` - Link to reactivate
- `{{periodEnd}}` - Current period end date

**Implementation:**
```typescript
static async sendDowngradeConfirmationEmail(
  userEmail: string,
  userName: string,
  oldTier: string,
  newTier: string,
  effectiveDate: Date,
  lostFeatures: string[]
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Subscription downgrade handler
- File: `backend/src/routes/subscription.routes.ts`

---

#### 2.5 Subscription Expiration Warning
**Trigger:** 3 days before subscription expiration  
**Priority:** 🟡 Medium  
**Status:** 🔴 Not Implemented

**Purpose:**
- Warn about upcoming expiration
- Encourage renewal
- Show what will be lost

**Template Variables:**
- `{{userName}}`
- `{{tier}}`
- `{{expirationDate}}`
- `{{daysRemaining}}`
- `{{features}}` - Features that will be lost
- `{{renewUrl}}` - Link to renew
- `{{upgradeUrl}}` - Link to upgrade

**Implementation:**
```typescript
static async sendExpirationWarningEmail(
  userEmail: string,
  userName: string,
  subscription: Database.Subscription,
  daysUntilExpiration: number
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Scheduled job (daily cron)
- File: `backend/src/services/expiration-warning.service.ts` (new)

---

#### 2.6 Welcome Email (New Subscription)
**Trigger:** When user first subscribes to paid tier  
**Priority:** 🟡 Medium  
**Status:** 🔴 Not Implemented

**Purpose:**
- Welcome new paid user
- Highlight key features
- Provide getting started guide
- Set expectations

**Template Variables:**
- `{{userName}}`
- `{{tier}}`
- `{{features}}` - Array of tier features
- `{{gettingStartedUrl}}` - Link to getting started guide
- `{{dashboardUrl}}` - Link to dashboard
- `{{supportUrl}}` - Link to support

**Implementation:**
```typescript
static async sendWelcomeEmail(
  userEmail: string,
  userName: string,
  subscription: Database.Subscription
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Subscription creation handler
- File: `backend/src/routes/subscription.routes.ts`

---

#### 2.7 Subscription Reactivation Confirmation
**Trigger:** When user reactivates cancelled subscription  
**Priority:** 🟡 Low  
**Status:** 🔴 Not Implemented

**Purpose:**
- Confirm reactivation
- Show new period dates
- Welcome back message

**Template Variables:**
- `{{userName}}`
- `{{tier}}`
- `{{periodStart}}`
- `{{periodEnd}}`
- `{{nextRenewalDate}}`

**Implementation:**
```typescript
static async sendReactivationConfirmationEmail(
  userEmail: string,
  userName: string,
  subscription: Database.Subscription
): Promise<boolean>
```

**File:** `backend/src/services/email.service.ts`

**Integration Point:**
- Subscription reactivation handler
- File: `backend/src/routes/subscription.routes.ts`

---

## Email Scheduling System

### 3.1 Payment Reminder Scheduler
**Frequency:** Daily  
**Purpose:** Send payment reminders 7 days before renewal

**Implementation:**
```typescript
// backend/src/services/payment-reminder.service.ts
export class PaymentReminderService {
  static async sendUpcomingPaymentReminders(): Promise<void> {
    // Get all subscriptions renewing in 7 days
    // Check if reminder already sent
    // Send reminder email
    // Mark reminder as sent
  }
}
```

**Cron Schedule:** Daily at 9:00 AM UTC

---

### 3.2 Renewal Reminder Scheduler
**Frequency:** Daily  
**Purpose:** Send renewal reminders at 14, 7, and 3 days before renewal

**Implementation:**
```typescript
// backend/src/services/renewal-reminder.service.ts
export class RenewalReminderService {
  static async sendRenewalReminders(): Promise<void> {
    // Get subscriptions renewing in 14, 7, 3 days
    // Check if reminder already sent for that day
    // Send appropriate reminder
    // Mark reminder as sent
  }
}
```

**Cron Schedule:** Daily at 9:00 AM UTC

---

### 3.3 Expiration Warning Scheduler
**Frequency:** Daily  
**Purpose:** Send expiration warnings 3 days before expiration

**Implementation:**
```typescript
// backend/src/services/expiration-warning.service.ts
export class ExpirationWarningService {
  static async sendExpirationWarnings(): Promise<void> {
    // Get subscriptions expiring in 3 days
    // Check if warning already sent
    // Send warning email
    // Mark warning as sent
  }
}
```

**Cron Schedule:** Daily at 9:00 AM UTC

---

## Email Template System

### 4.1 Template Service
**Purpose:** Centralized email template management

**Implementation:**
```typescript
// backend/src/services/email-templates.service.ts
export class EmailTemplatesService {
  static getTemplate(templateName: string, variables: Record<string, any>): {
    subject: string;
    html: string;
    text: string;
  } {
    // Load template
    // Replace variables
    // Return formatted email
  }
}
```

**Benefits:**
- Reusable templates
- Easy to update
- Consistent branding
- Support for multiple languages (future)

---

## Email Preferences

### 5.1 User Email Preferences
**Purpose:** Allow users to control which emails they receive

**Database Schema:**
```sql
CREATE TABLE email_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'payment_reminder', 'renewal_reminder', etc.
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email_type)
);
```

**Implementation:**
- Add email preferences table
- Create API endpoints for managing preferences
- Check preferences before sending emails
- Default: All emails enabled

---

## Implementation Checklist

### Phase 1: Core Email Types (Week 2)
- [ ] Payment reminder email
- [ ] Payment retry notification
- [ ] Subscription renewal confirmation
- [ ] Failed renewal notification
- [ ] Invoice email (with PDF)

### Phase 2: Additional Emails (Week 3)
- [ ] Payment method updated confirmation
- [ ] Refund confirmation email
- [ ] Subscription upgrade confirmation
- [ ] Subscription downgrade confirmation
- [ ] Subscription expiration warning
- [ ] Welcome email
- [ ] Subscription reactivation confirmation

### Phase 3: Scheduling System (Week 3)
- [ ] Payment reminder scheduler
- [ ] Renewal reminder scheduler
- [ ] Expiration warning scheduler
- [ ] Cron job setup

### Phase 4: Enhancements (Week 4)
- [ ] Email template system
- [ ] Email preferences
- [ ] Email queue system (optional)
- [ ] Email testing suite

---

## Testing Requirements

### Unit Tests
- [ ] Test each email template
- [ ] Test variable replacement
- [ ] Test email sending logic
- [ ] Test error handling

### Integration Tests
- [ ] Test email sending on payment events
- [ ] Test email sending on subscription events
- [ ] Test scheduled email jobs
- [ ] Test email preferences

### Manual Testing
- [ ] Send test emails to real addresses
- [ ] Verify email formatting
- [ ] Verify links work
- [ ] Verify PDF attachments

---

## Email Delivery Monitoring

### Metrics to Track
- Email delivery rate
- Email open rate
- Click-through rate
- Bounce rate
- Unsubscribe rate

### Alerts
- High bounce rate (>5%)
- Low delivery rate (<95%)
- Email service errors
- Scheduled job failures

---

## Success Criteria

- ✅ All payment events trigger appropriate emails
- ✅ All subscription events trigger appropriate emails
- ✅ Scheduled reminders sent on time
- ✅ Email delivery rate >95%
- ✅ User preferences respected
- ✅ All emails properly formatted
- ✅ All links functional

---

**Document Version:** 1.0  
**Last Updated:** January 28, 2026  
**Next Review:** After Phase 1 completion
