# Fix: Password Reset Link Redirecting to Wrong URL
**Quick Guide to Fix Password Reset Redirect URL**

---

## 🔴 **Problem**

Password reset link is redirecting to `/api/test/supabase` instead of `/reset-password` page.

**Error:** `Route /api/test/supabase not found`

---

## 🔍 **Root Cause**

The redirect URL in the code might be using the wrong URL, OR Supabase redirect URL settings need to be updated.

---

## ✅ **Solution**

### **Step 1: Check Current Redirect URL in Code**

The code currently uses:
```typescript
const frontendUrl = config.CORS_ORIGIN || config.API_BASE_URL;
const redirectUrl = `${frontendUrl}/reset-password`;
```

**Issues:**
- `CORS_ORIGIN` might be set incorrectly
- `API_BASE_URL` might be set to backend URL (wrong!)
- Need to ensure frontend URL is used

---

### **Step 2: Fix Railway Environment Variables**

Check your Railway backend service environment variables:

1. **Go to Railway Dashboard:**
   - Select your **backend** service
   - Go to **Variables** tab

2. **Set/Check `CORS_ORIGIN`:**
   ```
   CORS_ORIGIN=https://front-production-5875.up.railway.app
   ```
   *(Replace with your actual frontend Railway domain)*

3. **Make sure `API_BASE_URL` is set to BACKEND URL:**
   ```
   API_BASE_URL=https://queryai-production.up.railway.app
   ```
   *(This is your backend URL, not frontend!)*

---

### **Step 3: Update Supabase Redirect URLs**

1. **Go to Supabase Dashboard:**
   - https://app.supabase.com
   - Select your project

2. **Navigate to:** **Authentication** → **URL Configuration**

3. **Set Site URL:**
   ```
   https://front-production-5875.up.railway.app
   ```
   *(Your frontend URL, not backend!)*

4. **Add Redirect URLs:**
   ```
   https://front-production-5875.up.railway.app
   https://front-production-5875.up.railway.app/reset-password
   http://localhost:3000
   http://localhost:3000/reset-password
   ```

5. **Click "Save"**

---

### **Step 4: Alternative: Use Environment Variable**

If you want to be more explicit, you can add a `FRONTEND_URL` environment variable:

1. **Add to Railway backend service:**
   ```
   FRONTEND_URL=https://front-production-5875.up.railway.app
   ```

2. **Update code to use it:**
   ```typescript
   const frontendUrl = process.env.FRONTEND_URL || config.CORS_ORIGIN || config.API_BASE_URL;
   const redirectUrl = `${frontendUrl}/reset-password`;
   ```

---

## 🧪 **Verify Configuration**

After making changes:

1. **Check backend logs** when requesting password reset:
   - Should log: `Requesting password reset for: email@example.com`
   - Should show `redirectUrl` in logs

2. **Request password reset** via API:
   ```bash
   POST /api/auth/forgot-password
   {
     "email": "your-email@example.com"
   }
   ```

3. **Check email** - the link should point to:
   ```
   https://fargnfybpujfycgfmnco.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https://front-production-5875.up.railway.app/reset-password
   ```

4. **Click link** - should redirect to:
   ```
   https://front-production-5875.up.railway.app/reset-password#access_token=...&refresh_token=...
   ```

---

## ✅ **Checklist**

- [ ] `CORS_ORIGIN` in Railway is set to **frontend URL**
- [ ] `API_BASE_URL` in Railway is set to **backend URL**
- [ ] Supabase Site URL is set to **frontend URL**
- [ ] Supabase Redirect URLs include `/reset-password`
- [ ] Backend logs show correct `redirectUrl`
- [ ] Email link shows correct `redirect_to` parameter
- [ ] Clicking link redirects to frontend `/reset-password` page

---

## 📝 **Quick Fix Summary**

**Most Common Issue:**
- `CORS_ORIGIN` is not set, so code falls back to `API_BASE_URL` (backend URL)
- Solution: Set `CORS_ORIGIN` to your frontend URL in Railway

**Or:**
- Supabase redirect URLs not configured correctly
- Solution: Update Supabase redirect URLs to include frontend `/reset-password`

---

**After fixing, password reset should redirect to the frontend page!** ✅
