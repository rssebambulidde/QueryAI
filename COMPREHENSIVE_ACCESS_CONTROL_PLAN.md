# Comprehensive Access Control Plan

This document categorizes **ALL** features/routes into their appropriate access control categories.

---

## Access Control Categories

1. **Public** - No authentication required
2. **Authenticated** - Any authenticated user (no tier check)
3. **Premium** - Requires `premium` or `pro` tier (admin bypass allowed)
4. **Enterprise** - Requires `enterprise` tier
5. **Admin-Only** - Requires `admin` or `super_admin` role (no tier check)

---

## 1. Authentication Routes (`/api/auth/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/auth/signup` | POST | Public | ✅ Public | User registration |
| `/api/auth/login` | POST | Public | ✅ Public | User login |
| `/api/auth/logout` | POST | Authenticated | ✅ Authenticated | User logout |
| `/api/auth/refresh` | POST | Public | ✅ Public | Token refresh |
| `/api/auth/forgot-password` | POST | Public | ✅ Public | Password reset request |
| `/api/auth/reset-password` | POST | Authenticated | ✅ Authenticated | Password reset |
| `/api/auth/me` | GET | Authenticated | ✅ Authenticated | Get current user |
| `/api/auth/profile` | PUT | Authenticated | ✅ Authenticated | Update profile |

**Status:** ✅ All correctly categorized

---

## 2. Admin Routes (`/api/admin/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/admin/users` | GET | Admin | ✅ Admin-Only | List all users |
| `/api/admin/users/:id` | GET | Admin | ✅ Admin-Only | Get user details |
| `/api/admin/users/:id/role` | PUT | Super Admin | ✅ Admin-Only | Update user role |
| `/api/admin/users/by-email/:email/role` | PUT | Super Admin | ✅ Admin-Only | Update role by email |

**Status:** ✅ All correctly categorized

---

## 3. Analytics Routes (`/api/analytics/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/analytics/cost/summary` | GET | Admin | ✅ Admin-Only | Platform cost summary |
| `/api/analytics/cost/trends` | GET | Authenticated | ⚠️ **Premium** | User-specific cost trends |
| `/api/analytics/alerts` | GET | Authenticated | ⚠️ **Premium** | User-specific alerts |
| `/api/analytics/alerts/check` | POST | Authenticated | ⚠️ **Premium** | User-specific alert checks |
| `/api/analytics/alerts/:id/acknowledge` | POST | Authenticated | ⚠️ **Premium** | User-specific alert acknowledgment |
| `/api/analytics/monitoring/usage` | GET | Authenticated | ⚠️ **Premium** | User-specific usage analytics |
| `/api/analytics/monitoring/performance` | GET | Authenticated | ⚠️ **Premium** | User-specific performance |
| `/api/analytics/overview` | GET | Premium (with bypass) | ✅ Premium | User analytics overview |
| `/api/analytics/query-statistics` | GET | Premium (with bypass) | ✅ Premium | User query statistics |
| `/api/analytics/top-queries` | GET | Premium (with bypass) | ✅ Premium | User top queries |
| `/api/analytics/api-usage` | GET | Premium (with bypass) | ✅ Premium | User API usage metrics |
| `/api/analytics/usage-by-date` | GET | Pro (with bypass) | ✅ Premium (Pro) | User usage by date |

**Status:** ⚠️ **4 routes need fixing** (cost/trends, alerts, alerts/check, alerts/:id/acknowledge)

---

## 4. Metrics Routes (`/api/metrics/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/metrics/retrieval` | GET | Admin | ✅ Admin-Only | Platform-wide retrieval metrics |
| `/api/metrics/retrieval/summary` | GET | Admin | ✅ Admin-Only | Platform-wide summary |
| `/api/metrics/retrieval/collect` | POST | Admin | ✅ Admin-Only | Manual metric collection |
| `/api/metrics/latency/stats` | GET | Admin | ✅ Admin-Only | Platform-wide latency stats |
| `/api/metrics/latency/trends` | GET | Admin | ✅ Admin-Only | Platform-wide latency trends |
| `/api/metrics/latency/alerts` | GET | Authenticated | ⚠️ **Admin-Only** | Platform latency alerts |
| `/api/metrics/latency/alerts/stats` | GET | Admin | ✅ Admin-Only | Alert statistics |
| `/api/metrics/errors/stats` | GET | Admin | ✅ Admin-Only | Platform-wide error stats |
| `/api/metrics/errors/trends` | GET | Admin | ✅ Admin-Only | Platform-wide error trends |
| `/api/metrics/errors/alerts` | GET | Admin | ✅ Admin-Only | Platform error alerts |
| `/api/metrics/errors/alerts/stats` | GET | Admin | ✅ Admin-Only | Error alert stats |
| `/api/metrics/quality/stats` | GET | Admin | ✅ Admin-Only | Platform-wide quality stats |
| `/api/metrics/quality/trends` | GET | Admin | ✅ Admin-Only | Platform-wide quality trends |
| `/api/metrics/cache/stats` | GET | Authenticated | ⚠️ **Admin-Only** | Platform cache stats |

**Status:** ⚠️ **2 routes need fixing** (latency/alerts, cache/stats)

---

## 5. AI Routes (`/api/ai/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/ai/ask` | POST | Authenticated | ✅ Authenticated | Core feature - tier limits enforced via middleware |
| `/api/ai/ask/stream` | POST | Authenticated | ✅ Authenticated | Core feature - tier limits enforced |
| `/api/ai/ask/async` | POST | Authenticated | ✅ Authenticated | Core feature - tier limits enforced |
| `/api/ai/ask/async/:id` | GET | Authenticated | ✅ Authenticated | Check async job status |
| `/api/ai/ask/async/:id/cancel` | POST | Authenticated | ✅ Authenticated | Cancel async job |
| `/api/ai/models` | GET | Authenticated | ✅ Authenticated | List available models |
| `/api/ai/models/:id` | GET | Authenticated | ✅ Authenticated | Get model details |
| `/api/ai/conversations/:id/messages` | GET | Authenticated | ✅ Authenticated | Get conversation messages |
| `/api/ai/conversations/:id/messages/:messageId/regenerate` | POST | Authenticated | ✅ Authenticated | Regenerate message |
| `/api/ai/conversations/:id/messages/:messageId/feedback` | POST | Authenticated | ✅ Authenticated | Submit feedback |
| `/api/ai/conversations/:id/export` | GET | Authenticated | ✅ Authenticated | Export conversation |
| `/api/ai/conversations/:id` | DELETE | Authenticated | ✅ Authenticated | Delete conversation |

**Status:** ✅ All correctly categorized (tier limits enforced via middleware)

---

## 6. Documents Routes (`/api/documents/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/documents/upload` | POST | Authenticated + Feature Check | ✅ Authenticated | Tier limits enforced via middleware |
| `/api/documents` | GET | Authenticated | ✅ Authenticated | List user's documents |
| `/api/documents/:id` | GET | Authenticated | ✅ Authenticated | Get document details |
| `/api/documents/:id/metadata` | GET | Authenticated | ✅ Authenticated | Get document metadata |
| `/api/documents/:id/reprocess` | POST | Authenticated | ✅ Authenticated | Reprocess document |
| `/api/documents/:id/chunks` | GET | Authenticated | ✅ Authenticated | Get document chunks |
| `/api/documents/:id/chunks/:chunkId` | GET | Authenticated | ✅ Authenticated | Get chunk details |
| `/api/documents/:id/regenerate-embeddings` | POST | Authenticated | ✅ Authenticated | Regenerate embeddings |
| `/api/documents/:id/delete` | DELETE | Authenticated | ✅ Authenticated | Delete document |

**Status:** ✅ All correctly categorized (tier limits enforced via middleware)

---

## 7. Conversations Routes (`/api/conversations/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/conversations` | GET | Authenticated | ✅ Authenticated | List user's conversations |
| `/api/conversations` | POST | Authenticated | ✅ Authenticated | Create conversation |
| `/api/conversations/:id` | GET | Authenticated | ✅ Authenticated | Get conversation |
| `/api/conversations/:id` | PUT | Authenticated | ✅ Authenticated | Update conversation |
| `/api/conversations/:id` | DELETE | Authenticated | ✅ Authenticated | Delete conversation |
| `/api/conversations/:id/messages` | GET | Authenticated | ✅ Authenticated | Get messages |
| `/api/conversations/:id/messages` | POST | Authenticated | ✅ Authenticated | Add message |

**Status:** ✅ All correctly categorized

---

## 8. Topics Routes (`/api/topics/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/topics` | GET | Authenticated | ✅ Authenticated | List user's topics |
| `/api/topics/:id` | GET | Authenticated | ✅ Authenticated | Get topic |
| `/api/topics` | POST | Authenticated + Limit Check | ✅ Authenticated | Tier limits enforced |
| `/api/topics/:id` | PUT | Authenticated | ✅ Authenticated | Update topic |
| `/api/topics/:id` | DELETE | Authenticated | ✅ Authenticated | Delete topic |

**Status:** ✅ All correctly categorized

---

## 9. Collections Routes (`/api/collections/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/collections` | GET | Authenticated | ✅ Authenticated | List user's collections |
| `/api/collections/:id` | GET | Authenticated | ✅ Authenticated | Get collection |
| `/api/collections` | POST | Authenticated | ✅ Authenticated | Create collection |
| `/api/collections/:id` | PUT | Authenticated | ✅ Authenticated | Update collection |
| `/api/collections/:id` | DELETE | Authenticated | ✅ Authenticated | Delete collection |
| `/api/collections/:id/conversations/:conversationId` | POST | Authenticated | ✅ Authenticated | Add conversation |
| `/api/collections/:id/conversations/:conversationId` | DELETE | Authenticated | ✅ Authenticated | Remove conversation |
| `/api/collections/:id/search` | GET | Authenticated | ✅ Authenticated | Search collection |

**Status:** ✅ All correctly categorized

---

## 10. Search Routes (`/api/search/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/search/semantic` | POST | Authenticated | ✅ Authenticated | Semantic search |
| `/api/search/index-stats` | GET | Authenticated | ⚠️ **Admin-Only** | Platform index statistics |

**Status:** ⚠️ **1 route needs fixing** (index-stats)

---

## 11. Usage Routes (`/api/usage/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/usage/current` | GET | Authenticated | ✅ Authenticated | User's current usage |
| `/api/usage/history` | GET | Authenticated | ✅ Authenticated | User's usage history |
| `/api/usage/warnings` | GET | Authenticated | ✅ Authenticated | Usage warnings |
| `/api/usage/costs` | GET | Authenticated | ✅ Authenticated | User's costs |

**Status:** ✅ All correctly categorized

---

## 12. Subscription Routes (`/api/subscription/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/subscription` | GET | Authenticated | ✅ Authenticated | Get user's subscription |
| `/api/subscription/upgrade` | PUT | Authenticated | ⚠️ **Admin-Only** | Admin testing tool |
| `/api/subscription/downgrade` | PUT | Authenticated | ✅ Authenticated | User can downgrade |
| `/api/subscription/cancel` | PUT | Authenticated | ✅ Authenticated | User can cancel |
| `/api/subscription/reactivate` | PUT | Authenticated | ✅ Authenticated | User can reactivate |
| `/api/subscription/start-trial` | POST | Authenticated | ✅ Authenticated | Start trial |
| `/api/subscription/limits` | GET | Authenticated | ✅ Authenticated | Get limits |
| `/api/subscription/usage` | GET | Authenticated | ✅ Authenticated | Get usage |
| `/api/subscription/features` | GET | Authenticated | ✅ Authenticated | Get features |
| `/api/subscription/tiers` | GET | Authenticated | ✅ Authenticated | List tiers |
| `/api/subscription/tiers/:tier` | GET | Authenticated | ✅ Authenticated | Get tier details |
| `/api/subscription/check-limit` | POST | Authenticated | ✅ Authenticated | Check limit |
| `/api/subscription/check-feature` | GET | Authenticated | ✅ Authenticated | Check feature access |

**Status:** ⚠️ **1 route needs review** (upgrade - should be admin-only for testing)

---

## 13. Payment Routes (`/api/payment/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/payment/create` | POST | Authenticated | ✅ Authenticated | Create payment |
| `/api/payment/callback` | GET | Public | ✅ Public | PayPal callback |
| `/api/payment/cancel` | GET | Public | ✅ Public | PayPal cancel |
| `/api/payment/webhook` | POST | Public | ✅ Public | PayPal webhook |
| `/api/payment/:id` | GET | Authenticated | ✅ Authenticated | Get payment |
| `/api/payment/history` | GET | Authenticated | ✅ Authenticated | Payment history |
| `/api/payment/sync-subscription` | POST | Authenticated | ✅ Authenticated | Sync subscription |
| `/api/payment/subscription/:id` | GET | Authenticated | ✅ Authenticated | Get subscription |
| `/api/payment/subscription/:id/cancel` | POST | Authenticated | ✅ Authenticated | Cancel subscription |
| `/api/payment/subscription/:id/reactivate` | POST | Authenticated | ✅ Authenticated | Reactivate subscription |

**Status:** ✅ All correctly categorized

---

## 14. Billing Routes (`/api/billing/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/billing/overage` | GET | Authenticated | ✅ Authenticated | User's overage summary |
| `/api/billing/overage/initiate` | POST | Authenticated | ✅ Authenticated | Initiate overage payment |

**Status:** ✅ All correctly categorized

---

## 15. Enterprise Routes (`/api/enterprise/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/enterprise/inquiry` | POST | Public | ✅ Public | Contact form |
| `/api/enterprise/teams` | GET | Authenticated + Enterprise Check | ✅ Enterprise | List teams |
| `/api/enterprise/teams` | POST | Authenticated + Enterprise Check | ✅ Enterprise | Create team |

**Status:** ✅ All correctly categorized

---

## 16. Cache Routes (`/api/cache/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/cache/stats` | GET | Authenticated | ⚠️ **Admin-Only** | Platform cache stats |
| `/api/cache/version` | GET | Authenticated | ⚠️ **Admin-Only** | Cache version |
| `/api/cache/query-stats` | GET | Authenticated | ⚠️ **Admin-Only** | Query service stats |
| `/api/cache/warm` | POST | Authenticated | ⚠️ **Admin-Only** | Cache warming |
| `/api/cache/invalidate` | POST | Authenticated | ⚠️ **Admin-Only** | Cache invalidation |
| `/api/cache/clear` | POST | Authenticated | ⚠️ **Admin-Only** | Clear cache |
| All other cache routes | Various | Authenticated | ⚠️ **Admin-Only** | Cache management tools |

**Status:** ⚠️ **All cache routes should be admin-only** (cache management is operational)

---

## 17. Connections Routes (`/api/connections/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/connections` | GET | Authenticated | ✅ Authenticated | List connections |
| `/api/connections/:id` | GET | Authenticated | ✅ Authenticated | Get connection |
| `/api/connections` | POST | Authenticated | ✅ Authenticated | Create connection |
| `/api/connections/:id` | PUT | Authenticated | ✅ Authenticated | Update connection |
| `/api/connections/:id` | DELETE | Authenticated | ✅ Authenticated | Delete connection |
| `/api/connections/:id/test` | GET | Authenticated | ✅ Authenticated | Test connection |
| `/api/connections/:id/sync` | POST | Authenticated | ✅ Authenticated | Sync connection |

**Status:** ✅ All correctly categorized

---

## 18. Test Routes (`/api/test/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| `/api/test/supabase` | GET | Public | ⚠️ **Admin-Only or Dev Only** | Testing tool |

**Status:** ⚠️ Should be admin-only or dev-only

---

## 19. Debug Routes (`/api/debug/*`)

| Route | Method | Current | Should Be | Reason |
|-------|--------|---------|-----------|--------|
| All debug routes | Various | Dev Only | ✅ Dev Only | Already restricted to dev |

**Status:** ✅ Correctly restricted to dev environment

---

## Frontend Pages

| Page | Current | Should Be | Reason |
|------|---------|-----------|--------|
| `/dashboard` | Authenticated | ✅ Authenticated | Main dashboard |
| `/dashboard/health` | Admin | ✅ Admin-Only | Health monitoring |
| `/dashboard/analytics` | Admin | ✅ Admin-Only | System analytics |
| `/dashboard/validation` | Admin | ✅ Admin-Only | Validation reports |
| `/dashboard/ab-testing` | Admin | ✅ Admin-Only | A/B testing |
| `/dashboard/admin/users` | Super Admin | ✅ Admin-Only | User management |
| `/dashboard/settings/*` | Authenticated | ✅ Authenticated | User settings |

**Status:** ✅ All correctly categorized

---

## Summary of Changes Needed

### Routes to Fix:

1. **Analytics Routes** (4 routes):
   - `GET /api/analytics/cost/trends` → Premium
   - `GET /api/analytics/alerts` → Premium
   - `POST /api/analytics/alerts/check` → Premium
   - `POST /api/analytics/alerts/:id/acknowledge` → Premium

2. **Metrics Routes** (2 routes):
   - `GET /api/metrics/latency/alerts` → Admin-Only
   - `GET /api/metrics/cache/stats` → Admin-Only

3. **Search Routes** (1 route):
   - `GET /api/search/index-stats` → Admin-Only

4. **Cache Routes** (All routes):
   - All `/api/cache/*` routes → Admin-Only

5. **Subscription Routes** (1 route):
   - `PUT /api/subscription/upgrade` → Admin-Only (testing tool)

6. **Test Routes** (1 route):
   - `GET /api/test/supabase` → Admin-Only or Dev-Only

---

## Implementation Priority

### High Priority (User-Facing Features):
1. Analytics routes (cost/trends, alerts) - Users expect premium features
2. Search index-stats - Should be admin-only

### Medium Priority (Operational Tools):
3. Metrics latency/alerts - Admin monitoring tool
4. Cache routes - Admin operational tool

### Low Priority (Testing/Dev):
5. Subscription upgrade route - Admin testing tool
6. Test routes - Dev/admin tool

---

## Decision Framework

### Is it Admin-Only?
- ✅ Platform/system-wide data
- ✅ Operational management tool
- ✅ Affects all users
- ✅ System monitoring/health

### Is it Premium?
- ✅ User-specific data/analytics
- ✅ Monetizable user feature
- ✅ Advanced analytics/reporting
- ✅ User-facing premium feature

### Is it Authenticated?
- ✅ Core user feature
- ✅ User's own data
- ✅ Basic functionality
- ✅ Tier limits enforced via middleware

### Is it Enterprise?
- ✅ Enterprise-specific features
- ✅ Team/collaboration features
- ✅ Requires enterprise tier

### Is it Public?
- ✅ No authentication needed
- ✅ Public endpoints (webhooks, callbacks)
- ✅ User registration/login

---

## Next Steps

1. Review and approve this categorization plan
2. Implement fixes for routes marked ⚠️
3. Test access control for each category
4. Update documentation
