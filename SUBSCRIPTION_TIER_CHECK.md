# Check and Update User Subscription Tier

## 🔍 Problem
Analytics tab is not visible on Cloudflare frontend even after successful deployment.

## ✅ Solution: Verify Subscription Tier

The analytics tab only shows for users with `subscriptionTier === 'premium'` or `subscriptionTier === 'pro'`.

### Step 1: Check Your Current Subscription Tier

**In Supabase SQL Editor or your database client:**

```sql
-- Find your user ID first (use your email)
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then check subscription (replace 'your-user-id' with actual UUID)
SELECT 
  s.id,
  s.user_id,
  s.tier,
  s.status,
  u.email
FROM subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE u.email = 'your-email@example.com';
```

### Step 2: Update Subscription Tier to Premium or Pro

**If your tier is 'free', update it:**

```sql
-- Update to premium
UPDATE subscriptions 
SET tier = 'premium', 
    status = 'active',
    updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);

-- OR update to pro
UPDATE subscriptions 
SET tier = 'pro', 
    status = 'active',
    updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'your-email@example.com'
);
```

**If subscription doesn't exist, create it:**

```sql
-- Create premium subscription
INSERT INTO subscriptions (user_id, tier, status, current_period_start, current_period_end)
SELECT 
  id,
  'premium',
  'active',
  NOW(),
  NOW() + INTERVAL '1 month'
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO UPDATE
SET tier = 'premium', status = 'active', updated_at = NOW();
```

### Step 3: Refresh User Session

After updating the subscription in the database:

1. **Log out** from the Cloudflare frontend
2. **Clear browser cache** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
3. **Log back in**
4. **Check browser console** (F12) for debug logs:
   - Should see: `[Dashboard] User subscription tier: premium` (or `pro`)
   - Should see: `[AppSidebar] Should show analytics: true`

### Step 4: Verify Analytics Tab Appears

After logging back in with updated subscription:
- Analytics tab should appear in the sidebar
- Should be visible in both expanded and collapsed sidebar views

---

## 🐛 Debugging Steps

### 1. Check Browser Console

Open browser DevTools (F12) → Console tab, and look for:
```
[Dashboard] User subscription tier: ...
[AppSidebar] Subscription tier: ...
[AppSidebar] Should show analytics: ...
```

### 2. Check Network Tab

1. Open DevTools → Network tab
2. Filter by "me" or "auth"
3. Find the `/api/auth/me` request
4. Check the response - should include:
   ```json
   {
     "success": true,
     "data": {
       "user": {
         "id": "...",
         "email": "...",
         "subscriptionTier": "premium"  // or "pro"
       }
     }
   }
   ```

### 3. Verify Backend Response

Test the `/api/auth/me` endpoint directly:

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://your-backend.railway.app/api/auth/me
```

Should return `subscriptionTier` in the user object.

---

## 📝 Quick Checklist

- [ ] Checked subscription tier in database
- [ ] Updated subscription tier to 'premium' or 'pro' if it was 'free'
- [ ] Logged out from frontend
- [ ] Cleared browser cache
- [ ] Logged back in
- [ ] Checked browser console for subscription tier logs
- [ ] Verified `/api/auth/me` returns correct subscriptionTier
- [ ] Analytics tab should now be visible

---

## 🚨 Common Issues

### Issue: Subscription tier is 'free'
**Solution**: Update to 'premium' or 'pro' using SQL above

### Issue: Subscription doesn't exist
**Solution**: Create subscription using INSERT statement above

### Issue: User object doesn't have subscriptionTier
**Solution**: 
- Log out and log back in
- Check backend `/api/auth/me` endpoint returns subscriptionTier
- Verify backend code includes subscription fetch in auth routes

### Issue: Console shows 'free' even after update
**Solution**:
- Clear browser localStorage: `localStorage.clear()`
- Log out and log back in
- Check database update was successful

---

**Last Updated**: 2026-01-24
