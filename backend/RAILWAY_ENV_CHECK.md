# Railway Environment Variables Check
**Fix "Invalid API key" Error**

---

## 🔴 **Problem**

Backend logs show:
```
Invalid API key
AuthApiError: Invalid API key
```

This means Supabase environment variables are missing or incorrect in Railway.

---

## ✅ **Solution: Verify Environment Variables**

### **Step 1: Check Railway Variables**

1. Go to Railway Dashboard
2. Select your **backend service**
3. Go to **Variables** tab
4. Verify these variables exist:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### **Step 2: Get Correct Values from Supabase**

1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values:

**Project URL:**
```
https://xxxxxxxxxxxxx.supabase.co
```
→ Use for `SUPABASE_URL`

**anon public key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQwMDAwMDAwLCJleHAiOjE2NDAwMDAwMDB9.xxxxx
```
→ Use for `SUPABASE_ANON_KEY`

**service_role key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4eHh4eHh4eHh4eHh4eCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDAwMDAwMDAwLCJleHAiOjE2NDAwMDAwMDB9.xxxxx
```
→ Use for `SUPABASE_SERVICE_ROLE_KEY`

---

### **Step 3: Update Railway Variables**

1. In Railway backend service → **Variables** tab
2. For each variable:
   - If it exists: Click to edit and update value
   - If missing: Click **"+ New Variable"** and add it

3. **Important:** Make sure:
   - No extra spaces
   - No quotes around values
   - Copy entire key (they're long!)

---

### **Step 4: Redeploy**

After updating variables:
1. Railway will auto-redeploy
2. Or manually trigger: **Deployments** → **Redeploy**

---

## 🔍 **Quick Checklist**

- [ ] `SUPABASE_URL` is set and correct
- [ ] `SUPABASE_ANON_KEY` is set and correct
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set and correct
- [ ] No extra spaces or quotes
- [ ] Values copied completely
- [ ] Backend redeployed

---

## 🧪 **Test After Fix**

1. Try signup again from frontend
2. Check backend logs - should see success
3. User should be created in Supabase

---

## 📝 **Other Required Variables**

Also verify these are set:

```
NODE_ENV=production
PORT=8080 (or Railway auto-assigns)
API_BASE_URL=https://your-backend.railway.app
CORS_ORIGIN=https://your-frontend.railway.app
```

---

**Last Updated:** 2026-01-11
