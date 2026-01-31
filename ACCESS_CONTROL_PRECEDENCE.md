# Access Control Precedence: Role vs Subscription Tier

## Overview

This document clarifies how **user roles** and **subscription tiers** interact in the access control system. The key principle is: **Role-based access takes precedence over subscription-tier-based access**.

## Access Control Hierarchy

```
1. Role-Based Access (Highest Priority)
   ├── super_admin → Full access to all features
   ├── admin → Access to admin features + bypass subscription checks
   └── user → Subject to subscription tier limits

2. Subscription Tier Access (For Regular Users Only)
   ├── enterprise → Highest tier features
   ├── pro → Advanced features
   ├── premium → Standard premium features
   ├── starter → Basic paid features
   └── free → Limited features
```

## Rules

### Rule 1: Admins Bypass Subscription Checks
- **Admin** (`admin` or `super_admin` role) users can access **all features** regardless of their subscription tier
- This ensures admins can always manage the system, even if they have a `free` tier subscription
- Example: An admin with `free` tier can still access `/api/analytics/overview` (normally requires `premium` or `pro`)

### Rule 2: Role-Based Routes
- Routes protected by `requireAdmin` middleware are **admin-only** regardless of subscription tier
- These routes are for system administration, not user features
- Example: `/api/analytics/cost/summary` requires admin role, not subscription tier

### Rule 3: Subscription-Tier Routes Allow Admin Bypass
- Routes that check subscription tier should use `checkSubscriptionTierWithAdminBypass()` helper
- This ensures admins can access premium features even without a premium subscription
- Example: `/api/analytics/overview` checks for `premium`/`pro` tier, but admins bypass this check

### Rule 4: Regular Users Follow Subscription Limits
- Users with `user` role are subject to subscription tier restrictions
- They must have the required subscription tier to access tier-gated features
- Example: A regular user with `free` tier cannot access `/api/analytics/overview`

## Implementation

### Backend

#### Helper Function
```typescript
// backend/src/middleware/authorization.middleware.ts
export const checkSubscriptionTierWithAdminBypass = async (
  userId: string,
  requiredTiers: string[]
): Promise<{ hasAccess: boolean; reason?: string }>
```

This function:
1. First checks if user is `admin` or `super_admin` → returns `hasAccess: true`
2. If not admin, checks subscription tier against `requiredTiers`
3. Returns access result with optional reason message

#### Usage in Routes
```typescript
// ✅ Correct: Admin bypass enabled
const tierCheck = await checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro']);
if (!tierCheck.hasAccess) {
  return res.status(403).json({ error: { message: tierCheck.reason } });
}

// ❌ Wrong: Blocks admins
const subscription = await DatabaseService.getUserSubscription(userId);
if (!subscription || subscription.tier !== 'premium') {
  return res.status(403).json({ error: { message: 'Premium required' } });
}
```

### Frontend

#### Role Checks Take Precedence
```typescript
// ✅ Correct: Check role first
const { isAdmin, isSuperAdmin } = useUserRole();
const { subscriptionTier } = useAuthStore();

// Admin features: Show based on role
{isAdmin && <AdminPanel />}

// Premium features: Show if admin OR has premium tier
{(isAdmin || subscriptionTier === 'premium') && <PremiumFeature />}

// ❌ Wrong: Only checking subscription tier
{subscriptionTier === 'premium' && <PremiumFeature />} // Blocks admins!
```

## Examples

### Example 1: Analytics Dashboard
- **Route**: `/api/analytics/overview`
- **Subscription Requirement**: `premium` or `pro`
- **Admin Access**: ✅ Admins can access regardless of tier
- **Implementation**: Uses `checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro'])`

### Example 2: Cost Summary (Admin Route)
- **Route**: `/api/analytics/cost/summary`
- **Role Requirement**: `admin` or `super_admin`
- **Subscription Check**: None (role-based only)
- **Implementation**: Uses `requireAdmin` middleware

### Example 3: Usage Charts
- **Route**: `/api/analytics/usage-by-date`
- **Subscription Requirement**: `pro`
- **Admin Access**: ✅ Admins can access regardless of tier
- **Implementation**: Uses `checkSubscriptionTierWithAdminBypass(userId, ['pro'])`

## Migration Guide

If you find routes that check subscription tier without admin bypass:

1. **Import the helper**:
   ```typescript
   import { checkSubscriptionTierWithAdminBypass } from '../middleware/authorization.middleware';
   ```

2. **Replace direct subscription checks**:
   ```typescript
   // Before
   const subscription = await DatabaseService.getUserSubscription(userId);
   if (!subscription || subscription.tier !== 'premium') {
     return res.status(403).json({ error: { message: 'Premium required' } });
   }
   
   // After
   const tierCheck = await checkSubscriptionTierWithAdminBypass(userId, ['premium']);
   if (!tierCheck.hasAccess) {
     return res.status(403).json({ error: { message: tierCheck.reason } });
   }
   ```

3. **Update frontend checks**:
   ```typescript
   // Before
   {subscriptionTier === 'premium' && <Feature />}
   
   // After
   const { isAdmin } = useUserRole();
   {(isAdmin || subscriptionTier === 'premium') && <Feature />}
   ```

## Testing

### Test Cases

1. **Admin with free tier**:
   - ✅ Can access admin routes (`requireAdmin`)
   - ✅ Can access premium features (bypass subscription check)
   - ✅ Can access pro features (bypass subscription check)

2. **Regular user with premium tier**:
   - ❌ Cannot access admin routes
   - ✅ Can access premium features
   - ❌ Cannot access pro-only features

3. **Regular user with free tier**:
   - ❌ Cannot access admin routes
   - ❌ Cannot access premium features
   - ❌ Cannot access pro-only features

## Summary

- **Role > Subscription Tier**: Admin roles always take precedence
- **Use helpers**: Always use `checkSubscriptionTierWithAdminBypass()` for tier checks
- **Clear separation**: Admin routes use `requireAdmin`, feature routes use tier checks with admin bypass
- **Frontend consistency**: Check `isAdmin` before checking `subscriptionTier` in UI

This ensures admins can always manage the system while regular users are properly restricted by their subscription tier.
