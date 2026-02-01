# Admin/Super Admin Role Implementation - Complete ✅

## Summary

Successfully implemented role-based access control with `user`, `admin`, and `super_admin` roles. All admin features are now protected and only visible to users with appropriate roles.

## Changes Made

### 1. Database Migration ✅
- **File**: `backend/src/database/migrations/030_add_user_roles.sql`
- Added `role` column to `user_profiles` table
- Values: `'user'`, `'admin'`, `'super_admin'`
- Default: `'user'`
- Backfilled existing users with `'user'` role

### 2. Backend Updates ✅

#### Types Updated:
- `backend/src/types/database.ts` - Added `role` field to `UserProfile`
- `backend/src/types/user.ts` - Added `role` field to `User` and `UserProfile`
- `backend/src/types/express.d.ts` - User type includes role

#### Authorization Middleware:
- **File**: `backend/src/middleware/authorization.middleware.ts`
- `requireAdmin` - Requires `admin` or `super_admin` role
- `requireSuperAdmin` - Requires `super_admin` role only
- Helper functions: `isAdminOrSuperAdmin()`, `isSuperAdmin()`

#### API Endpoints:
- **File**: `backend/src/routes/admin.routes.ts` (NEW)
  - `GET /api/admin/users` - List all users (admin/super_admin)
  - `GET /api/admin/users/:id` - Get user details
  - `PUT /api/admin/users/:id/role` - Update user role (super_admin only)
  - `PUT /api/admin/users/by-email/:email/role` - Update role by email (super_admin only)

#### Protected Routes:
- **File**: `backend/src/routes/analytics.routes.ts`
  - All routes now require `requireAdmin` middleware
  
- **File**: `backend/src/routes/metrics.routes.ts`
  - All routes now require `requireAdmin` middleware

#### Auth Endpoint:
- **File**: `backend/src/routes/auth.routes.ts`
  - `/api/auth/me` now returns `role` field

### 3. Frontend Updates ✅

#### Types Updated:
- `frontend/lib/api.ts` - Added `role` field to `User` interface

#### Hooks:
- **File**: `frontend/lib/hooks/use-user-role.ts`
  - `isAdmin` - Checks for admin or super_admin
  - `isSuperAdmin` - Checks for super_admin
  - `hasAdminAccess()` - Returns boolean
  - `hasSuperAdminAccess()` - Returns boolean
  - `hasRole(role)` - Check specific role

#### Components:
- **File**: `frontend/components/admin/admin-guard.tsx`
  - Protects entire pages
  - Supports `requireOwner` prop (requires super_admin)
  
- **File**: `frontend/components/admin/admin-only.tsx`
  - Conditional rendering wrapper
  - Supports `requireOwner` prop

#### Pages Updated:
- **File**: `frontend/components/sidebar/app-sidebar.tsx`
  - Changed from email/subscription checks to role-based checks
  - Admin section only shows for `admin` or `super_admin`
  - Added "User Management" link for super_admin only

- **File**: `frontend/app/dashboard/ab-testing/page.tsx`
  - Updated to use `useUserRole()` hook

- **File**: `frontend/app/dashboard/validation/page.tsx`
  - Updated to use `useUserRole()` hook

- **File**: `frontend/app/dashboard/analytics/page.tsx`
  - Updated to use `useUserRole()` hook

- **File**: `frontend/app/dashboard/health/page.tsx`
  - Updated to use `useUserRole()` hook

#### Admin UI:
- **File**: `frontend/app/dashboard/admin/users/page.tsx` (NEW)
  - User management page (super_admin only)
  - List all users with search
  - Update user roles via dropdown
  - Shows role badges
  - Prevents changing own role

## Usage

### Setting User Roles

#### Option 1: Using SQL
```sql
-- Set user as super_admin
UPDATE user_profiles SET role = 'super_admin' WHERE email = 'user@example.com';

-- Set user as admin
UPDATE user_profiles SET role = 'admin' WHERE email = 'user@example.com';

-- Set user back to regular user
UPDATE user_profiles SET role = 'user' WHERE email = 'user@example.com';
```

#### Option 2: Using Admin UI
1. Login as super_admin
2. Navigate to Admin → User Management
3. Use dropdown to change user roles

#### Option 3: Using Script
```bash
ts-node backend/src/scripts/set-user-role.ts user@example.com super_admin --by-email
```

### Protecting Backend Routes

```typescript
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/authorization.middleware';

// Admin or super_admin only
router.get('/admin/feature', authenticate, requireAdmin, handler);

// Super_admin only
router.put('/admin/users/:id/role', authenticate, requireSuperAdmin, handler);
```

### Protecting Frontend Pages

```typescript
import { AdminGuard } from '@/components/admin/admin-guard';

export default function AdminPage() {
  return (
    <AdminGuard>
      <div>Admin content</div>
    </AdminGuard>
  );
}
```

### Conditional Rendering

```typescript
import { useUserRole } from '@/lib/hooks/use-user-role';

function MyComponent() {
  const { isAdmin, isSuperAdmin } = useUserRole();
  
  return (
    <div>
      {isAdmin && <AdminPanel />}
      {isSuperAdmin && <SuperAdminSettings />}
    </div>
  );
}
```

## Migration Steps

1. **Run Database Migration:**
   ```sql
   -- In Supabase SQL Editor
   ALTER TABLE user_profiles 
   ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' 
   CHECK (role IN ('user', 'admin', 'super_admin'));
   
   UPDATE user_profiles SET role = 'user' WHERE role IS NULL;
   ```

2. **Set First Super Admin:**
   ```sql
   UPDATE user_profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';
   ```

3. **Deploy Backend:**
   - Routes are automatically protected
   - Admin API endpoints available at `/api/admin/*`

4. **Deploy Frontend:**
   - Sidebar automatically shows/hides admin items based on role
   - Admin pages protected with `AdminGuard`

## Security Notes

1. **Backend Always Enforces**: Frontend checks are for UX only. All admin routes are protected on the backend.

2. **Super Admin Only**: Only super_admin can change user roles (including their own role).

3. **Cannot Change Own Role**: Super admins cannot change their own role to non-super_admin (security measure).

4. **Default Role**: New users default to `'user'` role.

5. **Audit Logging**: Role changes are logged in backend logs.

## Testing

1. **Test Admin Access:**
   - Login as admin → Should see admin sidebar items
   - Access `/dashboard/ab-testing` → Should work
   - Access `/dashboard/admin/users` → Should be blocked (super_admin only)

2. **Test Super Admin Access:**
   - Login as super_admin → Should see all admin items + User Management
   - Access `/dashboard/admin/users` → Should work
   - Change user roles → Should work

3. **Test Regular User:**
   - Login as user → Should NOT see admin sidebar items
   - Access `/dashboard/ab-testing` → Should redirect to dashboard
   - Access `/api/admin/users` → Should return 403

## Files Changed

### Backend:
- `backend/src/database/migrations/030_add_user_roles.sql` (NEW)
- `backend/src/types/database.ts`
- `backend/src/types/user.ts`
- `backend/src/middleware/authorization.middleware.ts` (NEW)
- `backend/src/routes/admin.routes.ts` (NEW)
- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/analytics.routes.ts`
- `backend/src/routes/metrics.routes.ts`
- `backend/src/server.ts`
- `backend/src/scripts/set-user-role.ts` (UPDATED)

### Frontend:
- `frontend/lib/api.ts`
- `frontend/lib/hooks/use-user-role.ts` (NEW)
- `frontend/components/admin/admin-guard.tsx` (NEW)
- `frontend/components/admin/admin-only.tsx` (NEW)
- `frontend/components/sidebar/app-sidebar.tsx`
- `frontend/app/dashboard/ab-testing/page.tsx`
- `frontend/app/dashboard/validation/page.tsx`
- `frontend/app/dashboard/analytics/page.tsx`
- `frontend/app/dashboard/health/page.tsx`
- `frontend/app/dashboard/admin/users/page.tsx` (NEW)

## Next Steps

1. Run the database migration
2. Set your first user as super_admin
3. Test admin features
4. Use the admin UI to manage other users' roles
