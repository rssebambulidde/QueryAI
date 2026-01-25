# Diagnose Supabase Connection
**Quick Steps to Fix URL/Key Mismatch**

---

## 🔍 **Step 1: Test Connection**

After Railway redeploys (1-2 minutes), test the connection:

**Open in browser:**
```
https://queryai-production.up.railway.app/api/test/supabase
```

This will show:
- ✅ If variables are set
- ✅ If URL and keys match
- ✅ Connection test results

---

## ✅ **Step 2: Verify URL in Railway**

**Most Common Issue: URL doesn't match keys!**

1. **Railway Dashboard** → Backend Service → **Variables**

2. **Check `SUPABASE_URL`:**
   - Should be: `https://fargnfybpujfycgfmnco.supabase.co`
   - **NO trailing slash** (`/`)
   - **NO spaces**
   - **Exact match from Supabase**

3. **If different, update it:**
   - Copy URL from Supabase Settings → API
   - Update in Railway
   - Save

---

## ✅ **Step 3: Verify All 3 Match Same Project**

**All 3 must be from the SAME Supabase project!**

### **Get All 3 from Supabase:**

1. Go to **Supabase Dashboard**
2. Select your project
3. Go to **Settings → API**
4. Copy these 3 values:

   ✅ **Project URL:**
   ```
   https://fargnfybpujfycgfmnco.supabase.co
   ```
   (No trailing slash!)

   ✅ **anon public key:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzA3MDMsImV4cCI6MjA4MzcwNjcwM30.QDa_6TUhUcekm5GFibjX1euyD05UdP70W0yYudyd5uc
   ```

   ✅ **service_role secret key:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzMDcwMywiZXhwIjoyMDgzNzA2NzAzfQ.4gxLLLUvRthq8pTtuzRBJES-m8J_GADLyE2zTfEg0WE
   ```

5. **Update all 3 in Railway:**
   - Railway → Backend → Variables
   - Update each one
   - Make sure URL has NO trailing slash
   - Make sure keys have NO spaces
   - Save

---

## 🔧 **Step 4: Check for Common Issues**

### **Issue 1: Trailing Slash**
- ❌ Wrong: `https://fargnfybpujfycgfmnco.supabase.co/`
- ✅ Correct: `https://fargnfybpujfycgfmnco.supabase.co`

### **Issue 2: Different Project**
- ❌ URL from one project, keys from another
- ✅ All 3 from same project

### **Issue 3: Wrong Format**
- ❌ Wrong: `fargnfybpujfycgfmnco.supabase.co` (missing https://)
- ✅ Correct: `https://fargnfybpujfycgfmnco.supabase.co`

---

## 🧪 **Step 5: Test**

1. **Wait for Railway redeploy** (1-2 minutes)

2. **Test connection:**
   ```
   https://queryai-production.up.railway.app/api/test/supabase
   ```
   - Should show all checks passing
   - Should show connection successful

3. **Test signup:**
   - Go to frontend
   - Try to create account
   - Should work now!

---

## 📝 **Quick Checklist**

- [ ] All 3 variables from SAME Supabase project
- [ ] SUPABASE_URL: `https://fargnfybpujfycgfmnco.supabase.co` (no trailing slash)
- [ ] SUPABASE_ANON_KEY: Set correctly
- [ ] SUPABASE_SERVICE_ROLE_KEY: Set correctly
- [ ] No spaces in any values
- [ ] No quotes around values
- [ ] Variables saved in Railway
- [ ] Railway redeployed
- [ ] Test endpoint shows success
- [ ] Signup/login works

---

## 🎯 **Most Likely Fix**

**The URL is probably wrong or has a trailing slash!**

**Fix:**
1. Go to Supabase → Settings → API
2. Copy exact Project URL (no trailing slash)
3. Update `SUPABASE_URL` in Railway
4. Save and redeploy

---

**After fixing the URL, test again!**
