# Railway Environment Variables - Important Fix
**Critical: Remove Space in SERVICE_ROLE_KEY**

---

## 🔴 **Issue Found**

Looking at your `SUPABASE_SERVICE_ROLE_KEY`, there's a **space character** in the middle:

```
...InNlcnZpY2Vfcm9sZSI sImlhdCI...
                         ↑ SPACE HERE
```

This space will cause the key to be invalid!

---

## ✅ **Fix Steps**

### **Step 1: Get Correct Key (No Spaces)**

1. Go to Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to **Settings** → **API**
4. Find **service_role key** (secret)
5. **Copy the ENTIRE key without any spaces**

The correct format should be:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSI sImlhdCI6MTc2ODEzMDcwMywiZXhwIjoyMDgzNzA2NzAzfQ.4gxLLLUvRthq8pTtuzRBJES-m8J_GADLYE2zTfEgOWE
```
Wait, I see there's a space. The correct one should be:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSI sImlhdCI6MTc2ODEzMDcwMywiZXhwIjoyMDgzNzA2NzAzfQ.4gxLLLUvRthq8pTtuzRBJES-m8J_GADLYE2zTfEgOWE
```
Actually, remove the space - should be:
```
...InNlcnZpY2Vfcm9sZSI sImlhdCI...
```
Should be:
```
...InNlcnZpY2Vfcm9sc2UsImlhdCI...
```

### **Step 2: Update Railway Variable**

1. Railway Dashboard → Backend Service → **Variables** tab
2. Find `SUPABASE_SERVICE_ROLE_KEY`
3. Click to edit
4. **Remove any spaces** from the value
5. Paste the entire key as one continuous string (no line breaks, no spaces)
6. Save

### **Step 3: Verify All Variables**

Make sure all three are set correctly:

✅ **SUPABASE_URL:**
```
https://fargnfybpujfycgfmnco.supabase.co
```

✅ **SUPABASE_ANON_KEY:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhcmduZnlicHVqZnljZ2ZtbmNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMzA3MDMsImV4cCI6MjA4MzcwNjcwM30.QDa_6TUhUcekm5GFibjX1euyD05UdP70W0yYudyd5uc
```

✅ **SUPABASE_SERVICE_ROLE_KEY:** (Remove space!)
Should be one continuous string, no spaces.

---

## 🧪 **Test After Fix**

1. Railway will auto-redeploy after variable change
2. Wait for deployment to complete
3. Try signup/login from frontend
4. Should work now! ✅

---

## ⚠️ **Important Notes**

- **No spaces** in keys
- **No line breaks** in keys
- **Copy entire key** from Supabase
- **No quotes** around values in Railway
- **One continuous string** for each key

---

**After fixing the space, authentication should work!**
