# Admin-Only vs Premium Features: Access Control Guidelines

This document defines which features should be **admin-only** (no subscription tier check) versus **premium features** (subscription tier checked with admin bypass).

---

## Core Principle

**Admin-Only Features** = Platform/system management tools (operational necessity)  
**Premium Features** = User-facing features that users pay for (monetization)

---

## ✅ ADMIN-ONLY Features (No Tier Check)

These features should **ONLY** check for admin/super_admin role. **NO subscription tier check.**

### 1. User Management (`/api/admin/*`)
**Why Admin-Only:**
- System administration function
- Managing other users' accounts
- Security-sensitive operations
- Not a user feature - it's a platform management tool

**Routes:**
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/role` - Update user role (super_admin only)
- `PUT /api/admin/users/by-email/:email/role` - Update role by email (super_admin only)

**Frontend:**
- `/dashboard/admin/users` - User Management page (super_admin only)

**Access Control:** `requireAdmin` or `requireSuperAdmin` only

---

### 2. System Metrics (`/api/metrics/*`)
**Why Admin-Only:**
- Platform-wide performance monitoring
- System health and quality metrics
- Not user-specific data
- Operational tool for platform management

**Routes:**
- `GET /api/metrics/retrieval` - Retrieval quality metrics (platform-wide)
- `GET /api/metrics/retrieval/summary` - Retrieval metrics summary
- `POST /api/metrics/retrieval/collect` - Manual metric collection
- `GET /api/metrics/latency/stats` - Latency statistics (system-wide)
- `GET /api/metrics/latency/trends` - Latency trends
- `GET /api/metrics/latency/alerts/stats` - Alert statistics
- `GET /api/metrics/errors/stats` - Error statistics (system-wide)
- `GET /api/metrics/errors/trends` - Error trends
- `GET /api/metrics/errors/alerts` - Error alerts
- `GET /api/metrics/errors/alerts/stats` - Error alert stats
- `GET /api/metrics/quality/stats` - Quality statistics (platform-wide)
- `GET /api/metrics/quality/trends` - Quality trends

**Frontend:**
- `/dashboard/analytics` - Analytics Dashboard (shows system metrics)

**Access Control:** `requireAdmin` only

**Note:** These are **platform-wide metrics**, not user-specific analytics.

---

### 3. Health Monitoring (`/dashboard/health`)
**Why Admin-Only:**
- System health monitoring
- Platform performance tracking
- Operational necessity for admins
- Not a user-facing feature

**Frontend:**
- `/dashboard/health` - Health Monitoring page

**Access Control:** `isAdmin` check in frontend, no backend route (uses existing metrics APIs)

---

### 4. Platform Cost Analytics (`/api/analytics/cost/summary`)
**Why Admin-Only:**
- Platform-wide cost analysis
- Operational cost monitoring
- Not user-specific costs
- System management tool

**Route:**
- `GET /api/analytics/cost/summary` - Cost summary (platform costs)

**Access Control:** `requireAdmin` only

**Note:** This is different from user-specific cost tracking which might be a premium feature.

---

### 5. A/B Testing (`/dashboard/ab-testing`)
**Why Admin-Only:**
- Platform testing and experimentation
- System optimization tool
- Not a user feature
- Operational tool for improving platform

**Frontend:**
- `/dashboard/ab-testing` - A/B Testing page

**Access Control:** `isAdmin` check in frontend

**Note:** If you want to allow premium users to run their own A/B tests, that would be a separate premium feature.

---

### 6. Validation Reports (`/dashboard/validation`)
**Why Admin-Only:**
- System quality assurance
- Platform validation and testing
- Operational tool
- Not a user-facing feature

**Frontend:**
- `/dashboard/validation` - Validation Reports page

**Access Control:** `isAdmin` check in frontend

---

## 💎 PREMIUM Features (Tier Checked with Admin Bypass)

These features should check subscription tier BUT allow admins to bypass.

### 1. User Analytics (`/api/analytics/*` - User-Specific)
**Why Premium:**
- User's own analytics and insights
- Monetizable feature
- Users pay for advanced analytics
- User-facing feature

**Routes:**
- `GET /api/analytics/overview` - User's analytics overview
- `GET /api/analytics/query-statistics` - User's query statistics
- `GET /api/analytics/top-queries` - User's top queries
- `GET /api/analytics/api-usage` - User's API usage metrics
- `GET /api/analytics/usage-by-date` - User's usage by date (Pro only)

**Access Control:** `checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro'])`

**Tier Requirements:**
- Most: `premium` or `pro`
- Usage by date: `pro` only

**Admin Bypass:** ✅ Admins can access regardless of tier

---

## 📊 Comparison Table

| Feature | Type | Role Check | Tier Check | Admin Bypass | Reason |
|---------|------|------------|------------|--------------|--------|
| **User Management** | Admin | ✅ admin/super_admin | ❌ None | N/A | System administration |
| **System Metrics** | Admin | ✅ admin/super_admin | ❌ None | N/A | Platform monitoring |
| **Health Monitoring** | Admin | ✅ admin/super_admin | ❌ None | N/A | System health |
| **Platform Cost Analytics** | Admin | ✅ admin/super_admin | ❌ None | N/A | Operational costs |
| **A/B Testing** | Admin | ✅ admin/super_admin | ❌ None | N/A | Platform testing |
| **Validation Reports** | Admin | ✅ admin/super_admin | ❌ None | N/A | Quality assurance |
| **User Analytics Overview** | Premium | ✅ authenticated | ✅ premium/pro | ✅ Yes | User's own data |
| **Query Statistics** | Premium | ✅ authenticated | ✅ premium/pro | ✅ Yes | User's own data |
| **Top Queries** | Premium | ✅ authenticated | ✅ premium/pro | ✅ Yes | User's own data |
| **API Usage Metrics** | Premium | ✅ authenticated | ✅ premium/pro | ✅ Yes | User's own data |
| **Usage by Date** | Premium | ✅ authenticated | ✅ pro | ✅ Yes | User's own data |

---

## Decision Framework

### Ask These Questions:

1. **Is this a platform/system management tool?**
   - ✅ Yes → Admin-only (no tier check)
   - ❌ No → Continue to question 2

2. **Is this user-specific data/analytics?**
   - ✅ Yes → Premium feature (tier check with admin bypass)
   - ❌ No → Continue to question 3

3. **Is this a monetizable user-facing feature?**
   - ✅ Yes → Premium feature (tier check with admin bypass)
   - ❌ No → Admin-only (no tier check)

### Examples:

**Admin-Only:**
- "List all users" → Admin-only (system management)
- "Platform error rates" → Admin-only (system monitoring)
- "System health dashboard" → Admin-only (operational tool)

**Premium:**
- "My query statistics" → Premium (user's own data)
- "My usage analytics" → Premium (user's own data)
- "My top queries" → Premium (user's own data)

---

## Implementation Guidelines

### For Admin-Only Features:

```typescript
// ✅ Correct: Admin-only, no tier check
router.get(
  '/admin/users',
  authenticate,
  requireAdmin,  // Only role check
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // ... implementation
  })
);
```

### For Premium Features:

```typescript
// ✅ Correct: Tier check with admin bypass
router.get(
  '/analytics/overview',
  authenticate,
  apiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    
    // Check tier but allow admin bypass
    const tierCheck = await checkSubscriptionTierWithAdminBypass(
      userId, 
      ['premium', 'pro']
    );
    
    if (!tierCheck.hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          message: tierCheck.reason,
          code: 'SUBSCRIPTION_REQUIRED',
        },
      });
    }
    
    // ... implementation
  })
);
```

---

## Current Status

### ✅ Correctly Implemented (Admin-Only):
- `/api/admin/*` - User management
- `/api/metrics/*` - System metrics
- `/api/analytics/cost/summary` - Platform cost analytics
- `/dashboard/health` - Health monitoring
- `/dashboard/ab-testing` - A/B testing
- `/dashboard/validation` - Validation reports

### ✅ Correctly Implemented (Premium with Admin Bypass):
- `/api/analytics/overview` - User analytics
- `/api/analytics/query-statistics` - User query stats
- `/api/analytics/top-queries` - User top queries
- `/api/analytics/api-usage` - User API usage
- `/api/analytics/usage-by-date` - User usage by date

---

## Summary

**Admin-Only Features (No Tier Check):**
- User management
- System metrics
- Health monitoring
- Platform cost analytics
- A/B testing
- Validation reports

**Premium Features (Tier Check with Admin Bypass):**
- User analytics overview
- User query statistics
- User top queries
- User API usage metrics
- User usage by date

**Key Distinction:**
- **Admin-only** = Platform/system management (operational tools)
- **Premium** = User-facing features (monetizable, user's own data)

This ensures:
1. Admins can always manage the platform (even with free tier)
2. Regular users pay for premium analytics features
3. Clear separation between operational tools and user features
