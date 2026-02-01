# Super Admin Sidebar Visibility Fix

## Issue
Super admin users are not seeing admin-only features in the sidebar menu after logging in.

## Solution Implemented

### 1. Added Super Admin Section to Sidebar

**Expanded Sidebar:**
- Added "Super Admin" section after Collections
- Shows only when `user?.role === 'super_admin'`
- Links to `/dashboard/settings/super-admin`

**Collapsed Sidebar:**
- Added Super Admin button icon
- Shows only when `user?.role === 'super_admin'`
- Links to `/dashboard/settings/super-admin`

**Code Location:** `frontend/components/sidebar/app-sidebar.tsx`

### 2. Added Super Admin Link to Account Dropdown

- Added "Super Admin" menu item to account dropdown
- Shows only for super_admin users
- Links to `/dashboard/settings/super-admin`

**Code Location:** `frontend/components/sidebar/account-dropdown.tsx`

### 3. Debug Logging

Added console logging to help debug role visibility:
- Logs user role when sidebar renders
- Logs whether user is super admin

## How to Verify

1. **Login with super_admin account**
2. **Check browser console** for:
   ```
   [Sidebar] User role: super_admin
   [Sidebar] Is super admin: true
   ```
3. **Look for Super Admin section** in sidebar (after Collections)
4. **Click account dropdown** - should see "Super Admin" menu item
5. **Navigate to Settings** - should see "Super Admin" in settings navigation

## Troubleshooting

If Super Admin features are still not visible:

1. **Check user role in database:**
   ```sql
   SELECT id, email, role FROM user_profiles WHERE email = 'your-super-admin-email@example.com';
   ```
   Should show `role = 'super_admin'`

2. **Check browser console:**
   - Look for `[AuthStore] User role:` logs
   - Should show `super_admin` not `user` or `admin`

3. **Clear browser cache:**
   - The auth store uses persisted storage
   - Clear localStorage: `localStorage.clear()` in browser console
   - Refresh page and login again

4. **Verify API response:**
   - Check Network tab → `/api/auth/me` response
   - Should include `"role": "super_admin"` in user object

5. **Check if role is being set correctly:**
   - Use User Management page (if accessible) to verify role
   - Or update directly in database:
     ```sql
     UPDATE user_profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';
     ```

## Files Changed

1. `frontend/components/sidebar/app-sidebar.tsx`
   - Added Super Admin section (expanded sidebar)
   - Added Super Admin button (collapsed sidebar)
   - Added debug logging

2. `frontend/components/sidebar/account-dropdown.tsx`
   - Added Super Admin menu item
   - Updated `getMenuGroups` to include super admin check

## Expected Behavior

**For Super Admin Users:**
- ✅ See "Super Admin" section in sidebar (expanded)
- ✅ See Super Admin icon button (collapsed sidebar)
- ✅ See "Super Admin" in account dropdown menu
- ✅ See "Super Admin" in Settings navigation
- ✅ Can access `/dashboard/settings/super-admin` with all tabs

**For Regular Users:**
- ❌ Do NOT see Super Admin section in sidebar
- ❌ Do NOT see Super Admin in account dropdown
- ❌ Do NOT see Super Admin in Settings navigation
- ❌ Cannot access `/dashboard/settings/super-admin` (redirected to dashboard)
