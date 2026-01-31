# Troubleshooting: Super Admin UI Not Showing

## Quick Debug Steps

### Step 1: Verify Role in Database

Run this SQL query in Supabase SQL Editor:

```sql
SELECT id, email, role, created_at 
FROM user_profiles 
WHERE email = 'your-email@example.com';
```

**Expected:** `role` should be `'super_admin'`

**If not:**
```sql
UPDATE user_profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';
```

### Step 2: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for logs starting with `[AuthStore]`
4. Check what `userData.role` shows

**Expected logs:**
```
[AuthStore] User data from /api/auth/me: {id: "...", email: "...", role: "super_admin", ...}
[AuthStore] User role: super_admin
```

**If role is missing or 'user':**
- The API might not be returning the role
- Check Step 3

### Step 3: Check API Response

1. Open browser DevTools (F12)
2. Go to Network tab
3. Login or refresh the page
4. Find the request to `/api/auth/me`
5. Click on it and check the Response

**Expected response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "...",
      "role": "super_admin",
      ...
    }
  }
}
```

**If role is missing:**
- Backend might not be returning role
- Check backend logs
- Verify migration ran successfully

### Step 4: Clear Cache and Reload

1. **Clear localStorage:**
   ```javascript
   // In browser console (F12)
   localStorage.clear();
   ```

2. **Clear browser cache:**
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Clear cached images and files

3. **Hard refresh:**
   - Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

4. **Logout and login again:**
   - This forces a fresh API call to `/api/auth/me`

### Step 5: Verify Frontend Code

Check if the sidebar is checking role correctly:

1. Open browser DevTools → Console
2. Type:
   ```javascript
   // Check what the auth store has
   // This requires accessing the store - check React DevTools instead
   ```

3. Or add temporary debug code in sidebar:
   ```typescript
   console.log('Sidebar - User:', user);
   console.log('Sidebar - User Role:', user?.role);
   console.log('Sidebar - Is Admin:', user?.role === 'admin' || user?.role === 'super_admin');
   ```

## Common Issues and Fixes

### Issue 1: Role is 'user' in database

**Fix:**
```sql
UPDATE user_profiles SET role = 'super_admin' WHERE email = 'your-email@example.com';
```

### Issue 2: Role not returned by API

**Check:**
1. Verify migration ran: `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role';`
2. Check backend logs for errors
3. Verify `/api/auth/me` endpoint includes role field

**Fix:** Make sure `backend/src/routes/auth.routes.ts` includes role in response:
```typescript
role: profile?.role || 'user',
```

### Issue 3: Frontend not reading role

**Check:**
1. Browser console logs show role is present in API response
2. But `user.role` is undefined in components

**Fix:**
1. Clear localStorage
2. Logout and login again
3. Check if auth store is properly updating

### Issue 4: Sidebar not showing admin items

**Check:**
1. Verify `user?.role === 'admin' || user?.role === 'super_admin'` evaluates to true
2. Check if sidebar component is re-rendering after login

**Fix:**
- Add `useEffect` to force sidebar re-render when user changes
- Or ensure sidebar component reads from auth store correctly

## Manual Verification

### Test 1: Direct API Call

In browser console (after login):
```javascript
fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
})
.then(r => r.json())
.then(data => {
  console.log('API Response:', data);
  console.log('User Role:', data.data?.user?.role);
});
```

### Test 2: Check Auth Store

If you have React DevTools:
1. Install React DevTools extension
2. Inspect the component tree
3. Find `useAuthStore` hook
4. Check the `user` object and its `role` property

### Test 3: Database Direct Check

```sql
-- Check all users and their roles
SELECT email, role, created_at 
FROM user_profiles 
ORDER BY created_at DESC;

-- Check specific user
SELECT * FROM user_profiles WHERE email = 'your-email@example.com';
```

## Expected Behavior

When logged in as super_admin, you should see:

1. **Sidebar:**
   - "Admin" section visible
   - "A/B Testing" link
   - "Validation Reports" link
   - "User Management" link (super_admin only)

2. **Pages accessible:**
   - `/dashboard/ab-testing` ✅
   - `/dashboard/validation` ✅
   - `/dashboard/analytics` ✅
   - `/dashboard/health` ✅
   - `/dashboard/admin/users` ✅ (super_admin only)

3. **Console logs:**
   ```
   [AuthStore] User role: super_admin
   ```

## Still Not Working?

1. **Check backend logs** for any errors
2. **Verify migration** ran successfully:
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'user_profiles' AND column_name = 'role';
   ```

3. **Restart backend server** to ensure new code is loaded

4. **Check browser console** for any JavaScript errors

5. **Verify network requests** - ensure `/api/auth/me` is being called and returns role

## Quick Fix Script

Run this in Supabase SQL Editor to ensure your user is super_admin:

```sql
-- Set your email as super_admin
UPDATE user_profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';

-- Verify
SELECT email, role FROM user_profiles WHERE email = 'your-email@example.com';
```

Then:
1. Clear browser localStorage
2. Logout
3. Login again
4. Check console logs
