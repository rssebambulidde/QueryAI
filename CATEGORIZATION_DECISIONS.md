# Access Control Categorization Decisions

This document lists all features and their categorization decisions.

---

## ✅ CORRECTLY CATEGORIZED (No Changes Needed)

### Public Routes (No Authentication)
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/forgot-password` - Password reset request
- `GET /api/payment/callback` - PayPal callback
- `GET /api/payment/cancel` - PayPal cancel
- `POST /api/payment/webhook` - PayPal webhook
- `POST /api/enterprise/inquiry` - Enterprise contact form

### Authenticated Routes (Any User)
- All `/api/auth/*` routes (except signup/login/refresh/forgot-password)
- All `/api/ai/*` routes (tier limits enforced via middleware)
- All `/api/documents/*` routes (tier limits enforced via middleware)
- All `/api/conversations/*` routes
- All `/api/topics/*` routes (tier limits enforced)
- All `/api/collections/*` routes
- All `/api/usage/*` routes
- All `/api/subscription/*` routes (except upgrade)
- All `/api/payment/*` routes (except callbacks/webhooks)
- All `/api/billing/*` routes
- All `/api/connections/*` routes

### Admin-Only Routes (Correctly Implemented)
- All `/api/admin/*` routes - User management
- `/api/analytics/cost/summary` - Platform cost summary
- Most `/api/metrics/*` routes - System metrics
- `/dashboard/health` - Health monitoring
- `/dashboard/analytics` - System analytics
- `/dashboard/validation` - Validation reports
- `/dashboard/ab-testing` - A/B testing
- `/dashboard/admin/users` - User management page

### Premium Routes (Correctly Implemented)
- `/api/analytics/overview` - User analytics overview
- `/api/analytics/query-statistics` - User query statistics
- `/api/analytics/top-queries` - User top queries
- `/api/analytics/api-usage` - User API usage metrics
- `/api/analytics/usage-by-date` - User usage by date (Pro only)

### Enterprise Routes (Correctly Implemented)
- `/api/enterprise/teams` - List/create teams

---

## ⚠️ NEEDS FIXING - Categorization Changes

### 1. Analytics Routes → Premium (4 routes)

**Current:** Accessible to all authenticated users  
**Should Be:** Premium feature (tier check with admin bypass)

| Route | Method | Reason |
|-------|--------|--------|
| `GET /api/analytics/cost/trends` | GET | User-specific cost trends (filters by userId) |
| `GET /api/analytics/alerts` | GET | User-specific alerts (uses userId) |
| `POST /api/analytics/alerts/check` | POST | User-specific alert checks (uses userId) |
| `POST /api/analytics/alerts/:id/acknowledge` | POST | User-specific alert acknowledgment (uses userId) |

**Implementation:** Add `checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro'])`

---

### 2. Analytics Monitoring Routes → Premium (2 routes)

**Current:** Accessible to all authenticated users  
**Should Be:** Premium feature (tier check with admin bypass)

| Route | Method | Reason |
|-------|--------|--------|
| `GET /api/analytics/monitoring/usage` | GET | User-specific usage analytics |
| `GET /api/analytics/monitoring/performance` | GET | User-specific performance metrics |

**Implementation:** Add `checkSubscriptionTierWithAdminBypass(userId, ['premium', 'pro'])`

---

### 3. Metrics Routes → Admin-Only (2 routes)

**Current:** Accessible to all authenticated users  
**Should Be:** Admin-only (platform-wide metrics)

| Route | Method | Reason |
|-------|--------|--------|
| `GET /api/metrics/latency/alerts` | GET | Platform-wide latency alerts (not user-specific) |
| `GET /api/metrics/cache/stats` | GET | Platform cache statistics (system-wide) |

**Implementation:** Add `requireAdmin` middleware

---

### 4. Search Routes → Admin-Only (1 route)

**Current:** Accessible to all authenticated users  
**Should Be:** Admin-only (platform index statistics)

| Route | Method | Reason |
|-------|--------|--------|
| `GET /api/search/index-stats` | GET | Pinecone index statistics (platform-wide) |

**Implementation:** Add `requireAdmin` middleware

---

### 5. Cache Routes → Admin-Only (All routes)

**Current:** Accessible to all authenticated users  
**Should Be:** Admin-only (cache management is operational tool)

| Route | Method | Reason |
|-------|--------|--------|
| `GET /api/cache/stats` | GET | Platform cache statistics |
| `GET /api/cache/version` | GET | Cache version (operational) |
| `GET /api/cache/query-stats` | GET | Query service stats (operational) |
| `POST /api/cache/warm` | POST | Cache warming (operational) |
| `POST /api/cache/invalidate` | POST | Cache invalidation (operational) |
| `POST /api/cache/clear` | POST | Clear cache (operational) |
| All other cache management routes | Various | Cache management tools |

**Implementation:** Add `requireAdmin` middleware to all cache routes

---

### 6. Subscription Routes → Admin-Only (1 route)

**Current:** Accessible to all authenticated users  
**Should Be:** Admin-only (testing/admin tool)

| Route | Method | Reason |
|-------|--------|--------|
| `PUT /api/subscription/upgrade` | PUT | Admin testing tool (actual upgrades via payment) |

**Implementation:** Add `requireAdmin` middleware

---

### 7. Test Routes → Admin-Only or Dev-Only (1 route)

**Current:** Public  
**Should Be:** Admin-only or Dev-only (testing tool)

| Route | Method | Reason |
|-------|--------|--------|
| `GET /api/test/supabase` | GET | Testing tool (should not be public) |

**Implementation:** Add `requireAdmin` middleware OR restrict to dev environment only

---

## Summary Table

| Category | Current Count | Needs Fixing | Status |
|----------|---------------|--------------|--------|
| **Public** | 8 routes | 0 | ✅ Correct |
| **Authenticated** | ~80 routes | 0 | ✅ Correct |
| **Premium** | 5 routes | 6 routes | ⚠️ Need 6 fixes |
| **Enterprise** | 2 routes | 0 | ✅ Correct |
| **Admin-Only** | ~20 routes | 6 routes | ⚠️ Need 6 fixes |
| **Dev-Only** | ~5 routes | 1 route | ⚠️ Need 1 fix |

**Total Routes Needing Fixes: 13 routes**

---

## Implementation Order

### Phase 1: High Priority (User-Facing)
1. ✅ Fix 4 Analytics routes → Premium
   - `/api/analytics/cost/trends`
   - `/api/analytics/alerts`
   - `/api/analytics/alerts/check`
   - `/api/analytics/alerts/:id/acknowledge`

2. ✅ Fix 2 Analytics Monitoring routes → Premium
   - `/api/analytics/monitoring/usage`
   - `/api/analytics/monitoring/performance`

### Phase 2: Medium Priority (Operational)
3. ✅ Fix 2 Metrics routes → Admin-Only
   - `/api/metrics/latency/alerts`
   - `/api/metrics/cache/stats`

4. ✅ Fix 1 Search route → Admin-Only
   - `/api/search/index-stats`

5. ✅ Fix all Cache routes → Admin-Only
   - All `/api/cache/*` routes

### Phase 3: Low Priority (Testing)
6. ✅ Fix 1 Subscription route → Admin-Only
   - `/api/subscription/upgrade`

7. ✅ Fix 1 Test route → Admin-Only or Dev-Only
   - `/api/test/supabase`

---

## Decision Rationale

### Why Premium (Not Admin-Only)?
- **User-specific data** - Returns data filtered by `userId`
- **User-facing feature** - Users want to see their own analytics
- **Monetizable** - Premium feature users pay for
- **Examples:** Cost trends, alerts, usage analytics

### Why Admin-Only (Not Premium)?
- **Platform-wide data** - System-wide metrics, not user-specific
- **Operational tool** - For managing the platform
- **System monitoring** - Health, performance, cache management
- **Examples:** Platform metrics, cache stats, index stats

### Why Authenticated (Not Premium)?
- **Core feature** - Basic functionality all users need
- **Tier limits enforced** - Limits applied via middleware, not route protection
- **User's own data** - Users managing their own resources
- **Examples:** Conversations, documents, topics, collections

---

## Files to Modify

1. `backend/src/routes/analytics.routes.ts` - Fix 6 routes
2. `backend/src/routes/metrics.routes.ts` - Fix 2 routes
3. `backend/src/routes/search.routes.ts` - Fix 1 route
4. `backend/src/routes/cache.routes.ts` - Fix all routes (~20 routes)
5. `backend/src/routes/subscription.routes.ts` - Fix 1 route
6. `backend/src/routes/test.routes.ts` - Fix 1 route

---

## Testing Checklist

After implementation, test:

- [ ] Free tier user cannot access premium analytics routes
- [ ] Premium tier user can access premium analytics routes
- [ ] Admin with free tier can access premium routes (bypass)
- [ ] Regular user cannot access admin-only routes
- [ ] Admin can access admin-only routes
- [ ] Regular user cannot access cache management routes
- [ ] Regular user cannot access platform metrics routes

---

## Ready to Implement?

All categorization decisions are documented above. Should I proceed with implementing these fixes?
