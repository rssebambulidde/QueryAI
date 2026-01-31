# Implementation Plan: Access Control Fixes

## Current Status Analysis

### ✅ Already Correctly Implemented

**Admin-Only (No Tier Check):**
- `/api/admin/*` - User management (✅ correct)
- `/api/metrics/*` - System metrics (✅ correct)
- `/api/analytics/cost/summary` - Platform cost summary (✅ correct - admin-only)
- `/dashboard/health` - Health monitoring (✅ correct)
- `/dashboard/ab-testing` - A/B testing (✅ correct)
- `/dashboard/validation` - Validation reports (✅ correct)

**Premium Features (Tier Check with Admin Bypass):**
- `/api/analytics/overview` - User analytics (✅ correct)
- `/api/analytics/query-statistics` - User query stats (✅ correct)
- `/api/analytics/top-queries` - User top queries (✅ correct)
- `/api/analytics/api-usage` - User API usage (✅ correct)
- `/api/analytics/usage-by-date` - User usage by date (✅ correct)

### ⚠️ Needs Fixing

**Routes Currently Accessible to All Users (Should Be Premium):**

1. **`GET /api/analytics/cost/trends`**
   - **Current:** Accessible to all authenticated users
   - **Should Be:** Premium feature (tier-checked with admin bypass)
   - **Reason:** Returns user-specific cost trends (filters by `user_id`)
   - **Fix:** Add `checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro'])`

2. **`GET /api/analytics/alerts`**
   - **Current:** Accessible to all authenticated users
   - **Should Be:** Premium feature OR admin-only (needs decision)
   - **Reason:** User-specific alerts (uses `userId`)
   - **Decision Needed:** Is this a user feature (premium) or admin monitoring tool?

3. **`POST /api/analytics/alerts/check`**
   - **Current:** Accessible to all authenticated users
   - **Should Be:** Premium feature OR admin-only (needs decision)
   - **Reason:** User-specific alert checks (uses `userId`)
   - **Decision Needed:** Is this a user feature (premium) or admin monitoring tool?

4. **`POST /api/analytics/alerts/:id/acknowledge`**
   - **Current:** Accessible to all authenticated users
   - **Should Be:** Premium feature OR admin-only (needs decision)
   - **Reason:** User-specific alert acknowledgment
   - **Decision Needed:** Is this a user feature (premium) or admin monitoring tool?

---

## Implementation Steps

### Step 1: Fix `/api/analytics/cost/trends` (Clear Case)

**Action:** Add tier check with admin bypass

**Code Change:**
```typescript
// backend/src/routes/analytics.routes.ts

router.get(
  '/cost/trends',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    // Check subscription tier (Premium/Pro only) - admins bypass this check
    const tierCheck = await checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro']);
    if (!tierCheck.hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          message: tierCheck.reason || 'Cost trends are only available for Premium and Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
    }

    // ... rest of existing code
  })
);
```

---

### Step 2: Decide on Alert Routes

**Question:** Are alerts a user-facing feature or admin monitoring tool?

**Option A: Premium Feature (User-Facing)**
- Users can see their own cost/profitability alerts
- Users can acknowledge their alerts
- Makes sense if users want to monitor their own costs
- **Implementation:** Add tier check with admin bypass

**Option B: Admin-Only (Monitoring Tool)**
- Only admins can see alerts (platform-wide or user-specific)
- Admin monitoring tool
- **Implementation:** Add `requireAdmin` middleware

**Recommendation:** **Option A (Premium Feature)**
- Alerts are user-specific (`userId` based)
- Users should be able to monitor their own costs
- This is a user-facing feature, not admin-only

---

### Step 3: Implement Alert Routes as Premium Features

**Action:** Add tier check with admin bypass to all alert routes

**Code Changes:**

```typescript
// backend/src/routes/analytics.routes.ts

// GET /api/analytics/alerts
router.get(
  '/alerts',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    // Check subscription tier (Premium/Pro only) - admins bypass this check
    const tierCheck = await checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro']);
    if (!tierCheck.hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          message: tierCheck.reason || 'Alerts are only available for Premium and Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
    }

    // ... rest of existing code
  })
);

// POST /api/analytics/alerts/check
router.post(
  '/alerts/check',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    // Check subscription tier (Premium/Pro only) - admins bypass this check
    const tierCheck = await checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro']);
    if (!tierCheck.hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          message: tierCheck.reason || 'Alert checks are only available for Premium and Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
    }

    // ... rest of existing code
  })
);

// POST /api/analytics/alerts/:id/acknowledge
router.post(
  '/alerts/:id/acknowledge',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) throw new ValidationError('User not authenticated');

    // Check subscription tier (Premium/Pro only) - admins bypass this check
    const tierCheck = await checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro']);
    if (!tierCheck.hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          message: tierCheck.reason || 'Alert acknowledgment is only available for Premium and Pro subscribers',
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
    }

    // ... rest of existing code
  })
);
```

---

## Summary of Changes

### Files to Modify:
1. `backend/src/routes/analytics.routes.ts`
   - Add tier check to `/cost/trends` route
   - Add tier check to `/alerts` route
   - Add tier check to `/alerts/check` route
   - Add tier check to `/alerts/:id/acknowledge` route

### Routes to Fix:
| Route | Current | Should Be | Action |
|-------|---------|-----------|--------|
| `GET /api/analytics/cost/trends` | All users | Premium | Add tier check |
| `GET /api/analytics/alerts` | All users | Premium | Add tier check |
| `POST /api/analytics/alerts/check` | All users | Premium | Add tier check |
| `POST /api/analytics/alerts/:id/acknowledge` | All users | Premium | Add tier check |

---

## Testing Plan

### Test Case 1: Regular User with Free Tier
- ❌ Cannot access `/api/analytics/cost/trends`
- ❌ Cannot access `/api/analytics/alerts`
- ❌ Cannot access `/api/analytics/alerts/check`
- ❌ Cannot access `/api/analytics/alerts/:id/acknowledge`

### Test Case 2: Regular User with Premium Tier
- ✅ Can access `/api/analytics/cost/trends`
- ✅ Can access `/api/analytics/alerts`
- ✅ Can access `/api/analytics/alerts/check`
- ✅ Can access `/api/analytics/alerts/:id/acknowledge`

### Test Case 3: Admin with Free Tier
- ✅ Can access `/api/analytics/cost/trends` (bypass)
- ✅ Can access `/api/analytics/alerts` (bypass)
- ✅ Can access `/api/analytics/alerts/check` (bypass)
- ✅ Can access `/api/analytics/alerts/:id/acknowledge` (bypass)

---

## Implementation Checklist

- [ ] Fix `/api/analytics/cost/trends` - Add tier check with admin bypass
- [ ] Fix `/api/analytics/alerts` - Add tier check with admin bypass
- [ ] Fix `/api/analytics/alerts/check` - Add tier check with admin bypass
- [ ] Fix `/api/analytics/alerts/:id/acknowledge` - Add tier check with admin bypass
- [ ] Test with free tier user (should be blocked)
- [ ] Test with premium tier user (should work)
- [ ] Test with admin free tier (should work via bypass)
- [ ] Update documentation

---

## Decision Needed

**Question:** Should alert routes be premium features or admin-only?

**Recommendation:** Premium features (user-facing)
- Alerts are user-specific
- Users should monitor their own costs
- This is a monetizable feature

**Alternative:** Admin-only (if alerts are platform-wide monitoring)

Please confirm which approach you prefer before implementation.
