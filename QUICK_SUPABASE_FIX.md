# Quick Supabase URL Fix
**Most Likely Issue: URL Mismatch**

---

## 🔴 **Problem**

Signup/login failing with "Invalid API key" - usually means URL doesn't match keys.

---

## ✅ **Quick Fix (3 Steps)**

### **Step 1: Get URL from Supabase**

1. Go to: https://app.supabase.com
2. Select your project
3. **Settings → API**
4. Copy **"Project URL"** exactly as shown

It should be:
```
https://fargnfybpujfycgfmnco.supabase.co
```

**⚠️ NO trailing slash!**

---

### **Step 2: Update in Railway**

1. Railway Dashboard → Backend Service → **Variables**
2. Find `SUPABASE_URL`
3. Update to exactly:
   ```
   https://fargnfybpujfycgfmnco.supabase.co
   ```
4. **Make sure:**
   - ✅ No trailing slash (`/`)
   - ✅ Starts with `https://`
   - ✅ Exact match from Supabase
5. **Save**

---

### **Step 3: Test**

1. Wait for Railway to redeploy (1-2 minutes)
2. Test signup from frontend
3. Should work! ✅

---

## 🧪 **Alternative: Test Connection**

After Railway redeploys, test:

```
https://queryai-production.up.railway.app/api/test/supabase
```

This will show:
- ✅ If variables are set
- ✅ If URL and keys match
- ✅ Connection test results

---

## 📝 **Checklist**

- [ ] URL from Supabase: `https://fargnfybpujfycgfmnco.supabase.co`
- [ ] Updated in Railway (no trailing slash)
- [ ] Railway redeployed
- [ ] Test signup - should work!

---

**Most common fix: Remove trailing slash from URL or ensure URL matches keys exactly!**
