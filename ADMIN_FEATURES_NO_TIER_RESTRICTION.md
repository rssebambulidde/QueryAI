# Admin Features Accessible by Any Subscription Tier

This document lists all features that are **restricted to admin/super_admin roles** but are **accessible regardless of subscription tier** (including `free` tier).

## Overview

These are **administrative/system management features** that should be accessible to admins even if they have a `free` subscription tier. This ensures admins can always manage the system.

---

## Backend API Routes

### 1. Admin User Management (`/api/admin/*`)

All routes require `admin` or `super_admin` role. **No subscription tier check.**

#### User Management
- **GET** `/api/admin/users` - List all users (admin/super_admin)
- **GET** `/api/admin/users/:id` - Get user details by ID (admin/super_admin)
- **PUT** `/api/admin/users/:id/role` - Update user role (super_admin only)
- **PUT** `/api/admin/users/by-email/:email/role` - Update user role by email (super_admin only)

**Access:** Any admin with `free`, `starter`, `premium`, `pro`, or `enterprise` tier ✅

---

### 2. Analytics - Cost Summary (`/api/analytics/cost/summary`)

- **GET** `/api/analytics/cost/summary` - Cost summary for authenticated user
- Protected by: `requireAdmin` middleware
- **No subscription tier check**

**Access:** Any admin with any tier ✅

**Note:** Other analytics routes (`/overview`, `/query-statistics`, etc.) check subscription tier but allow admin bypass via `checkSubscriptionTierWithAdminBypass()`.

---

### 3. Metrics Routes (`/api/metrics/*`)

All metrics routes require `admin` or `super_admin` role. **No subscription tier check.**

#### Retrieval Metrics
- **GET** `/api/metrics/retrieval` - Get retrieval quality metrics
- **GET** `/api/metrics/retrieval/summary` - Get retrieval metrics summary
- **POST** `/api/metrics/retrieval/collect` - Manually collect metrics for testing/feedback

#### Latency Metrics
- **GET** `/api/metrics/latency/stats` - Get latency statistics
- **GET** `/api/metrics/latency/trends` - Get latency trends over time
- **GET** `/api/metrics/latency/alerts/stats` - Get alert statistics

#### Error Metrics
- **GET** `/api/metrics/errors/stats` - Get error statistics
- **GET** `/api/metrics/errors/trends` - Get error trends over time
- **GET** `/api/metrics/errors/alerts` - Get recent error rate alerts
- **GET** `/api/metrics/errors/alerts/stats` - Get error alert statistics

#### Quality Metrics
- **GET** `/api/metrics/quality/stats` - Get quality statistics
- **GET** `/api/metrics/quality/trends` - Get quality trends over time

**Access:** Any admin with any tier ✅

**Note:** `/api/metrics/latency/alerts` and `/api/metrics/cache/stats` don't require admin role (accessible to all authenticated users).

---

## Frontend Pages/UI

### 1. Admin Dashboard Pages

These pages are protected by `useUserRole().isAdmin` check and redirect non-admins.

#### Health Monitoring
- **Route:** `/dashboard/health`
- **Component:** `frontend/app/dashboard/health/page.tsx`
- **Access:** Admin/super_admin only, any tier ✅

#### Analytics Dashboard
- **Route:** `/dashboard/analytics`
- **Component:** `frontend/app/dashboard/analytics/page.tsx`
- **Access:** Admin/super_admin only, any tier ✅
- **Note:** Some API calls may check subscription tier but admins bypass via backend helper

#### Validation Reports
- **Route:** `/dashboard/validation`
- **Component:** `frontend/app/dashboard/validation/page.tsx`
- **Access:** Admin/super_admin only, any tier ✅

#### A/B Testing
- **Route:** `/dashboard/ab-testing`
- **Component:** `frontend/app/dashboard/ab-testing/page.tsx`
- **Access:** Admin/super_admin only, any tier ✅

#### User Management (Super Admin Only)
- **Route:** `/dashboard/admin/users`
- **Component:** `frontend/app/dashboard/admin/users/page.tsx`
- **Access:** Super_admin only, any tier ✅

---

### 2. Sidebar Navigation

Admin section in sidebar (`frontend/components/sidebar/app-sidebar.tsx`):
- Shows admin menu items based on `user?.role === 'admin' || user?.role === 'super_admin'`
- **No subscription tier check**
- Includes links to:
  - Health Monitoring
  - Analytics Dashboard
  - Validation Reports
  - A/B Testing
  - User Management (super_admin only)

**Access:** Any admin with any tier ✅

---

## Summary Table

| Feature Category | Route/Page | Role Required | Tier Check | Admin Bypass |
|----------------|------------|---------------|------------|--------------|
| **User Management** | `/api/admin/users` | admin/super_admin | ❌ None | N/A |
| **User Role Update** | `/api/admin/users/:id/role` | super_admin | ❌ None | N/A |
| **Cost Analytics** | `/api/analytics/cost/summary` | admin/super_admin | ❌ None | N/A |
| **Retrieval Metrics** | `/api/metrics/retrieval/*` | admin/super_admin | ❌ None | N/A |
| **Latency Metrics** | `/api/metrics/latency/*` | admin/super_admin | ❌ None | N/A |
| **Error Metrics** | `/api/metrics/errors/*` | admin/super_admin | ❌ None | N/A |
| **Quality Metrics** | `/api/metrics/quality/*` | admin/super_admin | ❌ None | N/A |
| **Health Page** | `/dashboard/health` | admin/super_admin | ❌ None | N/A |
| **Analytics Page** | `/dashboard/analytics` | admin/super_admin | ❌ None | N/A |
| **Validation Page** | `/dashboard/validation` | admin/super_admin | ❌ None | N/A |
| **A/B Testing Page** | `/dashboard/ab-testing` | admin/super_admin | ❌ None | N/A |
| **User Management Page** | `/dashboard/admin/users` | super_admin | ❌ None | N/A |

---

## Features That Check Tier BUT Allow Admin Bypass

These features check subscription tier but admins can bypass:

| Feature | Route | Tier Required | Admin Bypass |
|---------|-------|---------------|--------------|
| Analytics Overview | `/api/analytics/overview` | premium/pro | ✅ Yes |
| Query Statistics | `/api/analytics/query-statistics` | premium/pro | ✅ Yes |
| Top Queries | `/api/analytics/top-queries` | premium/pro | ✅ Yes |
| API Usage Metrics | `/api/analytics/api-usage` | premium/pro | ✅ Yes |
| Usage by Date | `/api/analytics/usage-by-date` | pro | ✅ Yes |

**Implementation:** Uses `checkSubscriptionTierWithAdminBypass()` helper function.

---

## Design Rationale

### Why Admin Features Don't Check Subscription Tier

1. **System Management:** Admins need to manage the system regardless of their personal subscription
2. **Operational Necessity:** Admin tools are for platform operations, not user features
3. **Security:** Role-based access is more secure than subscription-based for admin functions
4. **Flexibility:** Admins may have `free` tier accounts for testing or internal use

### When to Use Role-Only vs Tier-Checked Routes

- **Role-Only (`requireAdmin`):** Use for administrative/system management features
  - User management
  - System metrics
  - Health monitoring
  - Platform analytics

- **Tier-Checked with Admin Bypass:** Use for user-facing premium features
  - User analytics dashboards
  - Premium reports
  - Advanced features that regular users pay for

---

## Testing Scenarios

### Test Case 1: Admin with Free Tier
- ✅ Can access `/api/admin/users`
- ✅ Can access `/api/metrics/retrieval`
- ✅ Can access `/dashboard/health`
- ✅ Can access `/api/analytics/overview` (bypasses tier check)
- ✅ Can access `/api/analytics/cost/summary`

### Test Case 2: Regular User with Premium Tier
- ❌ Cannot access `/api/admin/users`
- ❌ Cannot access `/api/metrics/retrieval`
- ❌ Cannot access `/dashboard/health`
- ✅ Can access `/api/analytics/overview` (has premium tier)
- ❌ Cannot access `/api/analytics/cost/summary` (admin only)

### Test Case 3: Admin with Premium Tier
- ✅ Can access all admin features
- ✅ Can access all premium features
- ✅ Full access to everything

---

## Conclusion

All admin/system management features are accessible to admins regardless of subscription tier. This ensures admins can always manage and monitor the platform, even if they have a `free` tier account for testing or internal purposes.

User-facing premium features (like analytics dashboards) check subscription tier but allow admins to bypass, giving admins full access while maintaining proper monetization for regular users.
