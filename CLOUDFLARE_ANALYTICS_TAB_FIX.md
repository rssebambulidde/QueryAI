# Fix Analytics Tab on Cloudflare + Remove Railway Frontend

## 🎯 Problem
- Analytics tab visible on Railway frontend ✅
- Analytics tab NOT visible on Cloudflare frontend ❌
- Want to delete Railway frontend to avoid conflicts

## 🔧 Solution Steps

### Step 1: Delete Railway Frontend Service

1. **Go to Railway Dashboard**: https://railway.app
2. **Select your QueryAI project**
3. **Find the Frontend service** (separate from backend)
4. **Click on the Frontend service**
5. **Go to Settings tab**
6. **Scroll down to "Danger Zone"**
7. **Click "Delete Service"**
8. **Confirm deletion**

⚠️ **Important**: Only delete the FRONTEND service, NOT the backend service!

---

### Step 2: Verify Cloudflare Build Command

**IMPORTANT**: Cloudflare Pages needs to use the correct build command for Next.js on Cloudflare.

1. **Go to Cloudflare Dashboard** → Your Pages Project
2. **Go to Settings → Builds & deployments**
3. **Check Build command** - It should be:
   ```
   npm install && npm run build:cloudflare
   ```
   OR if using standard Next.js build:
   ```
   npm install && npm run build
   ```
4. **Verify Root directory** is set to: `frontend`
5. **Save changes** if you made any

### Step 3: Force Cloudflare to Rebuild with Latest Code

The issue is likely that Cloudflare has cached an old build. Here's how to fix it:

#### Option A: Trigger New Deployment (Recommended)

1. **Go to Cloudflare Dashboard**: https://dash.cloudflare.com
2. **Navigate to**: Workers & Pages → Your Pages Project
3. **Go to Deployments tab**
4. **Click "Retry deployment"** on the latest deployment
   - OR
5. **Make a small commit** to trigger a new build:
   ```bash
   git commit --allow-empty -m "Trigger Cloudflare rebuild"
   git push
   ```

#### Option B: Clear Build Cache

1. **In Cloudflare Pages project**
2. **Go to Settings → Builds & deployments**
3. **Clear build cache** (if available)
4. **Trigger a new deployment**

#### Option C: Update Environment Variables (Forces Rebuild)

1. **Go to Settings → Environment Variables**
2. **Edit `NEXT_PUBLIC_API_URL`** (add a space and remove it, or change and change back)
3. **Save** - This will trigger a new deployment

---

### Step 4: Verify Cloudflare Deployment

1. **Check the latest deployment** in Cloudflare
2. **Verify it's building from the latest commit** (should include analytics changes)
3. **Wait for build to complete**
4. **Check build logs** for any errors

---

### Step 5: Clear Browser Cache

After Cloudflare rebuilds:

1. **Hard refresh** your browser:
   - **Chrome/Edge**: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
   - **Firefox**: `Ctrl + F5` (Windows) or `Cmd + Shift + R` (Mac)
2. **Or clear browser cache** completely
3. **Log out and log back in** to get fresh user data with subscriptionTier

---

### Step 6: Verify Subscription Tier

The analytics tab only shows for Premium/Pro users. Verify:

1. **Check your user's subscription in database**:
   ```sql
   SELECT * FROM subscriptions WHERE user_id = 'your-user-id';
   ```
2. **Ensure tier is 'premium' or 'pro'** (not 'free')
3. **If it's 'free', update it**:
   ```sql
   UPDATE subscriptions 
   SET tier = 'premium' 
   WHERE user_id = 'your-user-id';
   ```
4. **Log out and log back in** to refresh user data

---

### Step 7: Update Backend CORS (If Needed)

If you removed Railway frontend, update CORS to only allow Cloudflare:

1. **Go to Railway Dashboard** → Backend Service
2. **Go to Variables tab**
3. **Update `CORS_ORIGIN`** to only your Cloudflare URL:
   ```
   https://your-frontend.pages.dev
   ```
4. **Remove Railway frontend URL** if it was there

---

## 🔍 Debugging Steps

If analytics tab still doesn't show:

### 1. Check Browser Console
- Open browser DevTools (F12)
- Check Console for errors
- Check Network tab for API calls

### 2. Verify User Object
Add temporary logging in dashboard:
```typescript
console.log('User subscription tier:', user?.subscriptionTier);
```

### 3. Check API Response
- Open Network tab in DevTools
- Find `/api/auth/me` request
- Verify response includes `subscriptionTier`

### 4. Verify Code is Deployed
- Check Cloudflare deployment logs
- Verify latest commit hash matches your repo
- Check build completed successfully

---

## ✅ Expected Result

After completing these steps:
- ✅ Railway frontend service deleted
- ✅ Cloudflare frontend rebuilt with latest code
- ✅ Analytics tab visible for Premium/Pro users
- ✅ No conflicts between deployments

---

## 📝 Quick Checklist

- [ ] Delete Railway frontend service
- [ ] Trigger new Cloudflare deployment
- [ ] Verify build completed successfully
- [ ] Check user subscription tier in database
- [ ] Update CORS_ORIGIN if needed
- [ ] Clear browser cache
- [ ] Log out and log back in
- [ ] Verify analytics tab appears

---

## 🚨 Common Issues

### Issue: Analytics tab still not showing
**Solution**: 
- Verify subscription tier is 'premium' or 'pro' in database
- Check browser console for errors
- Verify `/api/auth/me` returns subscriptionTier

### Issue: Build fails on Cloudflare
**Solution**:
- Check build logs for errors
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check root directory is set to `frontend`

### Issue: Old code still showing
**Solution**:
- Clear Cloudflare build cache
- Force new deployment
- Clear browser cache completely

---

**Last Updated**: 2026-01-24
