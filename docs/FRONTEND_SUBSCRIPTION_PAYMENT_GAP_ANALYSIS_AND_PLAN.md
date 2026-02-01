# Frontend Subscription & Payment System — Gap Analysis & Enhancement Plan

**Created:** January 31, 2026  
**Scope:** Frontend components, user experience, error handling, and real-time updates for subscription and payment flows

---

## Executive Summary

This document identifies gaps and enhancement opportunities in the frontend subscription and payment system. While the backend has been comprehensively fixed, the frontend needs improvements in error handling, user feedback, real-time updates, and edge case handling.

---

## Current Frontend Implementation

### Components Reviewed
1. **`subscription-manager.tsx`** - Main subscription management UI
2. **`payment-dialog.tsx`** - Payment initiation dialog
3. **`paypal-button.tsx`** - PayPal payment button component
4. **`dashboard/page.tsx`** - Payment redirect handling
5. **`lib/api.ts`** - API client and payment methods

### Current Features
- ✅ Subscription tier display
- ✅ Payment dialog with billing period selection
- ✅ Recurring vs one-time payment options
- ✅ Billing history display
- ✅ Sync billing status button
- ✅ Basic error handling
- ✅ Payment redirect handling (success, failed, pending, error)
- ✅ Auto-sync on mount and redirect

---

## Identified Gaps (Prioritized)

### Priority 1 — Critical (User Experience & Data Accuracy)

| # | Gap | Impact | Current State | Root Cause |
|---|-----|--------|---------------|------------|
| 1 | **No grace period visibility** | Users don't know when subscription expires after failed payment | No UI indication of grace period | Frontend doesn't display `grace_period_end` from subscription |
| 2 | **No failed payment recovery UI** | Users can't easily retry failed payments | Only shows "failed" status in billing history | No retry/resolve action for failed payments |
| 3 | **No expired subscription handling** | Users don't know subscription expired or how to reactivate | No UI for expired status | Frontend doesn't handle `status: 'expired'` |
| 4 | **Pending payment timeout not shown** | Users don't know how long to wait for pending payments | Shows "pending" but no timeout info | No indication of when to retry sync |
| 5 | **No real-time payment status updates** | Payment status may change but UI doesn't refresh | Manual refresh required | No polling or WebSocket for status updates |

### Priority 2 — High (User Feedback & Error Handling)

| # | Gap | Impact | Current State | Root Cause |
|---|-----|--------|---------------|------------|
| 6 | **Generic error messages** | Users don't know what went wrong | Shows "Payment failed" without details | Error messages don't include failure reason |
| 7 | **No payment retry mechanism** | Users must restart entire payment flow | No "Retry Payment" button | Failed payments require new initiation |
| 8 | **Sync button doesn't show progress** | Users don't know if sync is working | Button shows "Syncing..." but no feedback | No loading state or progress indicator |
| 9 | **No payment cancellation confirmation** | Users may cancel accidentally | Uses browser `confirm()` dialog | No styled confirmation modal |
| 10 | **Missing payment method display** | Users don't know how they paid | Billing history doesn't show payment method | `payment_method` field not displayed |

### Priority 3 — Medium (UX Enhancements)

| # | Gap | Impact | Current State | Root Cause |
|---|-----|--------|---------------|------------|
| 11 | **No payment receipt/invoice preview** | Users must download to view invoice | Download button only, no preview | No modal/preview component |
| 12 | **Billing history pagination missing** | Large history lists are hard to navigate | All payments shown at once | No pagination or infinite scroll |
| 13 | **No payment filtering/search** | Hard to find specific payments | No search or filter options | No UI for filtering by status/date/tier |
| 14 | **No subscription renewal reminders** | Users may forget to renew | No reminders before period ends | No countdown or reminder UI |
| 15 | **No payment method management** | Users can't update payment methods | No UI for managing PayPal subscriptions | Backend supports it but frontend doesn't expose |

### Priority 4 — Lower (Polish & Edge Cases)

| # | Gap | Impact | Current State | Root Cause |
|---|-----|--------|---------------|------------|
| 16 | **No loading skeleton** | Blank screen during data load | Shows spinner, then content appears | No skeleton loading state |
| 17 | **No empty states** | Empty billing history shows nothing | No message when no payments | Missing empty state components |
| 18 | **Mobile payment dialog UX** | Payment dialog may be cramped on mobile | Responsive but could be better | Could optimize for mobile screens |
| 19 | **No payment analytics** | Users can't see spending trends | No charts or analytics | No visualization of payment history |
| 20 | **No keyboard shortcuts** | Power users can't navigate quickly | No keyboard shortcuts | Missing accessibility features |

---

## Detailed Gap Analysis

### Gap 1: No Grace Period Visibility

**Current Behavior:**
- Subscription shows as "active" even during grace period
- No indication that payment failed and grace period is active
- User doesn't know when subscription will expire

**Expected Behavior:**
- Display grace period warning banner when `grace_period_end` exists
- Show countdown to grace period expiration
- Provide "Update Payment Method" or "Retry Payment" action

**Implementation:**
```typescript
// In subscription-manager.tsx
{subscription.grace_period_end && (
  <Alert variant="warning">
    <AlertCircle className="w-4 h-4" />
    <div>
      <strong>Payment Failed</strong>
      <p>Your subscription will expire on {formatDate(subscription.grace_period_end)}. 
         Please update your payment method to avoid service interruption.</p>
      <Button onClick={handleUpdatePaymentMethod}>Update Payment Method</Button>
    </div>
  </Alert>
)}
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`

---

### Gap 2: No Failed Payment Recovery UI

**Current Behavior:**
- Failed payments show in billing history with "failed" status
- No action to retry or resolve the failed payment
- User must initiate a new payment

**Expected Behavior:**
- Show "Retry Payment" button for failed payments
- Show failure reason if available
- Allow user to update payment method and retry

**Implementation:**
```typescript
// In billing history display
{payment.status === 'failed' && (
  <div className="flex gap-2">
    <Button size="sm" onClick={() => handleRetryPayment(payment.id)}>
      Retry Payment
    </Button>
    {payment.callback_data?.failure_reason && (
      <span className="text-sm text-red-600">
        Reason: {payment.callback_data.failure_reason}
      </span>
    )}
  </div>
)}
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`
- `frontend/lib/api.ts` (add retry payment endpoint if needed)

---

### Gap 3: No Expired Subscription Handling

**Current Behavior:**
- Expired subscriptions may show as "active" or "cancelled"
- No clear indication that subscription expired
- No reactivation flow

**Expected Behavior:**
- Display expired status prominently
- Show "Reactivate Subscription" button
- Explain what happens when subscription expires (downgrade to free)

**Implementation:**
```typescript
// In subscription-manager.tsx
{subscription.status === 'expired' && (
  <Alert variant="error">
    <div>
      <strong>Subscription Expired</strong>
      <p>Your subscription has expired. You've been downgraded to the free tier.</p>
      <Button onClick={() => handleUpgrade(subscription.tier)}>
        Reactivate {subscription.tier} Plan
      </Button>
    </div>
  </Alert>
)}
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`

---

### Gap 4: Pending Payment Timeout Not Shown

**Current Behavior:**
- Pending payments show indefinitely
- No indication of when to retry sync
- User doesn't know if payment is still processing

**Expected Behavior:**
- Show "Pending" status with timestamp
- Display "Last synced: X minutes ago"
- Auto-retry sync after reasonable timeout (e.g., 5 minutes)
- Show "Still pending? Click to sync again" message

**Implementation:**
```typescript
// Calculate time since payment creation
const timeSincePayment = payment.created_at 
  ? Math.floor((Date.now() - new Date(payment.created_at).getTime()) / 60000)
  : 0;

{payment.status === 'pending' && timeSincePayment > 5 && (
  <Alert variant="info">
    Payment has been pending for {timeSincePayment} minutes. 
    <Button size="sm" onClick={() => handleSyncBillingStatus()}>
      Sync Again
    </Button>
  </Alert>
)}
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`

---

### Gap 5: No Real-Time Payment Status Updates

**Current Behavior:**
- Payment status only updates on manual refresh
- User must check billing history manually
- No automatic updates when webhook processes payment

**Expected Behavior:**
- Poll payment status for pending payments (every 30 seconds)
- Stop polling when payment completes or fails
- Show toast notification when status changes
- Auto-refresh subscription data when payment completes

**Implementation:**
```typescript
// Poll pending payments
useEffect(() => {
  const pendingPayments = billingHistory?.payments.filter(p => p.status === 'pending');
  if (!pendingPayments || pendingPayments.length === 0) return;

  const interval = setInterval(async () => {
    await loadBillingHistory();
    await loadSubscriptionData();
  }, 30000); // Poll every 30 seconds

  return () => clearInterval(interval);
}, [billingHistory]);
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`

---

### Gap 6: Generic Error Messages

**Current Behavior:**
- Shows "Payment failed" without details
- No indication of why payment failed
- User doesn't know how to fix the issue

**Expected Behavior:**
- Display specific error messages from backend
- Show actionable guidance based on error type
- Include error codes for support reference

**Implementation:**
```typescript
// Enhanced error display
const getErrorMessage = (error: string, payment?: Payment) => {
  if (error.includes('INSUFFICIENT_FUNDS')) {
    return 'Payment failed due to insufficient funds. Please check your card or use a different payment method.';
  }
  if (error.includes('EXPIRED_CARD')) {
    return 'Your card has expired. Please update your payment method.';
  }
  if (error.includes('DECLINED')) {
    return 'Your payment was declined. Please contact your bank or use a different payment method.';
  }
  return error || 'Payment failed. Please try again or contact support.';
};
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`
- `frontend/components/payment/payment-dialog.tsx`

---

### Gap 7: No Payment Retry Mechanism

**Current Behavior:**
- Failed payments require starting over
- User must re-enter all payment details
- No way to retry with same or different payment method

**Expected Behavior:**
- "Retry Payment" button for failed payments
- Pre-fill payment dialog with previous details
- Option to update payment method before retry

**Implementation:**
```typescript
const handleRetryPayment = async (paymentId: string) => {
  const payment = billingHistory?.payments.find(p => p.id === paymentId);
  if (!payment) return;

  // Pre-fill dialog with payment details
  setSelectedTier(payment.tier);
  setPaymentDialogInitialBilling(payment.billing_period || 'monthly');
  setPaymentDialogInitialRecurring(!!payment.paypal_subscription_id);
  setShowPaymentDialog(true);
};
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`

---

### Gap 8: Sync Button Doesn't Show Progress

**Current Behavior:**
- Button shows "Syncing..." but no visual feedback
- User doesn't know if sync is working
- No indication of what's being synced

**Expected Behavior:**
- Show loading spinner in button
- Display "Syncing subscription..." message
- Show success/error feedback after sync
- Disable button during sync

**Current Implementation:** ✅ Already has `syncingBilling` state, but could enhance feedback

**Enhancement:**
```typescript
<Button
  onClick={handleSyncBillingStatus}
  disabled={syncingBilling}
  className="flex items-center gap-2"
>
  <RefreshCw className={`w-4 h-4 ${syncingBilling ? 'animate-spin' : ''}`} />
  {syncingBilling ? 'Syncing...' : 'Sync billing status'}
</Button>
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx` (enhance existing)

---

### Gap 9: No Payment Cancellation Confirmation

**Current Behavior:**
- Uses browser `confirm()` dialog (not styled)
- No clear explanation of cancellation consequences
- No option to cancel at period end vs immediate

**Expected Behavior:**
- Custom styled confirmation modal
- Clear explanation of what happens
- Option to cancel immediately or at period end

**Implementation:**
```typescript
// Create ConfirmationModal component
<ConfirmationModal
  open={showCancelConfirm}
  title="Cancel Subscription"
  message="Are you sure you want to cancel? You'll lose access to premium features."
  confirmText="Cancel Subscription"
  cancelText="Keep Subscription"
  onConfirm={() => handleCancel(immediate)}
  onCancel={() => setShowCancelConfirm(false)}
/>
```

**Files to Create:**
- `frontend/components/ui/confirmation-modal.tsx`

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`

---

### Gap 10: Missing Payment Method Display

**Current Behavior:**
- Billing history doesn't show how user paid
- No indication of PayPal vs card payment
- User can't see payment method used

**Expected Behavior:**
- Display payment method in billing history
- Show card last 4 digits if available
- Show PayPal email if PayPal payment

**Implementation:**
```typescript
// In billing history display
<div className="text-sm text-gray-600">
  {payment.payment_method === 'paypal' ? (
    <span>PayPal • {payment.callback_data?.payerEmail || 'N/A'}</span>
  ) : (
    <span>Card • •••• {payment.callback_data?.last4 || ''}</span>
  )}
</div>
```

**Files to Modify:**
- `frontend/components/subscription/subscription-manager.tsx`

---

## Enhancement Plan

### Phase 1 — Critical Fixes (Week 1)

**Goal:** Fix critical UX issues that impact user experience

1. **Gap 1: Grace Period Visibility** (4 hours)
   - Add grace period banner to subscription manager
   - Display countdown timer
   - Add "Update Payment Method" action

2. **Gap 2: Failed Payment Recovery** (3 hours)
   - Add "Retry Payment" button for failed payments
   - Display failure reason
   - Pre-fill payment dialog on retry

3. **Gap 3: Expired Subscription Handling** (2 hours)
   - Add expired status display
   - Add reactivation flow
   - Show downgrade explanation

4. **Gap 4: Pending Payment Timeout** (2 hours)
   - Show pending payment age
   - Add auto-retry after timeout
   - Display sync suggestion

5. **Gap 5: Real-Time Updates** (4 hours)
   - Implement polling for pending payments
   - Add status change notifications
   - Auto-refresh on completion

**Total: ~15 hours**

---

### Phase 2 — High Priority Enhancements (Week 2)

**Goal:** Improve error handling and user feedback

6. **Gap 6: Enhanced Error Messages** (3 hours)
   - Parse error codes and show user-friendly messages
   - Add actionable guidance
   - Include support contact info

7. **Gap 7: Payment Retry Mechanism** (3 hours)
   - Implement retry payment flow
   - Pre-fill payment details
   - Handle payment method updates

8. **Gap 8: Sync Progress Feedback** (2 hours)
   - Enhance sync button with better feedback
   - Show sync status messages
   - Add success/error toasts

9. **Gap 9: Payment Cancellation Modal** (4 hours)
   - Create confirmation modal component
   - Add cancellation options
   - Improve cancellation UX

10. **Gap 10: Payment Method Display** (2 hours)
    - Show payment method in billing history
    - Display card/PayPal info
    - Add payment method icons

**Total: ~14 hours**

---

### Phase 3 — Medium Priority (Week 3)

**Goal:** Add polish and advanced features

11. **Gap 11: Invoice Preview** (4 hours)
    - Add invoice preview modal
    - Show invoice details before download
    - Improve invoice UX

12. **Gap 12: Billing History Pagination** (3 hours)
    - Implement pagination
    - Add "Load More" or page navigation
    - Optimize for large lists

13. **Gap 13: Payment Filtering** (4 hours)
    - Add filter by status, date, tier
    - Add search functionality
    - Improve history navigation

14. **Gap 14: Renewal Reminders** (3 hours)
    - Add countdown to renewal
    - Show renewal reminders
    - Email notification integration

15. **Gap 15: Payment Method Management** (6 hours)
    - Add PayPal subscription management UI
    - Allow updating payment methods
    - Handle payment method changes

**Total: ~20 hours**

---

### Phase 4 — Polish & Edge Cases (Week 4)

**Goal:** Final polish and edge case handling

16. **Gap 16: Loading Skeletons** (3 hours)
    - Add skeleton loaders
    - Improve loading states
    - Better perceived performance

17. **Gap 17: Empty States** (2 hours)
    - Add empty state components
    - Improve empty billing history UX
    - Add helpful messages

18. **Gap 18: Mobile Optimization** (4 hours)
    - Optimize payment dialog for mobile
    - Improve touch targets
    - Better mobile navigation

19. **Gap 19: Payment Analytics** (6 hours)
    - Add spending charts
    - Show payment trends
    - Visualize billing history

20. **Gap 20: Keyboard Shortcuts** (3 hours)
    - Add keyboard navigation
    - Improve accessibility
    - Power user features

**Total: ~18 hours**

---

## Implementation Checklist

### Phase 1 — Critical Fixes

- [ ] **Gap 1:** Add grace period banner with countdown
  - [ ] Display `grace_period_end` from subscription
  - [ ] Show countdown timer
  - [ ] Add "Update Payment Method" button
  - [ ] Style warning alert

- [ ] **Gap 2:** Failed payment recovery UI
  - [ ] Add "Retry Payment" button to failed payments
  - [ ] Display failure reason from `callback_data`
  - [ ] Implement retry payment handler
  - [ ] Pre-fill payment dialog on retry

- [ ] **Gap 3:** Expired subscription handling
  - [ ] Check for `status === 'expired'`
  - [ ] Display expired status alert
  - [ ] Add reactivation button
  - [ ] Explain downgrade consequences

- [ ] **Gap 4:** Pending payment timeout
  - [ ] Calculate time since payment creation
  - [ ] Show pending duration
  - [ ] Add auto-retry after 5 minutes
  - [ ] Display sync suggestion

- [ ] **Gap 5:** Real-time payment updates
  - [ ] Implement polling for pending payments
  - [ ] Poll every 30 seconds
  - [ ] Stop polling when payment completes
  - [ ] Show toast on status change

### Phase 2 — High Priority

- [ ] **Gap 6:** Enhanced error messages
  - [ ] Parse error codes (INSUFFICIENT_FUNDS, EXPIRED_CARD, etc.)
  - [ ] Show user-friendly messages
  - [ ] Add actionable guidance
  - [ ] Include support contact

- [ ] **Gap 7:** Payment retry mechanism
  - [ ] Store payment details for retry
  - [ ] Pre-fill payment dialog
  - [ ] Handle payment method updates
  - [ ] Test retry flow

- [ ] **Gap 8:** Sync progress feedback
  - [ ] Enhance sync button UI
  - [ ] Show detailed sync status
  - [ ] Add success/error toasts
  - [ ] Disable during sync

- [ ] **Gap 9:** Payment cancellation modal
  - [ ] Create `ConfirmationModal` component
  - [ ] Replace browser `confirm()` dialogs
  - [ ] Add cancellation options
  - [ ] Style modal

- [ ] **Gap 10:** Payment method display
  - [ ] Show `payment_method` in billing history
  - [ ] Display PayPal email or card last 4
  - [ ] Add payment method icons
  - [ ] Style payment method badge

### Phase 3 — Medium Priority

- [ ] **Gap 11:** Invoice preview
  - [ ] Create invoice preview modal
  - [ ] Fetch invoice data
  - [ ] Display invoice details
  - [ ] Add download button

- [ ] **Gap 12:** Billing history pagination
  - [ ] Implement pagination logic
  - [ ] Add page navigation
  - [ ] Optimize API calls
  - [ ] Handle empty pages

- [ ] **Gap 13:** Payment filtering
  - [ ] Add filter UI (status, date, tier)
  - [ ] Implement search
  - [ ] Update API calls with filters
  - [ ] Style filter controls

- [ ] **Gap 14:** Renewal reminders
  - [ ] Calculate days until renewal
  - [ ] Show countdown
  - [ ] Display reminder banner
  - [ ] Integrate with email notifications

- [ ] **Gap 15:** Payment method management
  - [ ] Add PayPal subscription management UI
  - [ ] Allow updating payment methods
  - [ ] Handle payment method changes
  - [ ] Test update flow

### Phase 4 — Polish

- [ ] **Gap 16:** Loading skeletons
  - [ ] Create skeleton components
  - [ ] Replace spinners with skeletons
  - [ ] Improve perceived performance

- [ ] **Gap 17:** Empty states
  - [ ] Create empty state components
  - [ ] Add helpful messages
  - [ ] Style empty states

- [ ] **Gap 18:** Mobile optimization
  - [ ] Optimize payment dialog for mobile
  - [ ] Improve touch targets
  - [ ] Test on mobile devices

- [ ] **Gap 19:** Payment analytics
  - [ ] Add chart library (recharts/chart.js)
  - [ ] Create spending charts
  - [ ] Show payment trends
  - [ ] Visualize billing history

- [ ] **Gap 20:** Keyboard shortcuts
  - [ ] Add keyboard navigation
  - [ ] Implement shortcuts
  - [ ] Improve accessibility
  - [ ] Document shortcuts

---

## Testing Checklist

After implementing each phase:

### Phase 1 Testing
- [ ] Grace period banner displays correctly
- [ ] Countdown timer updates in real-time
- [ ] Failed payments show retry button
- [ ] Expired subscriptions show reactivation option
- [ ] Pending payments auto-sync after timeout
- [ ] Payment status updates automatically

### Phase 2 Testing
- [ ] Error messages are user-friendly
- [ ] Payment retry works correctly
- [ ] Sync button shows proper feedback
- [ ] Cancellation modal works
- [ ] Payment methods display correctly

### Phase 3 Testing
- [ ] Invoice preview works
- [ ] Pagination navigates correctly
- [ ] Filters work as expected
- [ ] Renewal reminders display
- [ ] Payment method updates work

### Phase 4 Testing
- [ ] Loading skeletons display
- [ ] Empty states show correctly
- [ ] Mobile UX is optimized
- [ ] Analytics charts render
- [ ] Keyboard shortcuts work

---

## Dependencies & Considerations

### New Dependencies
- **Date formatting:** Consider `date-fns` or `dayjs` for date handling
- **Charts:** `recharts` or `chart.js` for payment analytics
- **Icons:** Already using `lucide-react` ✅

### Backend API Requirements
- Ensure backend returns `grace_period_end` in subscription data ✅
- Ensure backend returns failure reasons in payment `callback_data` ✅
- Ensure backend supports payment retry endpoint (may need to add)
- Ensure backend supports payment method updates (may need to add)

### Performance Considerations
- Polling should be limited to pending payments only
- Stop polling when component unmounts
- Debounce sync button clicks
- Optimize billing history rendering with pagination

---

## Success Metrics

### User Experience
- **Reduced support tickets** about payment issues
- **Increased payment success rate** (retry mechanism)
- **Improved user satisfaction** with payment flow
- **Faster payment resolution** (real-time updates)

### Technical
- **Zero unhandled payment errors** in frontend
- **All edge cases covered** (grace period, expired, failed)
- **Mobile-friendly** payment flows
- **Accessible** payment UI (WCAG compliance)

---

## Next Steps

1. **Review and prioritize** gaps based on user feedback
2. **Start with Phase 1** (critical fixes)
3. **Test thoroughly** after each phase
4. **Gather user feedback** and iterate
5. **Document** new features and user guides

---

**Status:** Ready for Implementation  
**Estimated Total Time:** ~67 hours (4 weeks)  
**Priority:** Start with Phase 1 (Critical Fixes)

---

## Appendix: Code Examples

### Grace Period Banner Component
```typescript
function GracePeriodBanner({ subscription }: { subscription: Subscription }) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  useEffect(() => {
    if (!subscription.grace_period_end) return;
    
    const updateTimer = () => {
      const now = new Date();
      const end = new Date(subscription.grace_period_end!);
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeRemaining(`${days}d ${hours}h remaining`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [subscription.grace_period_end]);
  
  if (!subscription.grace_period_end) return null;
  
  return (
    <Alert variant="warning" className="mb-4">
      <AlertCircle className="w-5 h-5" />
      <div className="ml-3">
        <strong>Payment Failed — Grace Period Active</strong>
        <p className="mt-1">
          Your subscription will expire in {timeRemaining}. 
          Please update your payment method to avoid service interruption.
        </p>
        <Button size="sm" className="mt-2" onClick={handleUpdatePaymentMethod}>
          Update Payment Method
        </Button>
      </div>
    </Alert>
  );
}
```

### Payment Retry Handler
```typescript
const handleRetryPayment = async (paymentId: string) => {
  const payment = billingHistory?.payments.find(p => p.id === paymentId);
  if (!payment) return;
  
  // Pre-fill payment dialog
  setSelectedTier(payment.tier as 'starter' | 'premium' | 'pro' | 'enterprise');
  setPaymentDialogInitialBilling(
    (payment.callback_data?.billing_period as BillingPeriod) || 'monthly'
  );
  setPaymentDialogInitialRecurring(!!payment.paypal_subscription_id);
  setShowPaymentDialog(true);
};
```

---

**Last Updated:** January 31, 2026
