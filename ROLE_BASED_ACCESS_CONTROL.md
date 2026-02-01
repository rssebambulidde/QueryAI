# Role-Based Access Control (RBAC) Guide

This guide explains how to restrict components and features to app owner/admin users.

## Overview

The system supports three user roles:
- **user** (default): Regular users with standard access
- **admin**: Can access admin features and manage certain aspects
- **owner**: App owner with full access to all features

## Database Setup

1. Run the migration to add the role column:
```sql
-- Run in Supabase SQL Editor
\i backend/src/database/migrations/030_add_user_roles.sql
```

Or manually:
```sql
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner'));
```

## Setting User Roles

### Option 1: Using the Script (Recommended)
```bash
# Set user as owner by email
ts-node backend/src/scripts/set-user-role.ts user@example.com owner --by-email

# Set user as admin by user ID
ts-node backend/src/scripts/set-user-role.ts 123e4567-e89b-12d3-a456-426614174000 admin

# Set user back to regular user
ts-node backend/src/scripts/set-user-role.ts user@example.com user --by-email
```

### Option 2: Direct SQL
```sql
-- Set user as owner
UPDATE user_profiles SET role = 'owner' WHERE email = 'user@example.com';

-- Set user as admin
UPDATE user_profiles SET role = 'admin' WHERE email = 'user@example.com';

-- Set user back to regular user
UPDATE user_profiles SET role = 'user' WHERE email = 'user@example.com';
```

## Backend Usage

### 1. Protect Routes with Middleware

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireOwner } from '../middleware/authorization.middleware';

const router = Router();

// Admin-only route (admin or owner)
router.get('/admin/features', authenticate, requireAdmin, async (req, res) => {
  // Only admins and owners can access this
  res.json({ message: 'Admin features' });
});

// Owner-only route
router.get('/owner/settings', authenticate, requireOwner, async (req, res) => {
  // Only owner can access this
  res.json({ message: 'Owner settings' });
});
```

### 2. Conditional Logic in Route Handlers

```typescript
import { isAdminOrOwner, isOwner } from '../middleware/authorization.middleware';

router.get('/some-feature', authenticate, async (req, res) => {
  const isAdmin = await isAdminOrOwner(req.user!.id);
  
  if (isAdmin) {
    // Show admin features
  } else {
    // Show regular features
  }
});
```

## Frontend Usage

### 1. Using the Hook

```typescript
import { useUserRole } from '@/lib/hooks/use-user-role';

function MyComponent() {
  const { isAdmin, isOwner, hasAdminAccess, hasRole } = useUserRole();

  return (
    <div>
      {isAdmin && <AdminPanel />}
      {isOwner && <OwnerSettings />}
      
      {hasRole('admin') && <AdminFeature />}
    </div>
  );
}
```

### 2. Protect Entire Pages

```typescript
// app/dashboard/admin/page.tsx
import { AdminGuard } from '@/components/admin/admin-guard';

export default function AdminPage() {
  return (
    <AdminGuard>
      <div>
        <h1>Admin Dashboard</h1>
        {/* Admin content */}
      </div>
    </AdminGuard>
  );
}
```

### 3. Owner-Only Pages

```typescript
// app/dashboard/owner/page.tsx
import { AdminGuard } from '@/components/admin/admin-guard';

export default function OwnerPage() {
  return (
    <AdminGuard requireOwner>
      <div>
        <h1>Owner Settings</h1>
        {/* Owner-only content */}
      </div>
    </AdminGuard>
  );
}
```

### 4. Conditional Rendering

```typescript
import { AdminOnly } from '@/components/admin/admin-only';

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      
      {/* Regular settings for all users */}
      <GeneralSettings />
      
      {/* Admin-only section */}
      <AdminOnly>
        <AdminSettings />
      </AdminOnly>
      
      {/* Owner-only section */}
      <AdminOnly requireOwner>
        <OwnerSettings />
      </AdminOnly>
      
      {/* With fallback */}
      <AdminOnly fallback={<p>You need admin access to see this.</p>}>
        <AdminPanel />
      </AdminOnly>
    </div>
  );
}
```

### 5. Update Existing Admin Checks

Replace old email-based checks:

```typescript
// OLD (remove this pattern)
const isAdmin = user?.email?.includes('@admin') || user?.subscriptionTier === 'pro';

// NEW (use the hook)
const { isAdmin } = useUserRole();
```

## Examples

### Example 1: Admin Dashboard Page

```typescript
// app/dashboard/admin/page.tsx
'use client';

import { AdminGuard } from '@/components/admin/admin-guard';
import { useUserRole } from '@/lib/hooks/use-user-role';

export default function AdminDashboard() {
  const { role, isOwner } = useUserRole();

  return (
    <AdminGuard>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <p>Your role: {role}</p>
        
        {isOwner && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="font-semibold">Owner Features</p>
            <p>You have full access as the app owner.</p>
          </div>
        )}
        
        {/* Admin features */}
      </div>
    </AdminGuard>
  );
}
```

### Example 2: Component with Admin Section

```typescript
// components/settings/settings-panel.tsx
'use client';

import { AdminOnly } from '@/components/admin/admin-only';
import { useUserRole } from '@/lib/hooks/use-user-role';

export function SettingsPanel() {
  const { isAdmin } = useUserRole();

  return (
    <div>
      <h2>Settings</h2>
      
      {/* Regular settings */}
      <GeneralSettings />
      
      {/* Admin section */}
      <AdminOnly>
        <div className="mt-6 border-t pt-6">
          <h3 className="font-semibold mb-2">Admin Settings</h3>
          <AdminSettings />
        </div>
      </AdminOnly>
    </div>
  );
}
```

### Example 3: Backend API Endpoint

```typescript
// routes/admin.routes.ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/authorization.middleware';

const router = Router();

// Admin-only endpoint
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  // Fetch all users (admin only)
  const users = await getAllUsers();
  res.json({ success: true, data: users });
});

// Owner-only endpoint
router.delete('/users/:id', authenticate, requireOwner, async (req, res) => {
  // Delete user (owner only)
  await deleteUser(req.params.id);
  res.json({ success: true });
});

export default router;
```

## Migration from Old System

If you're currently using email-based checks:

1. **Set roles for existing admin users:**
```sql
-- Set users with @admin emails as admin
UPDATE user_profiles 
SET role = 'admin' 
WHERE email LIKE '%@admin%' OR email LIKE '%@internal%';

-- Set the first user as owner (adjust condition as needed)
UPDATE user_profiles 
SET role = 'owner' 
WHERE id = (SELECT id FROM user_profiles ORDER BY created_at ASC LIMIT 1);
```

2. **Update frontend components:**
   - Replace `user?.email?.includes('@admin')` with `useUserRole().isAdmin`
   - Replace `user?.subscriptionTier === 'pro'` checks with role checks if needed

3. **Update backend routes:**
   - Add `requireAdmin` or `requireOwner` middleware to protected routes

## Security Notes

1. **Always verify on backend**: Frontend checks are for UX only. Always enforce authorization on the backend.

2. **Use middleware**: Prefer middleware (`requireAdmin`, `requireOwner`) over manual checks in route handlers.

3. **Log access attempts**: The middleware automatically logs unauthorized access attempts.

4. **Default to 'user'**: New users default to 'user' role. Explicitly set admin/owner roles.

5. **Owner is highest privilege**: Owner can do everything admin can do, plus owner-only features.

## Troubleshooting

**User role not updating:**
- Check database migration ran successfully
- Verify user exists in `user_profiles` table
- Check role value is exactly 'user', 'admin', or 'owner' (case-sensitive)

**Frontend not showing admin features:**
- Verify `/api/auth/me` returns the role field
- Check user is logged in and token is valid
- Clear browser cache/localStorage

**Backend authorization failing:**
- Ensure `authenticate` middleware runs before `requireAdmin`/`requireOwner`
- Check user profile exists and has role set
- Verify database connection is working
