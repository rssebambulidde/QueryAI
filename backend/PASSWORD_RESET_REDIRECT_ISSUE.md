# Password Reset Redirect Issue
**The reset link is redirecting to `/api/test/supabase` instead of `/reset-password`**

---

## 🔴 **Problem**

Password reset link redirects to `/api/test/supabase` (which doesn't exist) instead of the frontend `/reset-password` page.

---

## 🔍 **Root Cause**

The redirect URL is likely configured incorrectly in Supabase settings, OR the `redirectTo` parameter in the code is not being used properly.

---

## ✅ **Solution**

### **Step 1: Check Backend Logs**

When you request a password reset, check the backend logs to see what `redirectUrl` is being logged:

```json
{
  "message": "Requesting password reset for: email@example.com",
  "redirectUrl": "...",
  "apiBaseUrl": "..."
}
```

This will tell us what URL is being sent to Supabase.

---

### **Step 2: Update Supabase Redirect URLs**

1. **Go to Supabase Dashboard:**
   - https://app.supabase.com
   - Select your project

2. **Navigate to:** **Authentication** → **URL Configuration**

3. **Set Site URL:**
   ```
   https://front-production-5875.up.railway.app
   ```
   *(Your FRONTEND Railway domain, NOT backend!)*

4. **Add Redirect URLs** (one per line):
   ```
   https://front-production-5875.up.railway.app
   https://front-production-5875.up.railway.app/reset-password
   http://localhost:3000
   http://localhost:3000/reset-password
   ```

5. **IMPORTANT:** Remove `/api/test/supabase` if it's in the list!

6. **Click "Save"**

---

### **Step 3: Set CORS_ORIGIN Environment Variable**

In Railway backend service:

1. **Go to Variables tab**

2. **Set/Check `CORS_ORIGIN`:**
   ```
   CORS_ORIGIN=https://front-production-5875.up.railway.app
   ```
   *(Your FRONTEND URL, not backend!)*

3. **Make sure `API_BASE_URL` is your BACKEND URL:**
   ```
   API_BASE_URL=https://queryai-production.up.railway.app
   ```

---

### **Step 4: Verify the Email Link**

After requesting password reset, check the email link. It should look like:

```
https://fargnfybpujfycgfmnco.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https://front-production-5875.up.railway.app/reset-password
```

**NOT:**
```
...redirect_to=/api/test/supabase
```

---

## 🧪 **Test**

1. **Request password reset:**
   ```bash
   POST /api/auth/forgot-password
   {
     "email": "your-email@example.com"
   }
   ```

2. **Check backend logs** - should show:
   ```
   redirectUrl: "https://front-production-5875.up.railway.app/reset-password"
   ```

3. **Check email** - link should have:
   ```
   redirect_to=https://front-production-5875.up.railway.app/reset-password
   ```

4. **Click link** - should redirect to frontend `/reset-password` page

---

## ✅ **Checklist**

- [ ] Supabase Site URL is set to **frontend URL**
- [ ] Supabase Redirect URLs include frontend `/reset-password`
- [ ] `/api/test/supabase` is **removed** from Supabase redirect URLs
- [ ] `CORS_ORIGIN` in Railway is set to **frontend URL**
- [ ] Backend logs show correct `redirectUrl`
- [ ] Email link shows correct `redirect_to` parameter
- [ ] Clicking link redirects to frontend page

---

## 🆘 **Still Not Working?**

If it's still redirecting to `/api/test/supabase`, check:

1. **Supabase Email Template:**
   - Go to: **Authentication** → **Email Templates** → **Reset Password**
   - Make sure it's using `{{ .ConfirmationURL }}` and not hardcoded URLs

2. **Clear Browser Cache:**
   - Old redirects might be cached

3. **Check Supabase Logs:**
   - Go to: **Logs** → **Auth Logs**
   - Look for password reset requests

---

**After fixing Supabase redirect URLs, the password reset should work!** ✅
