# Supabase URL Verification
**Check if SUPABASE_URL Matches Your Keys**

---

## 🔴 **Issue: URL/Key Mismatch**

Your Supabase keys and URL must match the same project. If they don't match, you'll get "Invalid API key" errors.

---

## ✅ **Step 1: Get Correct URL from Supabase**

1. Go to **Supabase Dashboard:**
   - https://app.supabase.com
   - Select your project

2. Go to **Settings → API**

3. Find **"Project URL"** (at the top)

4. Copy the URL - it should look like:
   ```
   https://xxxxxxxxxxxxx.supabase.co
   ```

5. **For your project, it should be:**
   ```
   https://fargnfybpujfycgfmnco.supabase.co
   ```

---

## ✅ **Step 2: Verify URL Matches Keys**

**Important:** Your URL and keys must be from the SAME project!

- ✅ **SUPABASE_URL** → From same project as keys
- ✅ **SUPABASE_ANON_KEY** → From same project
- ✅ **SUPABASE_SERVICE_ROLE_KEY** → From same project

**If URL and keys are from different projects, they won't work!**

---

## ✅ **Step 3: Update Railway Variables**

1. **Railway Dashboard** → Backend Service → **Variables**

2. **Check SUPABASE_URL:**
   - Should be: `https://fargnfybpujfycgfmnco.supabase.co`
   - **No trailing slash** (`/`)
   - **No spaces**
   - **Exact match from Supabase**

3. **Verify all 3 variables are from the SAME project:**

   ✅ **SUPABASE_URL:**
   ```
   https://fargnfybpujfycgfmnco.supabase.co
   ```

   ✅ **SUPABASE_ANON_KEY:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzA3MDMsImV4cCI6MjA4MzcwNjcwM30.QDa_6TUhUcekm5GFibjX1euyD05UdP70W0yYudyd5uc
   ```

   ✅ **SUPABASE_SERVICE_ROLE_KEY:**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzMDcwMywiZXhwIjoyMDgzNzA2NzAzfQ.4gxLLLUvRthq8pTtuzRBJES-m8J_GADLyE2zTfEg0WE
   ```

4. **Update SUPABASE_URL if needed:**
   - If URL is different, update it
   - Make sure it matches exactly from Supabase Settings → API
   - No trailing slash
   - No spaces

---

## 🔍 **Step 4: Decode Keys to Verify Project**

Your keys contain the project reference. The `ref` field in the JWT payload should match your project ID.

**From your ANON_KEY, the `ref` is: `fargnfybpujfycgfmnco`**

This means:
- ✅ Project ID: `fargnfybpujfycgfmnco`
- ✅ URL should be: `https://fargnfybpujfycgfmnco.supabase.co`

**If your URL is different, update it to match!**

---

## ✅ **Step 5: Complete Variable Check**

Make sure all 3 are set correctly in Railway:

| Variable | Should Be |
|----------|-----------|
| `SUPABASE_URL` | `https://fargnfybpujfycgfmnco.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzA3MDMsImV4cCI6MjA4MzcwNjcwM30.QDa_6TUhUcekm5GFibjX1euyD05UdP70W0yYudyd5uc` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzMDcwMywiZXhwIjoyMDgzNzA2NzAzfQ.4gxLLLUvRthq8pTtuzRBJES-m8J_GADLyE2zTfEg0WE` |

---

## 🔧 **Step 6: Fix Steps**

1. **Open Supabase Dashboard**
2. **Go to Settings → API**
3. **Copy Project URL** (exact value shown)
4. **Copy ANON KEY** (from anon public section)
5. **Copy SERVICE_ROLE_KEY** (from service_role secret section, click Reveal)
6. **Go to Railway** → Backend → Variables
7. **Update all 3 variables** with fresh copies from Supabase
8. **Make sure URL has NO trailing slash**
9. **Make sure keys have NO spaces**
10. **Save and wait for redeploy**

---

## 🧪 **Step 7: Test**

After updating:

1. **Railway will auto-redeploy** (wait 1-2 minutes)
2. **Try signup from frontend**
3. **Should work now!**

---

## 🔍 **Common Issues**

### **Issue 1: Wrong Project**
- Problem: URL and keys from different projects
- Fix: Make sure all 3 are from the SAME Supabase project

### **Issue 2: Trailing Slash**
- Problem: URL has trailing slash: `https://xxx.supabase.co/`
- Fix: Remove trailing slash: `https://xxx.supabase.co`

### **Issue 3: URL Format Wrong**
- Problem: Wrong URL format
- Fix: Should be `https://[project-id].supabase.co`

### **Issue 4: Mixed Projects**
- Problem: Keys from one project, URL from another
- Fix: Get all 3 from same project

---

## ✅ **Quick Checklist**

- [ ] Opened Supabase Dashboard
- [ ] Selected correct project
- [ ] Went to Settings → API
- [ ] Copied Project URL (no trailing slash)
- [ ] Copied ANON KEY
- [ ] Copied SERVICE_ROLE_KEY (clicked Reveal)
- [ ] Verified all 3 are from SAME project
- [ ] Updated all 3 in Railway
- [ ] No trailing slash on URL
- [ ] No spaces in keys
- [ ] Railway redeployed
- [ ] Tested signup - should work!

---

## 🎯 **Most Likely Issue**

**Your URL might be wrong or from a different project!**

**Action:** Verify `SUPABASE_URL` in Railway matches exactly:
```
https://fargnfybpujfycgfmnco.supabase.co
```

**Make sure:**
- ✅ No trailing slash
- ✅ Matches exactly from Supabase Settings → API
- ✅ Same project as the keys

---

**After fixing the URL, authentication should work!**
