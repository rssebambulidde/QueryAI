# Setting Up Your First Super Admin

## Step-by-Step Guide

### Step 1: Create a User Account (if you don't have one)

1. Go to your app's signup page (usually `/signup`)
2. Create an account with your email and password
3. Complete the signup process

### Step 2: Set Role to Super Admin

#### Option A: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run this query:

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE user_profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';

-- Verify the change
SELECT id, email, role 
FROM user_profiles 
WHERE email = 'your-email@example.com';
```

#### Option B: Using Direct Database Access

If you have direct database access:

```sql
UPDATE user_profiles 
SET role = 'super_admin' 
WHERE email = 'your-email@example.com';
```

### Step 3: Login and Verify

1. Logout if you're currently logged in
2. Login again with your email and password
3. You should now see:
   - Admin section in the sidebar
   - "User Management" link (super_admin only)
   - Access to all admin pages

### Step 4: Verify Super Admin Access

1. Navigate to `/dashboard/admin/users`
2. You should see the User Management page
3. You can now manage other users' roles

## Troubleshooting

### Can't see admin features after setting role?

1. **Clear browser cache/localStorage:**
   - Open browser DevTools (F12)
   - Go to Application/Storage tab
   - Clear localStorage
   - Refresh the page

2. **Logout and login again:**
   - The role is fetched on login
   - Make sure you logout completely and login fresh

3. **Verify role in database:**
   ```sql
   SELECT email, role FROM user_profiles WHERE email = 'your-email@example.com';
   ```
   Should show `role = 'super_admin'`

4. **Check API response:**
   - Open browser DevTools → Network tab
   - Login and check `/api/auth/me` response
   - Should include `"role": "super_admin"`

### Role not updating?

1. Make sure you're updating the correct email
2. Check for typos in the SQL query
3. Verify the user exists:
   ```sql
   SELECT * FROM user_profiles WHERE email = 'your-email@example.com';
   ```

## Security Notes

⚠️ **Important:**
- There's no default superadmin password
- You must create a user account first, then assign the role
- Only super_admin users can change other users' roles
- Super admins cannot change their own role to non-super_admin (security measure)

## Creating Additional Admins

Once you have a super_admin account, you can:

1. **Via Admin UI:**
   - Go to `/dashboard/admin/users`
   - Find the user
   - Use the dropdown to set their role to `admin` or `super_admin`

2. **Via SQL:**
   ```sql
   UPDATE user_profiles SET role = 'admin' WHERE email = 'admin@example.com';
   ```

3. **Via Script:**
   ```bash
   ts-node backend/src/scripts/set-user-role.ts admin@example.com admin --by-email
   ```

## Quick Reference

**Roles:**
- `user` - Regular user (default)
- `admin` - Can access admin features (A/B Testing, Validation, Analytics, Health)
- `super_admin` - Full access + can manage user roles

**Admin Features:**
- A/B Testing (`/dashboard/ab-testing`)
- Validation Reports (`/dashboard/validation`)
- Analytics (`/dashboard/analytics`)
- Health Monitoring (`/dashboard/health`)
- User Management (`/dashboard/admin/users`) - super_admin only
